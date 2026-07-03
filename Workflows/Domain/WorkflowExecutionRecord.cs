using System.Text.Json.Serialization;

namespace EaseGPT.Workflows.Domain;

public sealed class WorkflowExecutionRecord
{
    public required string Id { get; init; }

    public required string WorkflowId { get; init; }

    public required string TriggerNodeId { get; init; }

    public required WorkflowExecutionStatus Status { get; set; }

    public DateTimeOffset StartedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? FinishedAt { get; set; }

    public List<WorkflowNodeExecutionRecord> NodeExecutions { get; set; } = [];

    public string? Error { get; set; }
}

public sealed class WorkflowNodeExecutionRecord
{
    public required string NodeId { get; init; }

    public required string NodeName { get; init; }

    public required string NodeType { get; init; }

    public required WorkflowExecutionStatus Status { get; set; }

    public Dictionary<string, object?> Input { get; set; } = [];

    public Dictionary<string, object?> Output { get; set; } = [];

    public Dictionary<string, object?>? Presentation { get; set; }

    public string? OutputPort { get; set; }

    public DateTimeOffset StartedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? FinishedAt { get; set; }

    public string? Error { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkflowExecutionStatus
{
    Running,
    Succeeded,
    Failed,
    Skipped,
    Cancelled,
    TimedOut
}
