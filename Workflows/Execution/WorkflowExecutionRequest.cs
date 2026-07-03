namespace EaseGPT.Workflows.Execution;

public sealed class WorkflowExecutionRequest
{
    public required string WorkflowId { get; init; }

    public required string TriggerNodeId { get; init; }

    public Dictionary<string, object?> Input { get; init; } = [];
}

