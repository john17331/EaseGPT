namespace EaseGPT.Workflows.Nodes.Llm;

public sealed class LlmProviderConfig
{
    public required string Id { get; init; }

    public required string Name { get; set; }

    public required string Provider { get; set; }

    public string? Endpoint { get; set; }

    public string? Model { get; set; }

    public string ModelType { get; set; } = "llm";

    public List<string> ModelCapabilities { get; set; } = [];

    public int ContextLength { get; set; } = 4096;

    public string? ApiKey { get; set; }

    public string? ApiKeyEnvironmentVariable { get; set; }

    public double? Temperature { get; set; }

    public bool Enabled { get; set; } = true;

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class LlmProviderConfigView
{
    public required string Id { get; init; }

    public required string Name { get; init; }

    public required string Provider { get; init; }

    public string? Endpoint { get; init; }

    public string? Model { get; init; }

    public string ModelType { get; init; } = "llm";

    public IReadOnlyList<string> ModelCapabilities { get; init; } = [];

    public int ContextLength { get; init; } = 4096;

    public bool HasApiKey { get; init; }

    public string? ApiKeyEnvironmentVariable { get; init; }

    public double? Temperature { get; init; }

    public bool Enabled { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }

    public static LlmProviderConfigView FromConfig(LlmProviderConfig config)
        => new()
        {
            Id = config.Id,
            Name = config.Name,
            Provider = config.Provider,
            Endpoint = config.Endpoint,
            Model = config.Model,
            ModelType = string.IsNullOrWhiteSpace(config.ModelType) ? "llm" : config.ModelType,
            ModelCapabilities = (config.ModelCapabilities ?? [])
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim().ToLowerInvariant())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray(),
            ContextLength = config.ContextLength > 0 ? config.ContextLength : 4096,
            HasApiKey = !string.IsNullOrWhiteSpace(config.ApiKey),
            ApiKeyEnvironmentVariable = config.ApiKeyEnvironmentVariable,
            Temperature = config.Temperature,
            Enabled = config.Enabled,
            CreatedAt = config.CreatedAt,
            UpdatedAt = config.UpdatedAt
        };
}
