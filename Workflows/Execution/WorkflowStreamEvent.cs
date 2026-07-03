namespace EaseGPT.Workflows.Execution;

public sealed class WorkflowStreamEvent
{
    public required string Type { get; init; }

    public required string WorkflowId { get; init; }

    public required string ExecutionId { get; init; }

    public string? NodeId { get; init; }

    public string? NodeName { get; init; }

    public string? NodeType { get; init; }

    public object? Data { get; init; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}

