using EaseGPT.Knowledge;
using EaseGPT.Workflows.Nodes.Llm;
using Microsoft.AspNetCore.Mvc;

namespace EaseGPT.Controllers;

[ApiController]
[Route("api/knowledge-bases")]
public sealed class KnowledgeBasesController : ControllerBase
{
    private readonly IKnowledgeStore _store;
    private readonly LocalFileStore _files;
    private readonly IKnowledgeVectorStore _vectors;
    private readonly ILlmProviderConfigStore _providerConfigStore;
    private readonly KnowledgeIngestionQueue _queue;
    private readonly RagService _rag;
    private readonly RagOptions _options;

    public KnowledgeBasesController(
        IKnowledgeStore store,
        LocalFileStore files,
        IKnowledgeVectorStore vectors,
        ILlmProviderConfigStore providerConfigStore,
        KnowledgeIngestionQueue queue,
        RagService rag,
        IConfiguration configuration)
    {
        (_store, _files, _vectors, _providerConfigStore, _queue, _rag) =
            (store, files, vectors, providerConfigStore, queue, rag);
        _options = configuration.GetSection(RagOptions.SectionName).Get<RagOptions>() ?? new RagOptions();
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<KnowledgeBase>>> List(CancellationToken ct)
        => Ok(await _store.ListBasesAsync(ct));

    [HttpPost]
    public async Task<ActionResult<KnowledgeBase>> Create(CreateKnowledgeBaseRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("名称不能为空。");
        }

        var item = new KnowledgeBase
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? null : request.Icon.Trim()
        };

