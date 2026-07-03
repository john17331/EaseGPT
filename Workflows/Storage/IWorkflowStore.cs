using EaseGPT.Workflows.Domain;

namespace EaseGPT.Workflows.Storage;

public interface IWorkflowStore
{
    Task<IReadOnlyCollection<WorkflowDefinition>> ListAsync(CancellationToken cancellationToken);

    Task<WorkflowDefinition?> GetAsync(string id, CancellationToken cancellationToken);

    Task SaveAsync(WorkflowDefinition workflow, CancellationToken cancellationToken);

    Task DeleteAsync(string id, CancellationToken cancellationToken);
}
