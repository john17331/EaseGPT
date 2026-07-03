namespace EaseGPT.Workflows.Nodes.Llm;

public sealed record LlmProviderPreset(
    string Provider,
    string Adapter,
    string DefaultEndpoint,
    string DefaultApiKeyEnvironmentVariable);