        ApplySettings(item, request);
        await _store.SaveBaseAsync(item, ct);
        return CreatedAtAction(nameof(Get), new { id = item.Id }, item);
    }

    [HttpGet("config-options")]
    public async Task<ActionResult<object>> GetConfigOptions(CancellationToken ct)
    {
        var configuredName = string.IsNullOrWhiteSpace(_options.Embedding.Model)
            ? _options.Embedding.Provider
            : $"{_options.Embedding.Model} · {_options.Embedding.Provider}";

        var configs = await _providerConfigStore.ListAsync(ct);

        var embeddingModels = configs
            .Where(item => item.Enabled)
            .Where(item => string.Equals(item.ModelType, "text-embedding", StringComparison.OrdinalIgnoreCase))
            .Select(CreateModelOption)
            .ToList();

        var rerankModels = configs
            .Where(item => item.Enabled)
            .Where(item => string.Equals(item.ModelType, "rerank", StringComparison.OrdinalIgnoreCase))
            .Select(CreateModelOption)
            .ToList();

        return Ok(new
        {
            embeddingModels = new object[]
            {
                new
                {
                    value = "system-default",
                    label = $"系统默认（{configuredName}）",
                    providerId = "system",
                    providerName = "系统默认",
                    modelName = configuredName,
                    tag = "Embedding",
                    recommended = true
                }
            }.Concat(embeddingModels).ToList(),
            rerankModels = new object[]
            {
                new
                {
                    value = "none",
                    label = "不使用重排",
                    providerId = "none",
                    providerName = "关闭重排",
                    modelName = "不使用重排",
                    tag = "Off",
                    recommended = true
                }
            }.Concat(rerankModels).ToList()
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<object>> Get(string id, CancellationToken ct)
    {
        var item = await _store.GetBaseAsync(id, ct);
        if (item is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            knowledgeBase = item,
            documents = await _store.ListDocumentsAsync(id, ct)
        });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<KnowledgeBase>> Update(string id, CreateKnowledgeBaseRequest request, CancellationToken ct)
    {
        var item = await _store.GetBaseAsync(id, ct);
        if (item is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest("名称不能为空。");
        }

        var settingsChanged = HasSettingsChanged(item, request);
        item.Name = request.Name.Trim();
        item.Description = request.Description?.Trim();
        item.Icon = string.IsNullOrWhiteSpace(request.Icon) ? null : request.Icon.Trim();
        ApplySettings(item, request);
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _store.SaveBaseAsync(item, ct);

        if (settingsChanged)
        {
            foreach (var document in await _store.ListDocumentsAsync(id, ct))
            {
                await _vectors.DeleteDocumentAsync(document.Id, ct);
                document.Status = KnowledgeDocumentStatus.Pending;
                document.Error = null;
                document.ChunkCount = 0;
                document.UpdatedAt = DateTimeOffset.UtcNow;
                await _store.SaveDocumentAsync(document, ct);
                await _queue.EnqueueAsync(document.Id, ct);
            }
        }

        return Ok(item);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        foreach (var document in await _store.ListDocumentsAsync(id, ct))
        {
            await _vectors.DeleteDocumentAsync(document.Id, ct);
            _files.Delete(document);
        }

        await _store.DeleteBaseAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id}/documents")]
    [RequestSizeLimit(100 * 1024 * 1024)]
    public async Task<ActionResult<KnowledgeDocument>> Upload(string id, IFormFile file, CancellationToken ct)
    {
        if (await _store.GetBaseAsync(id, ct) is null)
        {
            return NotFound();
        }

        if (file.Length == 0)
        {
            return BadRequest("文件为空。");
        }

        var document = new KnowledgeDocument
        {
            KnowledgeBaseId = id,
            FileName = Path.GetFileName(file.FileName),
            ContentType = file.ContentType
        };

        var saved = await _files.SaveAsync(id, document.Id, file, ct);
        document.StoragePath = saved.Path;
        document.Sha256 = saved.Sha256;
        document.Size = saved.Size;
        await _store.SaveDocumentAsync(document, ct);
        await _queue.EnqueueAsync(document.Id, ct);
        return AcceptedAtAction(nameof(GetDocument), new { id, documentId = document.Id }, document);
    }

    [HttpGet("{id}/documents/{documentId}")]
    public async Task<ActionResult<KnowledgeDocument>> GetDocument(string id, string documentId, CancellationToken ct)
    {
        var document = await _store.GetDocumentAsync(documentId, ct);
        return document is null || document.KnowledgeBaseId != id ? NotFound() : Ok(document);
    }

    [HttpGet("{id}/documents/{documentId}/preview")]
    public async Task<ActionResult<object>> GetDocumentPreview(string id, string documentId, CancellationToken ct)
    {
        var document = await _store.GetDocumentAsync(documentId, ct);
        if (document is null || document.KnowledgeBaseId != id)
        {
            return NotFound();
        }

        var chunks = await _store.ListDocumentChunksAsync(documentId, 0, 10, ct);
        return Ok(new
        {
            document,
            stats = new
            {
                document.ChunkCount,
                document.Size,
                document.Status,
                document.CreatedAt,
                document.UpdatedAt
            },
            chunks = chunks.Select(chunk => new
            {
                chunk.Id,
                chunk.Index,
                chunk.Heading,
                chunk.KeywordSummary,
                chunk.Text,
                chunk.StartOffset,
                chunk.EndOffset
            }).ToList()
        });
    }

    [HttpDelete("{id}/documents/{documentId}")]
    public async Task<IActionResult> DeleteDocument(string id, string documentId, CancellationToken ct)
    {
        var document = await _store.GetDocumentAsync(documentId, ct);
        if (document is null || document.KnowledgeBaseId != id)
        {
            return NotFound();
        }

        await _vectors.DeleteDocumentAsync(documentId, ct);
        await _store.DeleteDocumentAsync(documentId, ct);
        _files.Delete(document);
        return NoContent();
    }

    [HttpPost("{id}/documents/{documentId}/retry")]
    public async Task<IActionResult> RetryDocument(string id, string documentId, CancellationToken ct)
    {
        var document = await _store.GetDocumentAsync(documentId, ct);
        if (document is null || document.KnowledgeBaseId != id)
        {
            return NotFound();
        }

        document.Status = KnowledgeDocumentStatus.Pending;
        document.Error = null;
        document.UpdatedAt = DateTimeOffset.UtcNow;
        await _store.SaveDocumentAsync(document, ct);
        await _queue.EnqueueAsync(documentId, ct);
        return Accepted(document);
    }

    [HttpPost("{id}/ask")]
    public async Task<ActionResult<RagAnswer>> Ask(string id, AskKnowledgeBaseRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await _rag.AskAsync(id, request.Question, request.TopK, ct));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (ArgumentException error)
        {
            return BadRequest(error.Message);
        }
        catch (InvalidOperationException error)
        {
            return BadRequest(error.Message);
        }
    }

    [HttpPost("{id}/recall")]
    public async Task<ActionResult<RagRecallResult>> Recall(string id, AskKnowledgeBaseRequest request, CancellationToken ct)
    {
        try
        {
            return Ok(await _rag.RecallAsync(id, request.Question, request.TopK, ct));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (ArgumentException error)
        {
            return BadRequest(error.Message);
        }
        catch (InvalidOperationException error)
        {
            return BadRequest(error.Message);
        }
    }

    private static bool HasSettingsChanged(KnowledgeBase item, CreateKnowledgeBaseRequest request)
        => request.ChunkMode is not null && (
            !string.Equals(item.ChunkMode, NormalizeChunkMode(request.ChunkMode), StringComparison.Ordinal)
            || !string.Equals(item.ChunkDelimiter, NormalizeChunkDelimiter(request.ChunkDelimiter), StringComparison.Ordinal)
            || item.ChunkSize != Math.Clamp(request.ChunkSize ?? item.ChunkSize, 200, 4000)
            || item.ChunkOverlap != Math.Clamp(request.ChunkOverlap ?? item.ChunkOverlap, 0, Math.Clamp(request.ChunkSize ?? item.ChunkSize, 200, 4000) / 2)
            || !string.Equals(item.IndexMode, NormalizeIndexMode(request.IndexMode), StringComparison.Ordinal)
            || !string.Equals(item.EmbeddingModel, NormalizeEmbeddingModel(request.EmbeddingModel), StringComparison.Ordinal)
            || !string.Equals(item.RerankModel, NormalizeRerankModel(request.RerankModel), StringComparison.Ordinal));

    private static void ApplySettings(KnowledgeBase item, CreateKnowledgeBaseRequest request)
    {
        if (request.ChunkMode is null)
        {
            return;
        }

        item.ChunkMode = NormalizeChunkMode(request.ChunkMode);
        item.ChunkDelimiter = NormalizeChunkDelimiter(request.ChunkDelimiter);
        item.ChunkSize = Math.Clamp(request.ChunkSize ?? 1024, 200, 4000);
        item.ChunkOverlap = Math.Clamp(request.ChunkOverlap ?? 100, 0, item.ChunkSize / 2);
        item.IndexMode = NormalizeIndexMode(request.IndexMode);
        item.EmbeddingModel = NormalizeEmbeddingModel(request.EmbeddingModel);
        item.RerankModel = NormalizeRerankModel(request.RerankModel);
    }

    private static object CreateModelOption(LlmProviderConfig item)
        => new
        {
            value = item.Id,
            label = item.Model ?? item.Name,
            providerId = item.Provider,
            providerName = item.Provider,
            modelName = item.Model ?? item.Name,
            tag = item.ModelType,
            recommended = false
        };

    private static string NormalizeChunkMode(string? value) => value?.ToLowerInvariant() switch
    {
        "fixed" => "fixed",
        _ => "paragraph"
    };

    private static string NormalizeChunkDelimiter(string? value)
        => string.IsNullOrWhiteSpace(value) ? "\\n\\n" : value.Trim();

    private static string NormalizeIndexMode(string? value) => value?.ToLowerInvariant() switch
    {
        "vector" => "vector",
        "full-text" => "full-text",
        _ => "hybrid"
    };

    private static string NormalizeEmbeddingModel(string? value)
        => string.IsNullOrWhiteSpace(value) ? "system-default" : value.Trim();

    private static string NormalizeRerankModel(string? value)
        => string.IsNullOrWhiteSpace(value) ? "none" : value.Trim();
}
