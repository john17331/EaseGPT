namespace EaseGPT.Knowledge;

public sealed class RagOptions
{
    public const string SectionName = "Rag";
    public string StoragePath { get; set; } = "Data/knowledge-files";
    public string LanceDbPath { get; set; } = "Data/lancedb";
    public int ChunkSize { get; set; } = 1024;
    public int ChunkOverlap { get; set; } = 100;
    public ModelOptions Embedding { get; set; } = new() { Provider = "local-hash", Dimensions = 384 };
    public ModelOptions Chat { get; set; } = new() { Provider = "extractive" };
}

public sealed class ModelOptions
{
    public string Provider { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string? ApiKeyEnvironmentVariable { get; set; }
    public int Dimensions { get; set; } = 384;
    public double Temperature { get; set; } = 0.2;

    public string ResolveApiKey() => !string.IsNullOrWhiteSpace(ApiKeyEnvironmentVariable)
        ? Environment.GetEnvironmentVariable(ApiKeyEnvironmentVariable) ?? ApiKey
        : ApiKey;
}
