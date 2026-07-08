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

    public IReadOnlyCollection<LlmToolDefinition> Tools { get; init; } = [];

    public string? ToolChoice { get; init; }
}

public sealed class LlmChatMessage
{
    public string Role { get; init; } = "user";

    public string Content { get; init; } = string.Empty;

    public string? Name { get; init; }

    public string? ToolCallId { get; init; }

    public IReadOnlyCollection<LlmToolCall> ToolCalls { get; init; } = [];
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

    public IReadOnlyCollection<LlmToolCall> ToolCalls { get; init; } = [];

    public required string Provider { get; init; }

    public required string Model { get; init; }
}

public sealed class LlmChatStreamDelta
{
    public string? Text { get; init; }

    public string? ReasoningContent { get; init; }
}

public sealed class LlmToolDefinition
{
    public string Type { get; init; } = "function";

    public required LlmToolFunctionDefinition Function { get; init; }
}

public sealed class LlmToolFunctionDefinition
{
    public required string Name { get; init; }

    public string Description { get; init; } = string.Empty;

    public IReadOnlyDictionary<string, object?> Parameters { get; init; }
        = new Dictionary<string, object?>();
}

public sealed class LlmToolCall
{
    public string Id { get; init; } = string.Empty;

    public string Type { get; init; } = "function";

    public required LlmToolCallFunction Function { get; init; }
}

public sealed class LlmToolCallFunction
{
    public required string Name { get; init; }

    public string Arguments { get; init; } = "{}";
}
