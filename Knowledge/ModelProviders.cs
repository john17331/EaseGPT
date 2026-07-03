using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using EaseGPT.Workflows.Nodes.Llm;
using Microsoft.Extensions.Options;

namespace EaseGPT.Knowledge;

public sealed partial class ConfiguredEmbeddingModel : IEmbeddingModel
{
    private readonly ModelOptions _options;
    private readonly IHttpClientFactory _clients;
    private readonly ILlmProviderConfigStore _configStore;
    private readonly ILogger<ConfiguredEmbeddingModel> _logger;

    public ConfiguredEmbeddingModel(
        IOptions<RagOptions> options,
        IHttpClientFactory clients,
        ILlmProviderConfigStore configStore,
        ILogger<ConfiguredEmbeddingModel> logger)
    {
        _options = options.Value.Embedding;
        _clients = clients;
        _configStore = configStore;
        _logger = logger;
    }

    public Task<IReadOnlyList<float[]>> EmbedAsync(string embeddingModel, IReadOnlyList<string> texts, CancellationToken ct)
    {
        if (string.Equals(embeddingModel, "system-default", StringComparison.OrdinalIgnoreCase))
        {
            return _options.Provider.Equals("local-hash", StringComparison.OrdinalIgnoreCase)
                ? Task.FromResult<IReadOnlyList<float[]>>(texts.Select(HashEmbed).ToList())
                : EmbedRemoteAsync(_options.Endpoint, _options.Model, _options.ResolveApiKey(), texts, _options.Dimensions, ct);
        }

        return EmbedConfiguredModelAsync(embeddingModel, texts, ct);
    }

    private float[] HashEmbed(string text)
    {
        var dimensions = Math.Clamp(_options.Dimensions, 32, 4096);
        var vector = new float[dimensions];
        var normalized = text.ToLowerInvariant();
        var tokens = TokenRegex().Matches(normalized).Select(x => x.Value).ToList();
        foreach (var token in tokens.Concat(CharacterNgrams(normalized)))
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
            var index = BitConverter.ToUInt32(bytes, 0) % (uint)dimensions;
            vector[index] += 1f;
        }
        Normalize(vector);
        return vector;
    }

    private async Task<IReadOnlyList<float[]>> EmbedConfiguredModelAsync(
        string embeddingModel,
        IReadOnlyList<string> texts,
        CancellationToken ct)
    {
        var config = await _configStore.GetAsync(embeddingModel, ct)
            ?? throw new InvalidOperationException("所选 Embedding 模型不存在。");

        if (!string.Equals(config.ModelType, "text-embedding", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("所选模型不是 Embedding 模型。");
        }

        _logger.LogInformation(
            "Using configured embedding model {EmbeddingModelConfigId}. Provider={Provider}, Model={Model}, Endpoint={Endpoint}, ContextLength={ContextLength}, HasApiKey={HasApiKey}",
            embeddingModel,
            config.Provider,
            config.Model,
            config.Endpoint,
            config.ContextLength,
            !string.IsNullOrWhiteSpace(config.ApiKey) || !string.IsNullOrWhiteSpace(config.ApiKeyEnvironmentVariable));

        return await EmbedRemoteAsync(
            BuildEmbeddingEndpoint(config.Endpoint),
            config.Model,
            ResolveApiKey(config),
            texts,
            config.ContextLength,
            ct);
    }

    private async Task<IReadOnlyList<float[]>> EmbedRemoteAsync(
        string? endpoint,
        string? model,
        string? apiKey,
        IReadOnlyList<string> texts,
        int expectedDimensions,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(endpoint)) throw new InvalidOperationException("Embedding 接口地址未配置。");
        _logger.LogInformation(
            "Calling embedding endpoint {Endpoint} with model {Model}. TextCount={TextCount}, ExpectedDimensions={ExpectedDimensions}, HasApiKey={HasApiKey}",
            endpoint,
            model,
            texts.Count,
            expectedDimensions,
            !string.IsNullOrWhiteSpace(apiKey));
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = JsonContent.Create(new { model, input = texts });
        using var response = await _clients.CreateClient("rag-models").SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Embedding request failed. Endpoint={Endpoint}, Model={Model}, StatusCode={StatusCode}, ResponseSnippet={ResponseSnippet}",
                endpoint,
                model,
                (int)response.StatusCode,
                TrimForLog(json));
            throw new InvalidOperationException($"Embedding 请求失败 ({(int)response.StatusCode}): {json}");
        }

        using var document = JsonDocument.Parse(json);
        var vectors = document.RootElement.GetProperty("data").EnumerateArray()
            .OrderBy(x => x.TryGetProperty("index", out var index) ? index.GetInt32() : 0)
            .Select(x => x.GetProperty("embedding").EnumerateArray().Select(v => v.GetSingle()).ToArray())
            .ToList();

        if (vectors.Count != texts.Count)
        {
            throw new InvalidOperationException("Embedding 返回数量与输入文本数量不一致。");
        }

        var vectorLength = vectors.FirstOrDefault()?.Length ?? 0;
        if (vectorLength == 0)
        {
            throw new InvalidOperationException("Embedding 返回向量为空。");
        }

        if (vectors.Any(x => x.Length != vectorLength))
        {
            throw new InvalidOperationException("Embedding 返回的向量维度不一致。");
        }

        var configuredDimensions = Math.Clamp(expectedDimensions, 0, 4096);
        if (configuredDimensions > 0 && configuredDimensions != vectorLength && string.Equals(endpoint, _options.Endpoint, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Embedding 返回维度与系统配置不一致，配置为 {configuredDimensions}，实际为 {vectorLength}。");
        }

        _logger.LogInformation(
            "Embedding response parsed successfully. Endpoint={Endpoint}, Model={Model}, VectorCount={VectorCount}, VectorLength={VectorLength}",
            endpoint,
            model,
            vectors.Count,
            vectorLength);
        return vectors;
    }

    private static string BuildEmbeddingEndpoint(string? endpoint)
    {
        if (string.IsNullOrWhiteSpace(endpoint)) throw new InvalidOperationException("Embedding 模型未配置接口地址。");

        var value = endpoint.TrimEnd('/');
        if (value.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase))
        {
            value = value[..^"/chat/completions".Length];
        }

        return value.EndsWith("/embeddings", StringComparison.OrdinalIgnoreCase)
            ? value
            : $"{value}/embeddings";
    }

    private static string? ResolveApiKey(LlmProviderConfig config)
    {
        if (!string.IsNullOrWhiteSpace(config.ApiKey)) return config.ApiKey;
        if (string.IsNullOrWhiteSpace(config.ApiKeyEnvironmentVariable)) return null;
        return Environment.GetEnvironmentVariable(config.ApiKeyEnvironmentVariable);
    }

    private static string TrimForLog(string value)
    {
        const int maxLength = 600;
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var normalized = value.ReplaceLineEndings(" ");
        return normalized.Length <= maxLength ? normalized : $"{normalized[..maxLength]}...";
    }

    private static IEnumerable<string> CharacterNgrams(string value)
    {
        var compact = WhitespaceRegex().Replace(value, string.Empty);
        for (var i = 0; i + 1 < compact.Length; i++) yield return compact.Substring(i, Math.Min(3, compact.Length - i));
    }

    private static void Normalize(float[] vector)
    {
        var norm = Math.Sqrt(vector.Sum(x => x * x));
        if (norm <= 0) return;
        for (var i = 0; i < vector.Length; i++) vector[i] = (float)(vector[i] / norm);
    }

    [GeneratedRegex(@"[\p{L}\p{N}_-]+", RegexOptions.CultureInvariant)]
    private static partial Regex TokenRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}

