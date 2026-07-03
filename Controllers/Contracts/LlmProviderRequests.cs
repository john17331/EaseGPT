using EaseGPT.Workflows.Nodes.Llm;

namespace EaseGPT.Controllers;

public sealed class SaveLlmProviderConfigDto
{
    public required string Name { get; init; }

    public required string Provider { get; init; }

    public string? Endpoint { get; init; }

    public string? Model { get; init; }

    public string? ModelType { get; init; }

    public int? ContextLength { get; init; }

    public string? ApiKey { get; init; }

    public string? ApiKeyEnvironmentVariable { get; init; }

    public double? Temperature { get; init; }

    public bool Enabled { get; init; } = true;
}

public sealed class DiscoverProviderModelsDto
{
    public string? ApiKey { get; init; }
}

public sealed class EnableProviderDto
{
    public string? ApiKey { get; init; }
}

public sealed class EnableProviderResult
{
    public required LlmProviderDefinitionView Provider { get; init; }

    public required IReadOnlyCollection<LlmProviderConfigView> Configs { get; init; }
}
