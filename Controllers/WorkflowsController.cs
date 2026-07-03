using EaseGPT.Infrastructure;
using EaseGPT.Workflows.Domain;
using EaseGPT.Workflows.Execution;
using EaseGPT.Workflows.Storage;
using Microsoft.AspNetCore.Mvc;

namespace EaseGPT.Controllers;

[ApiController]
[Route("api/workflows")]
public sealed class WorkflowsController : ControllerBase
{
    private readonly IWorkflowStore _store;
    private readonly IWorkflowExecutor _executor;
    private readonly IWorkflowExecutionControl _executionControl;
    private readonly IWorkflowExecutionLog _executionLog;

    public WorkflowsController(
        IWorkflowStore store,
        IWorkflowExecutor executor,
        IWorkflowExecutionControl executionControl,
        IWorkflowExecutionLog executionLog)
    {
        _store = store;
        _executor = executor;
        _executionControl = executionControl;
        _executionLog = executionLog;
    }

    [HttpPost("executions/{executionId}/cancel")]
    public ActionResult CancelExecution(string executionId)
        => _executionControl.Cancel(executionId)
            ? Accepted(new { executionId, status = "cancelling" })
            : NotFound(new { message = "Execution is not running." });

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<WorkflowDefinition>>> List(CancellationToken cancellationToken)
        => Ok(await _store.ListAsync(cancellationToken));

    [HttpGet("{id}")]
    public async Task<ActionResult<WorkflowDefinition>> Get(string id, CancellationToken cancellationToken)
    {
        var workflow = await _store.GetAsync(id, cancellationToken);
        return workflow is null ? NotFound() : Ok(workflow);
    }

    [HttpPost]
    public async Task<ActionResult<WorkflowDefinition>> Create(
        CreateWorkflowDto request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Workflow name is required.");
        }

        string id;
        do
        {
            id = $"workflow-{Guid.NewGuid():N}"[..21];
        }
        while (await _store.GetAsync(id, cancellationToken) is not null);

        var workflow = new WorkflowDefinition
        {
            Id = id,
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? null : request.Icon.Trim(),
            Enabled = true,
            Nodes =
            [
                new WorkflowNodeDefinition
                {
                    Id = "user-input-1",
                    Type = "trigger.manual",
                    Name = "用户输入",
                    Position = new WorkflowNodePosition { X = 120, Y = 180 }
                }
            ]
        };

        await _store.SaveAsync(workflow, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = workflow.Id }, workflow);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<WorkflowDefinition>> Save(
        string id,
        WorkflowDefinition workflow,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(id, workflow.Id, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Route id must match workflow id.");
        }

        await _store.SaveAsync(workflow, cancellationToken);
        return Ok(workflow);
    }

    [HttpPatch("{id}/metadata")]
    public async Task<ActionResult<WorkflowDefinition>> UpdateMetadata(
        string id,
        UpdateWorkflowMetadataDto request,
        CancellationToken cancellationToken)
    {
        var workflow = await _store.GetAsync(id, cancellationToken);
        if (workflow is null)
        {
            return NotFound();
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Workflow name is required.");
        }

        workflow.Name = name;
        workflow.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        workflow.Icon = string.IsNullOrWhiteSpace(request.Icon)
            ? null
            : request.Icon.Trim();

        await _store.SaveAsync(workflow, cancellationToken);
        return Ok(workflow);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var workflow = await _store.GetAsync(id, cancellationToken);
        if (workflow is null)
        {
            return NotFound();
        }

        await _store.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id}/execute")]
    public async Task<ActionResult<WorkflowExecutionRecord>> Execute(
        string id,
        ExecuteWorkflowDto request,
        CancellationToken cancellationToken)
    {
        var workflow = await _store.GetAsync(id, cancellationToken);
        if (workflow is null)
        {
            return NotFound();
        }

        var triggerNodeId = request.TriggerNodeId
            ?? workflow.Nodes.FirstOrDefault(node => node.Type.StartsWith("trigger.", StringComparison.OrdinalIgnoreCase))?.Id;

        if (triggerNodeId is null)
        {
            return BadRequest("Workflow has no trigger node.");
        }

        var execution = await _executor.ExecuteAsync(new WorkflowExecutionRequest
        {
            WorkflowId = id,
            TriggerNodeId = triggerNodeId,
            Input = request.Input ?? []
        }, cancellationToken);

        return Ok(execution);
    }

    [HttpPost("{id}/execute/stream")]
    public async Task ExecuteStream(
        string id,
        ExecuteWorkflowDto request,
        CancellationToken cancellationToken)
    {
        var workflow = await _store.GetAsync(id, cancellationToken);
        if (workflow is null)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            await Response.WriteAsync("Workflow was not found.", cancellationToken);
            return;
        }

        var triggerNodeId = request.TriggerNodeId
            ?? workflow.Nodes.FirstOrDefault(node => node.Type.StartsWith("trigger.", StringComparison.OrdinalIgnoreCase))?.Id;

        if (triggerNodeId is null)
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            await Response.WriteAsync("Workflow has no trigger node.", cancellationToken);
            return;
        }

        Response.PrepareServerSentEvents();

        await foreach (var streamEvent in _executor.ExecuteStreamAsync(new WorkflowExecutionRequest
                       {
                           WorkflowId = id,
                           TriggerNodeId = triggerNodeId,
                           Input = request.Input ?? []
                       }, cancellationToken))
        {
            await Response.WriteServerSentEventAsync(
                streamEvent.Type,
                streamEvent,
                cancellationToken);
        }
    }

    [HttpGet("{id}/executions")]
    public async Task<ActionResult<IReadOnlyCollection<WorkflowExecutionRecord>>> ListExecutions(
        string id,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? keyword,
        CancellationToken cancellationToken)
        => Ok(await _executionLog.ListAsync(id, from, to, keyword, cancellationToken));

    [HttpGet("/api/executions")]
    public async Task<ActionResult<IReadOnlyCollection<WorkflowExecutionRecord>>> ListAllExecutions(CancellationToken cancellationToken)
        => Ok(await _executionLog.ListAsync(null, null, null, null, cancellationToken));
}
