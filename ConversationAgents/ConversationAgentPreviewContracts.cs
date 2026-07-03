namespace EaseGPT.ConversationAgents;

public sealed record ConversationAgentPreviewMessage(string Role, string Content);

public sealed record ConversationAgentPreviewRequest(
    ConversationAgentDefinition Agent,
    string Message,
    IReadOnlyList<ConversationAgentPreviewMessage>? History);

public sealed record ConversationAgentPreviewStep(
    string Message,
    long ElapsedMilliseconds);

public sealed record ConversationAgentPreviewStreamEvent(
    string Type,
    long ElapsedMilliseconds,
    IReadOnlyList<ConversationAgentPreviewStep> Steps,
    string? Reply,
    string? Error);

public sealed record ConversationAgentPreviewResponse(
    string Reply,
    long ElapsedMilliseconds,
    IReadOnlyList<string> Steps,
    IReadOnlyList<ConversationAgentPreviewStep> StepDetails);
