using System.Threading.Channels;
using EaseGPT.Workflows.Domain;
using EaseGPT.Workflows.Nodes;
using EaseGPT.Workflows.Nodes.Llm;
using EaseGPT.Workflows.Storage;

namespace EaseGPT.Workflows.Execution;

public sealed class WorkflowExecutor : IWorkflowExecutor
{
    private readonly IWorkflowStore _store;
    private readonly IWorkflowNodeRegistry _nodeRegistry;
    private readonly IWorkflowExecutionLog _executionLog;
    private readonly IWorkflowExecutionControl _executionControl;
    private readonly ILogger<WorkflowExecutor> _logger;

    public WorkflowExecutor(
        IWorkflowStore store,
        IWorkflowNodeRegistry nodeRegistry,
        IWorkflowExecutionLog executionLog,
        IWorkflowExecutionControl executionControl,
        ILogger<WorkflowExecutor> logger)
    {
        _store = store;
        _nodeRegistry = nodeRegistry;
        _executionLog = executionLog;
        _executionControl = executionControl;
        _logger = logger;
    }

    public Task<WorkflowExecutionRecord> ExecuteAsync(WorkflowExecutionRequest request, CancellationToken cancellationToken)
        => ExecuteCoreAsync(request, _ => ValueTask.CompletedTask, cancellationToken);