public sealed class ConfiguredRagChatModel : IRagChatModel
{
    private readonly ModelOptions _options;
    private readonly IHttpClientFactory _clients;

    public ConfiguredRagChatModel(IOptions<RagOptions> options, IHttpClientFactory clients)
    {
        _options = options.Value.Chat;
        _clients = clients;
    }

    public async Task<string> AnswerAsync(string question, IReadOnlyList<RetrievedChunk> context, CancellationToken ct)
    {
        if (_options.Provider.Equals("extractive", StringComparison.OrdinalIgnoreCase))
        {
            return context.Count == 0
                ? "知识库中没有找到足够相关的内容。"
                : $"根据知识库资料：\n\n{string.Join("\n\n", context.Take(3).Select(x => x.Chunk.Text))}";
        }

        if (string.IsNullOrWhiteSpace(_options.Endpoint)) throw new InvalidOperationException("Rag:Chat:Endpoint 未配置。");

        var contextText = string.Join("\n\n", context.Select((x, i) => $"[来源{i + 1}: {x.Chunk.FileName} / 分段{x.Chunk.Index}]\n{x.Chunk.Text}"));
        using var request = new HttpRequestMessage(HttpMethod.Post, _options.Endpoint);
        var apiKey = _options.ResolveApiKey();
        if (!string.IsNullOrWhiteSpace(apiKey)) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = JsonContent.Create(new
        {
            model = _options.Model,
            temperature = _options.Temperature,
            messages = new object[]
            {
                new { role = "system", content = "你是知识库问答助手。只能依据给定资料回答；资料不足时明确说明。回答应准确简洁，并使用[来源N]标注依据。" },
                new { role = "user", content = $"资料：\n{contextText}\n\n问题：{question}" }
            }
        });
        using var response = await _clients.CreateClient("rag-models").SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Chat 请求失败 ({(int)response.StatusCode}): {json}");
        using var document = JsonDocument.Parse(json);
        return document.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
    }
}
