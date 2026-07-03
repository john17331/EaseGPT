using System.Net.Http.Headers;
using System.Text.Json;
using EaseGPT.Workflows.Nodes.Llm;
using Microsoft.AspNetCore.Mvc;

namespace EaseGPT.Controllers;

[ApiController]
[Route("api/llm-providers")]
public sealed class LlmProvidersController : ControllerBase
{
    private readonly ILlmProviderDefinitionStore _providerStore;
    private readonly ILlmProviderConfigStore _configStore;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILlmModelMetadataResolver _metadataResolver;

    public LlmProvidersController(
        ILlmProviderDefinitionStore providerStore,
        ILlmProviderConfigStore configStore,
        IHttpClientFactory httpClientFactory,
        ILlmModelMetadataResolver metadataResolver)
    {
        _providerStore = providerStore;
        _configStore = configStore;
        _httpClientFactory = httpClientFactory;
        _metadataResolver = metadataResolver;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<LlmProviderDefinitionView>>> List(
        CancellationToken cancellationToken)
    {
        var providers = await _providerStore.ListAsync(cancellationToken);
        return Ok(providers.Where(provider => provider.Enabled)
            .Select(LlmProviderDefinitionView.FromProvider)
            .ToList());
    }

    [HttpPost("{id}/models")]
    public async Task<ActionResult<IReadOnlyCollection<string>>> DiscoverModels(
        string id,
        DiscoverProviderModelsDto request,
        CancellationToken cancellationToken)
    {
        var provider = await _providerStore.GetAsync(id, cancellationToken);
        if (provider is null || !provider.Enabled) return NotFound();

        var apiKey = string.IsNullOrWhiteSpace(request.ApiKey) ? provider.DefaultApiKey : request.ApiKey.Trim();
        try
        {
            var models = await FetchModelsAsync(provider.ApiAddress, apiKey, cancellationToken);
            return Ok(models);
        }
        catch (HttpRequestException exception)
        {
            return BadRequest($"读取模型列表失败：{exception.Message}");
        }
        catch (JsonException)
        {
            return BadRequest("供应商返回的模型列表格式无法识别。");
        }
    }

    [HttpPost("{id}/enable")]
    public async Task<ActionResult<EnableProviderResult>> Enable(
        string id,
        EnableProviderDto request,
        CancellationToken cancellationToken)
    {
        var provider = await _providerStore.GetAsync(id, cancellationToken);
        if (provider is null || !provider.Enabled) return NotFound();

        var apiKey = string.IsNullOrWhiteSpace(request.ApiKey) ? provider.DefaultApiKey : request.ApiKey.Trim();
        if (!string.IsNullOrWhiteSpace(request.ApiKey))
        {
            provider.DefaultApiKey = request.ApiKey.Trim();
            await _providerStore.SaveAsync(provider, cancellationToken);
        }

        IReadOnlyCollection<string> models;
        try
        {
            models = await FetchModelsAsync(provider.ApiAddress, apiKey, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            return BadRequest($"读取模型列表失败：{exception.Message}");
        }
        catch (JsonException)
        {
            return BadRequest("供应商返回的模型列表格式无法识别。");
        }

        if (models.Count == 0) return BadRequest("未读取到可用模型。");

        var existingConfigs = await _configStore.ListAsync(cancellationToken);
        var existingModels = existingConfigs
            .Where(config => string.Equals(config.Provider, provider.Id, StringComparison.OrdinalIgnoreCase))
            .Where(config => !string.IsNullOrWhiteSpace(config.Model) || !string.IsNullOrWhiteSpace(config.Name))
            .Select(config => (config.Model ?? config.Name).Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var savedConfigs = new List<LlmProviderConfigView>();
        foreach (var model in models)
        {
            if (existingModels.Contains(model)) continue;

            var metadata = _metadataResolver.Resolve(model);
            var config = new LlmProviderConfig
            {
                Id = $"{provider.Id}-{Slugify(model)}",
                Name = model,
                Provider = provider.Id,
                Endpoint = BuildChatEndpoint(provider.ApiAddress),
                Model = model,
                ModelType = metadata.ModelType,
                ModelCapabilities = metadata.Capabilities.ToList(),
                ApiKey = apiKey,
                ApiKeyEnvironmentVariable = null,
                Temperature = 0.7,
                Enabled = false,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _configStore.SaveAsync(config, cancellationToken);
            savedConfigs.Add(LlmProviderConfigView.FromConfig(config));
            existingModels.Add(model);
        }

        return Ok(new EnableProviderResult
        {
            Provider = LlmProviderDefinitionView.FromProvider(provider),
            Configs = savedConfigs
        });
    }

    private async Task<IReadOnlyCollection<string>> FetchModelsAsync(
        string apiAddress,
        string? apiKey,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        using var message = new HttpRequestMessage(HttpMethod.Get, BuildModelsEndpoint(apiAddress));
        if (!string.IsNullOrWhiteSpace(apiKey))
        {
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }

        using var response = await client.SendAsync(message, cancellationToken);
        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"供应商返回 {(int)response.StatusCode} {response.ReasonPhrase}。");
        }

        using var document = JsonDocument.Parse(content);
        var root = document.RootElement;
        var list = root.ValueKind == JsonValueKind.Array
            ? root
            : root.TryGetProperty("data", out var data) ? data : default;
        if (list.ValueKind != JsonValueKind.Array) throw new JsonException();

        return list.EnumerateArray()
            .Select(item => item.ValueKind == JsonValueKind.String
                ? item.GetString()
                : item.TryGetProperty("id", out var modelId) ? modelId.GetString() : null)
            .Where(model => !string.IsNullOrWhiteSpace(model))
            .Select(model => model!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(model => model)
            .ToList();
    }

    private static string BuildModelsEndpoint(string apiAddress)
    {
        var value = apiAddress.TrimEnd('/');
        if (value.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase))
        {
            value = value[..^"/chat/completions".Length];
        }
        return $"{value}/models";
    }

    private static string BuildChatEndpoint(string apiAddress)
    {
        var value = apiAddress.TrimEnd('/');
        return value.EndsWith("/chat/completions", StringComparison.OrdinalIgnoreCase)
            ? value
            : $"{value}/chat/completions";
    }

    private static string Slugify(string value)
    {
        var builder = new System.Text.StringBuilder(value.Length);
        var lastDash = false;
        foreach (var character in value.ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
                lastDash = false;
            }
            else if (!lastDash)
            {
                builder.Append('-');
                lastDash = true;
            }
        }

        return builder.ToString().Trim('-');
    }
}