    public async IAsyncEnumerable<WorkflowStreamEvent> ExecuteStreamAsync(
        WorkflowExecutionRequest request,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var channel = Channel.CreateUnbounded<WorkflowStreamEvent>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = true
        });

        var runner = Task.Run(async () =>
        {
            try
            {
                await ExecuteCoreAsync(request, WriteEventAsync, cancellationToken);
            }
            finally
            {
                channel.Writer.TryComplete();
            }
        }, cancellationToken);

        await foreach (var streamEvent in channel.Reader.ReadAllAsync(cancellationToken))
        {
            yield return streamEvent;
        }

        await runner;

        ValueTask WriteEventAsync(WorkflowStreamEvent streamEvent)
            => channel.Writer.WriteAsync(streamEvent, cancellationToken);
    }

    private async Task<WorkflowExecutionRecord> ExecuteCoreAsync(
        WorkflowExecutionRequest request,
        Func<WorkflowStreamEvent, ValueTask> emitAsync,
        CancellationToken cancellationToken)
    {
        var workflow = await _store.GetAsync(request.WorkflowId, cancellationToken)
            ?? throw new InvalidOperationException($"Workflow '{request.WorkflowId}' was not found.");

        var execution = new WorkflowExecutionRecord
        {
            Id = Guid.NewGuid().ToString("n"),
            WorkflowId = workflow.Id,
            TriggerNodeId = request.TriggerNodeId,
            Status = WorkflowExecutionStatus.Running
        };

        var executionCancellationToken = _executionControl.Register(execution.Id, cancellationToken);

        await _executionLog.AddAsync(execution, CancellationToken.None);
        await emitAsync(new WorkflowStreamEvent
        {
            Type = "workflow.started",
            WorkflowId = workflow.Id,
            ExecutionId = execution.Id,
            Data = execution
        });

        try
        {
            var variables = new Dictionary<string, object?>
            {
                ["executionId"] = execution.Id,
                ["workflowId"] = workflow.Id,
                ["triggeredAt"] = DateTimeOffset.UtcNow
            };

            var pending = new Queue<(string NodeId, Dictionary<string, object?> Input)>();
            pending.Enqueue((request.TriggerNodeId, request.Input));

            while (pending.Count > 0)
            {
                executionCancellationToken.ThrowIfCancellationRequested();
                var (nodeId, input) = pending.Dequeue();
                var nodeDefinition = workflow.Nodes.FirstOrDefault(node => node.Id == nodeId)
                    ?? throw new InvalidOperationException($"Node '{nodeId}' was not found.");

                var nodeRecord = new WorkflowNodeExecutionRecord
                {
                    NodeId = nodeDefinition.Id,
                    NodeName = nodeDefinition.Name,
                    NodeType = nodeDefinition.Type,
                    Status = WorkflowExecutionStatus.Running,
                    Input = Snapshot(input)
                };
                execution.NodeExecutions.Add(nodeRecord);

                await emitAsync(CreateNodeEvent("node.started", workflow.Id, execution.Id, nodeDefinition, nodeRecord));

                try
                {
                    var node = _nodeRegistry.Get(nodeDefinition.Type);
                    var context = new NodeExecutionContext(
                        workflow,
                        nodeDefinition,
                        input,
                        variables,
                        executionCancellationToken,
                        execution.Id,
                        (type, data) => emitAsync(new WorkflowStreamEvent
                        {
                            Type = type,
                            WorkflowId = workflow.Id,
                            ExecutionId = execution.Id,
                            NodeId = nodeDefinition.Id,
                            NodeName = nodeDefinition.Name,
                            NodeType = nodeDefinition.Type,
                            Data = data
                        }));
                    var result = await node.ExecuteAsync(context);

                    if (result.RecordedInput is not null)
                    {
                        nodeRecord.Input = Snapshot(result.RecordedInput);
                    }
                    nodeRecord.Output = Snapshot(result.RecordedOutput ?? result.Data);
                    nodeRecord.Presentation = result.Presentation is null
                        ? null
                        : Snapshot(result.Presentation);
                    nodeRecord.OutputPort = result.OutputPort;
                    nodeRecord.Status = WorkflowExecutionStatus.Succeeded;
                    nodeRecord.FinishedAt = DateTimeOffset.UtcNow;

                    await emitAsync(CreateNodeEvent("node.completed", workflow.Id, execution.Id, nodeDefinition, nodeRecord));

                    var nextEdges = workflow.Edges
                        .Where(edge => edge.SourceNodeId == nodeId && edge.SourcePort == result.OutputPort)
                        .ToList();

                    foreach (var edge in nextEdges)
                    {
                        pending.Enqueue((edge.TargetNodeId, result.Data));
                    }
                }
                catch (LlmRequestTimeoutException ex)
                {
                    nodeRecord.Status = WorkflowExecutionStatus.TimedOut;
                    nodeRecord.Error = ex.Message;
                    nodeRecord.FinishedAt = DateTimeOffset.UtcNow;
                    await emitAsync(CreateNodeEvent("node.timed-out", workflow.Id, execution.Id, nodeDefinition, nodeRecord));
                    throw;
                }
                catch (OperationCanceledException) when (executionCancellationToken.IsCancellationRequested)
                {
                    nodeRecord.Status = WorkflowExecutionStatus.Cancelled;
                    nodeRecord.Error = "Execution was cancelled by the user.";
                    nodeRecord.FinishedAt = DateTimeOffset.UtcNow;
                    await emitAsync(CreateNodeEvent("node.cancelled", workflow.Id, execution.Id, nodeDefinition, nodeRecord));
                    throw;
                }
                catch (Exception ex)
                {
                    nodeRecord.Status = WorkflowExecutionStatus.Failed;
                    nodeRecord.Error = ex.Message;
                    nodeRecord.FinishedAt = DateTimeOffset.UtcNow;
                    await emitAsync(CreateNodeEvent("node.failed", workflow.Id, execution.Id, nodeDefinition, nodeRecord));
                    throw;
                }
            }

            execution.Status = WorkflowExecutionStatus.Succeeded;
            execution.FinishedAt = DateTimeOffset.UtcNow;
            await _executionLog.AddAsync(execution, CancellationToken.None);
            await emitAsync(new WorkflowStreamEvent
            {
                Type = "workflow.completed",
                WorkflowId = workflow.Id,
                ExecutionId = execution.Id,
                Data = execution
            });

            return execution;
        }
        catch (LlmRequestTimeoutException ex)
        {
            _logger.LogWarning(ex, "Workflow {WorkflowId} execution {ExecutionId} timed out.", workflow.Id, execution.Id);
            execution.Status = WorkflowExecutionStatus.TimedOut;
            execution.Error = ex.Message;
            execution.FinishedAt = DateTimeOffset.UtcNow;
            await _executionLog.AddAsync(execution, CancellationToken.None);
            await emitAsync(new WorkflowStreamEvent
            {
                Type = "workflow.timed-out",
                WorkflowId = workflow.Id,
                ExecutionId = execution.Id,
                Data = execution
            });

            return execution;
        }
        catch (OperationCanceledException) when (executionCancellationToken.IsCancellationRequested)
        {
            _logger.LogInformation("Workflow {WorkflowId} execution {ExecutionId} was cancelled.", workflow.Id, execution.Id);
            execution.Status = WorkflowExecutionStatus.Cancelled;
            execution.Error = "Execution was cancelled by the user.";
            execution.FinishedAt = DateTimeOffset.UtcNow;
            await _executionLog.AddAsync(execution, CancellationToken.None);
            await emitAsync(new WorkflowStreamEvent
            {
                Type = "workflow.cancelled",
                WorkflowId = workflow.Id,
                ExecutionId = execution.Id,
                Data = execution
            });

            return execution;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Workflow {WorkflowId} execution {ExecutionId} failed.", workflow.Id, execution.Id);
            execution.Status = WorkflowExecutionStatus.Failed;
            execution.Error = ex.Message;
            execution.FinishedAt = DateTimeOffset.UtcNow;
            await _executionLog.AddAsync(execution, CancellationToken.None);
            await emitAsync(new WorkflowStreamEvent
            {
                Type = "workflow.failed",
                WorkflowId = workflow.Id,
                ExecutionId = execution.Id,
                Data = execution
            });

            return execution;
        }
        finally
        {
            _executionControl.Complete(execution.Id);
        }
    }

    private static WorkflowStreamEvent CreateNodeEvent(
        string type,
        string workflowId,
        string executionId,
        Domain.WorkflowNodeDefinition node,
        WorkflowNodeExecutionRecord record)
        => new()
        {
            Type = type,
            WorkflowId = workflowId,
            ExecutionId = executionId,
            NodeId = node.Id,
            NodeName = node.Name,
            NodeType = node.Type,
            Data = record
        };

    private static Dictionary<string, object?> Snapshot(IReadOnlyDictionary<string, object?> values)
        => values.ToDictionary(item => item.Key, item => item.Value);
}
