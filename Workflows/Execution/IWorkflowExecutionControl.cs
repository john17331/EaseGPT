namespace EaseGPT.Workflows.Execution;

/// <summary>
/// Tracks running workflow cancellation sources so an execution can be stopped by ID.
/// </summary>
public interface IWorkflowExecutionControl
{
    CancellationToken Register(string executionId, CancellationToken requestCancellationToken);

    bool Cancel(string executionId);

    void Complete(string executionId);
}
