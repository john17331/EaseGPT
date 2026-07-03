using EaseGPT.Workflows.Domain;

namespace EaseGPT.Workflows.Execution;

public interface IWorkflowExecutor
{
    Task<WorkflowExecutionRecord> ExecuteAsync(WorkflowExecutionRequest request, CancellationToken cancellationToken);

    IAsyncEnumerable<WorkflowStreamEvent> ExecuteStreamAsync(WorkflowExecutionRequest request, CancellationToken cancellationToken);
}
