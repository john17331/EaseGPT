using System.Text.Json;

namespace EaseGPT.Workflows.Nodes.Llm;

public interface ILlmModelMetadataResolver
{
    LlmModelMetadata Resolve(string? modelName);
}

public sealed class LlmModelMetadataResolver : ILlmModelMetadataResolver
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IReadOnlyList<LlmModelMetadataRule> _rules;

    public LlmModelMetadataResolver(IWebHostEnvironment environment)
    {
        var path = Path.Combine(environment.ContentRootPath, "Data", "model-metadata.json");
        _rules = LoadRules(path);
    }

    public LlmModelMetadata Resolve(string? modelName)
    {
        var normalizedName = NormalizeValue(modelName);
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return new LlmModelMetadata("llm", []);
        }

        var exactMatch = _rules.FirstOrDefault(rule =>
            !string.IsNullOrWhiteSpace(rule.ModelName)
            && string.Equals(NormalizeValue(rule.ModelName), normalizedName, StringComparison.Ordinal));
        if (exactMatch is not null)
        {
            return new LlmModelMetadata(
                NormalizeModelType(exactMatch.ModelType),
                NormalizeCapabilities(exactMatch.Capabilities));
        }

        var patternMatch = _rules
            .Where(rule => !string.IsNullOrWhiteSpace(rule.Pattern))
            .OrderByDescending(rule => rule.Pattern!.Length)
            .FirstOrDefault(rule => normalizedName.Contains(NormalizeValue(rule.Pattern), StringComparison.Ordinal));
        if (patternMatch is not null)
        {
            return new LlmModelMetadata(
                NormalizeModelType(patternMatch.ModelType),
                NormalizeCapabilities(patternMatch.Capabilities));
        }

        return InferFromModelName(normalizedName);
    }

    private static IReadOnlyList<LlmModelMetadataRule> LoadRules(string path)
    {
        if (!File.Exists(path)) return [];

        try
        {
            var content = File.ReadAllText(path);
            return JsonSerializer.Deserialize<List<LlmModelMetadataRule>>(content, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static LlmModelMetadata InferFromModelName(string normalizedName)
    {
        var modelType = InferModelType(normalizedName);
        var capabilities = new List<string>();

        if (ContainsAny(normalizedName, "vision", "visual", "vl", "gpt-4o", "gpt-4.1", "gemini", "claude-3", "claude-sonnet-4", "qvq", "minicpm-v"))
        {
            capabilities.Add("vision");
        }

        if (ContainsAny(normalizedName, "video", "veo", "cogvideo", "hunyuanvideo", "wanx", "wan2.1"))
        {
            capabilities.Add("video");
        }

        return new LlmModelMetadata(modelType, NormalizeCapabilities(capabilities));
    }

    private static string InferModelType(string normalizedName)
    {
        if (ContainsAny(normalizedName, "embedding", "text-embedding", "bge-m3", "bge-large", "e5-", "text2vec"))
        {
            return "text-embedding";
        }

        if (ContainsAny(normalizedName, "rerank", "bge-reranker", "m3e-reranker"))
        {
            return "rerank";
        }

        if (ContainsAny(normalizedName, "speech2text", "speech-to-text", "stt", "asr", "whisper", "transcribe"))
        {
            return "speech2text";
        }

        if (ContainsAny(normalizedName, "text-to-speech", "tts", "speech-", "cosyvoice", "fish-speech"))
        {
            return "tts";
        }

        return "llm";
    }

    private static bool ContainsAny(string value, params string[] keywords)
        => keywords.Any(keyword => value.Contains(NormalizeValue(keyword), StringComparison.Ordinal));

    private static string NormalizeValue(string? value)
        => (value ?? string.Empty).Trim().ToLowerInvariant();

    private static string NormalizeModelType(string? value)
        => string.IsNullOrWhiteSpace(value) ? "llm" : NormalizeValue(value);

    private static IReadOnlyList<string> NormalizeCapabilities(IEnumerable<string>? values)
        => (values ?? [])
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(NormalizeValue)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
}

public sealed record LlmModelMetadata(string ModelType, IReadOnlyList<string> Capabilities);

public sealed class LlmModelMetadataRule
{
    public string? ModelName { get; init; }

    public string? Pattern { get; init; }

    public string? ModelType { get; init; }

    public List<string>? Capabilities { get; init; }
}
