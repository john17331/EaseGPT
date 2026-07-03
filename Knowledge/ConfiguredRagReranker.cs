using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using EaseGPT.Workflows.Nodes.Llm;

namespace EaseGPT.Knowledge;

public sealed class ConfiguredRagReranker : IRagReranker
{
    private readonly ILlmProviderConfigStore _configStore;
    private readonly IHttpClientFactory _clients;

    public ConfiguredRagReranker(
        ILlmProviderConfigStore configStore,
        IHttpClientFactory clients)
    {
        _configStore = configStore;
        _clients = clients;
    }

    public async Task<IReadOnlyList<(string ChunkId, double Score)>> RerankAsync(
        string rerankModelConfigId,
        string question,
        IReadOnlyList<KnowledgeChunk> candidates,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rerankModelConfigId))
        {
            throw new InvalidOperationException("未配置 Rerank 模型。");
        }

        if (candidates.Count == 0) return [];

        var config = await _configStore.GetAsync(rerankModelConfigId, cancellationToken)
            ?? throw new InvalidOperationException("所选 Rerank 模型不存在。");

        if (!string.Equals(config.ModelType, "rerank", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("所选模型不是 Rerank 模型。");
        }

        var apiKey = ResolveApiKey(config);
        var endpoint = BuildRerankEndpoint(config.Endpoint);
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }

        request.Content = JsonContent.Create(new
        {
            model = config.Model,
            query = question,
            documents = candidates.Select(item => item.Text).ToArray(),
            top_n = Math.Min(candidates.Count, 50),
            return_documents = false
        });

        using var response = await _clients.CreateClient("rag-models").SendAsync(request, cancellationToken);
        var json = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(BuildRequestErrorMessage(
                endpoint,
                config.Model,
                response.StatusCode,
                response.ReasonPhrase,
                json));
        }

        using var document = JsonDocument.Parse(json);
        var results = FindResultsArray(document.RootElement);
        if (results.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("Rerank 返回格式无法识别。");
        }

        var ranked = new List<(string ChunkId, double Score)>();
        var fallbackScore = results.GetArrayLength();
        foreach (var item in results.EnumerateArray())
        {
            var index = ReadIndex(item);
            if (index < 0 || index >= candidates.Count) continue;
            var score = ReadScore(item, fallbackScore--);
            ranked.Add((candidates[index].Id, score));
        }

        return ranked;
    }

    private static JsonElement FindResultsArray(JsonElement root)
    {
        if (root.ValueKind == JsonValueKind.Array) return root;
        if (root.TryGetProperty("results", out var results)) return results;
        if (root.TryGetProperty("data", out var data)) return data;
        return default;
    }

    private static int ReadIndex(JsonElement item)
    {
        if (item.TryGetProperty("index", out var index)) return index.GetInt32();
        if (item.TryGetProperty("document_index", out var documentIndex)) return documentIndex.GetInt32();
        return -1;
    }

    private static double ReadScore(JsonElement item, int fallbackScore)
    {
        if (item.TryGetProperty("relevance_score", out var relevanceScore)) return relevanceScore.GetDouble();
        if (item.TryGetProperty("score", out var score)) return score.GetDouble();
        return fallbackScore;
    }

    private static string BuildRerankEndpoint(string? endpoint)
    {
        if (string.IsNullOrWhiteSpace(endpoint))
        {
            throw new InvalidOperationException("Rerank 模型未配置接口地址。");
        }

        var value = endpoint.TrimEnd('/');
        if (value.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase))
        {
            value = value[..^"/chat/completions".Length];
        }

        return value.EndsWith("/rerank", StringComparison.OrdinalIgnoreCase)
            ? value
            : $"{value}/rerank";
    }

    private static string? ResolveApiKey(LlmProviderConfig config)
    {
        if (!string.IsNullOrWhiteSpace(config.ApiKey)) return config.ApiKey;
        if (string.IsNullOrWhiteSpace(config.ApiKeyEnvironmentVariable)) return null;
        return Environment.GetEnvironmentVariable(config.ApiKeyEnvironmentVariable);
    }

    private static string BuildRequestErrorMessage(
        string endpoint,
        string? model,
        System.Net.HttpStatusCode statusCode,
        string? reasonPhrase,
        string? responseBody)
    {
        var details = string.IsNullOrWhiteSpace(responseBody)
            ? $"未返回响应正文。可能是接口地址不支持 Rerank，请检查 Endpoint 是否正确：{endpoint}"
            : responseBody.Trim();

        return $"Rerank 请求失败 ({(int)statusCode} {reasonPhrase ?? "Unknown"}).\n模型：{model ?? "未配置"}\n地址：{endpoint}\n详情：{details}";
    }
}
