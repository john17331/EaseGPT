using EaseGPT.Workflows.Domain;

namespace EaseGPT.Workflows.Storage;

public interface IWorkflowExecutionLog
{
    Task AddAsync(WorkflowExecutionRecord execution, CancellationToken cancellationToken);

    Task<IReadOnlyCollection<WorkflowExecutionRecord>> ListAsync(
        string? workflowId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        string? keyword,
        CancellationToken cancellationToken);
}
