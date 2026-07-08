namespace EaseGPT.ConversationAgents;

public sealed class ConversationAgentExecutionRecord
{
    public required string Id { get; init; }

    public required string AgentId { get; init; }

    public required string AgentName { get; init; }

    public required string Message { get; init; }

    public List<ConversationAgentPreviewMessage> History { get; init; } = [];

    public string? Reply { get; set; }

    public string? Error { get; set; }

    public string? ExecutionMode { get; set; }

    public string Status { get; set; } = "Completed";

    public long ElapsedMilliseconds { get; set; }

    public DateTimeOffset StartedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset? FinishedAt { get; set; }

    public List<ConversationAgentPreviewStep> StepDetails { get; set; } = [];
}
