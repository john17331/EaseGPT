namespace EaseGPT.Workflows.Nodes.Llm;

public sealed class LlmProviderDefinition
{
    public required string Id { get; init; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public required string ApiAddress { get; set; }

    public string? DefaultApiKey { get; set; }

    public bool Enabled { get; set; } = true;

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class LlmProviderDefinitionView
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public string? Description { get; init; }

    public required string ApiAddress { get; init; }

    public bool HasDefaultApiKey { get; init; }

    public bool Enabled { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }

    public static LlmProviderDefinitionView FromProvider(LlmProviderDefinition provider)
        => new()
        {
            Id = provider.Id,
            Name = provider.Name,
            Description = provider.Description,
            ApiAddress = provider.ApiAddress,
            HasDefaultApiKey = !string.IsNullOrWhiteSpace(provider.DefaultApiKey),
            Enabled = provider.Enabled,
            UpdatedAt = provider.UpdatedAt
        };
}
