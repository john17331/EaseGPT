namespace EaseGPT.ConversationAgents;

public sealed class ConversationAgentDefinition
{
    public required string Id { get; init; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public string? Icon { get; set; }

    public string? ProviderConfigId { get; set; }

    public string? Instructions { get; set; } = "";

    public string OpeningStatement { get; set; } = "你好，我是你的 AI 助手。有什么可以帮你？";

    public List<string> SuggestedQuestions { get; set; } = [];

    public List<string> KnowledgeBaseIds { get; set; } = [];

    public string RecallRerankModel { get; set; } = "none";

    public int RecallTopK { get; set; } = 4;

    public bool RecallScoreThresholdEnabled { get; set; }

    public double RecallScoreThreshold { get; set; }

    public double Temperature { get; set; } = 0.7;

    public int MaxTokens { get; set; } = 2048;

    public bool Published { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
