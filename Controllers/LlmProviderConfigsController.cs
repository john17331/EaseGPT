using EaseGPT.Workflows.Nodes.Llm;
using Microsoft.AspNetCore.Mvc;

namespace EaseGPT.Controllers;

[ApiController]
[Route("api/llm-provider-configs")]
public sealed class LlmProviderConfigsController : ControllerBase
{
    private readonly ILlmProviderConfigStore _store;
    private readonly ILlmModelMetadataResolver _metadataResolver;

    public LlmProviderConfigsController(
        ILlmProviderConfigStore store,
        ILlmModelMetadataResolver metadataResolver)
    {
        _store = store;
        _metadataResolver = metadataResolver;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<LlmProviderConfigView>>> List(CancellationToken cancellationToken)
    {
        var configs = await _store.ListAsync(cancellationToken);
        return Ok(configs.Select(LlmProviderConfigView.FromConfig).ToList());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<LlmProviderConfigView>> Get(string id, CancellationToken cancellationToken)
    {
        var config = await _store.GetAsync(id, cancellationToken);
        return config is null ? NotFound() : Ok(LlmProviderConfigView.FromConfig(config));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<LlmProviderConfigView>> Save(
        string id,
        SaveLlmProviderConfigDto request,
        CancellationToken cancellationToken)
    {
        var existing = await _store.GetAsync(id, cancellationToken);
        var metadata = _metadataResolver.Resolve(request.Model ?? request.Name);
        var config = new LlmProviderConfig
        {
            Id = id,
            Name = request.Name,
            Provider = request.Provider,
            Endpoint = request.Endpoint,
            Model = request.Model,
            ModelType = ResolveModelType(metadata, request.ModelType),
            ModelCapabilities = metadata.Capabilities.ToList(),
            ContextLength = NormalizeContextLength(request.ContextLength),
            ApiKey = string.IsNullOrWhiteSpace(request.ApiKey) ? existing?.ApiKey : request.ApiKey,
            ApiKeyEnvironmentVariable = request.ApiKeyEnvironmentVariable,
            Temperature = request.Temperature,
            Enabled = request.Enabled,
            CreatedAt = existing?.CreatedAt ?? DateTimeOffset.UtcNow
        };

        await _store.SaveAsync(config, cancellationToken);
        return Ok(LlmProviderConfigView.FromConfig(config));
    }

    [HttpPost]
    public async Task<ActionResult<LlmProviderConfigView>> Create(
        SaveLlmProviderConfigDto request,
        CancellationToken cancellationToken)
    {
        var id = GenerateId(request.Name, request.Provider);
        if (await _store.GetAsync(id, cancellationToken) is not null)
        {
            id = $"{id}-{Guid.NewGuid():N[..8]}";
        }

        var metadata = _metadataResolver.Resolve(request.Model ?? request.Name);
        var config = new LlmProviderConfig
        {
            Id = id,
            Name = request.Name,
            Provider = request.Provider,
            Endpoint = request.Endpoint,
            Model = request.Model,
            ModelType = ResolveModelType(metadata, request.ModelType),
            ModelCapabilities = metadata.Capabilities.ToList(),
            ContextLength = NormalizeContextLength(request.ContextLength),
            ApiKey = request.ApiKey,
            ApiKeyEnvironmentVariable = request.ApiKeyEnvironmentVariable,
            Temperature = request.Temperature,
            Enabled = request.Enabled,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await _store.SaveAsync(config, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id }, LlmProviderConfigView.FromConfig(config));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        if (await _store.GetAsync(id, cancellationToken) is null) return NotFound();
        await _store.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    private static string GenerateId(string name, string provider)
    {
        var raw = $"{provider}-{name}".Trim().ToLowerInvariant();
        var builder = new System.Text.StringBuilder(raw.Length);
        var lastDash = false;
        foreach (var ch in raw)
        {
            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(ch);
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

    private static string ResolveModelType(LlmModelMetadata metadata, string? requestedModelType)
    {
        if (!string.IsNullOrWhiteSpace(metadata.ModelType)
            && !string.Equals(metadata.ModelType, "llm", StringComparison.Ordinal))
        {
            return metadata.ModelType;
        }

        return string.IsNullOrWhiteSpace(requestedModelType)
            ? "llm"
            : requestedModelType.Trim().ToLowerInvariant();
    }

    private static int NormalizeContextLength(int? contextLength)
        => contextLength is > 0 ? contextLength.Value : 4096;
}
