namespace EaseGPT.Workflows.Nodes.Llm;

public sealed class LlmChatRequest
{
    public required string Provider { get; init; }

    public required string Model { get; init; }

    public required string Endpoint { get; init; }

    public required string ApiKey { get; init; }

    public double Temperature { get; init; } = 0.7;

    public string ImageDetail { get; init; } = "high";

    public bool Stream { get; init; } = true;

    public IReadOnlyCollection<LlmChatMessage> Messages { get; init; } = [];

    public IReadOnlyCollection<LlmChatFile> Files { get; init; } = [];
}

public sealed class LlmChatMessage
{
    public string Role { get; init; } = "user";

    public string Content { get; init; } = string.Empty;
}

public sealed class LlmChatFile
{
    public string Name { get; init; } = "file";

    public string MimeType { get; init; } = "text/plain";

    public string? Url { get; init; }

    public string? Base64 { get; init; }

    public string? Text { get; init; }

    public string? Detail { get; init; }
}

public sealed class LlmChatResponse
{
    public required string Text { get; init; }

    public required string RawResponse { get; init; }

    public string? ReasoningContent { get; init; }

    public required string Provider { get; init; }

    public required string Model { get; init; }
}

public sealed class LlmChatStreamDelta
{
    public string? Text { get; init; }

    public string? ReasoningContent { get; init; }
}
