using System.Threading.Channels;

namespace EaseGPT.Knowledge;

public sealed class KnowledgeIngestionQueue
{
    private readonly Channel<string> _channel = Channel.CreateBounded<string>(new BoundedChannelOptions(256) { FullMode = BoundedChannelFullMode.Wait, SingleReader = true });
    public ValueTask EnqueueAsync(string documentId, CancellationToken ct = default) => _channel.Writer.WriteAsync(documentId, ct);
    public IAsyncEnumerable<string> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

public sealed class KnowledgeIngestionService : BackgroundService
{
    private const int EmbeddingBatchSize = 10;
    private readonly KnowledgeIngestionQueue _queue;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<KnowledgeIngestionService> _logger;

    public KnowledgeIngestionService(KnowledgeIngestionQueue queue, IServiceScopeFactory scopes, ILogger<KnowledgeIngestionService> logger)
        => (_queue, _scopes, _logger) = (queue, scopes, logger);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using (var scope = _scopes.CreateScope())
        {
            var store = scope.ServiceProvider.GetRequiredService<IKnowledgeStore>();
            foreach (var document in await store.ListPendingDocumentsAsync(stoppingToken))
                await _queue.EnqueueAsync(document.Id, stoppingToken);
        }
        await foreach (var documentId in _queue.ReadAllAsync(stoppingToken))
        {
            try { await ProcessAsync(documentId, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { _logger.LogError(error, "Knowledge document {DocumentId} ingestion failed", documentId); }
        }
    }

    private async Task ProcessAsync(string documentId, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IKnowledgeStore>();
        var parser = scope.ServiceProvider.GetRequiredService<DocumentProcessor>();
        var embedding = scope.ServiceProvider.GetRequiredService<IEmbeddingModel>();
        var vectors = scope.ServiceProvider.GetRequiredService<IKnowledgeVectorStore>();
        var document = await store.GetDocumentAsync(documentId, ct);
        if (document is null) return;
        var knowledgeBase = await store.GetBaseAsync(document.KnowledgeBaseId, ct);
        if (knowledgeBase is null) return;
        _logger.LogInformation(
            "Starting knowledge ingestion for document {DocumentId} ({FileName}) in base {KnowledgeBaseId}. IndexMode={IndexMode}, EmbeddingModel={EmbeddingModel}, RerankModel={RerankModel}",
            document.Id,
            document.FileName,
            knowledgeBase.Id,
            knowledgeBase.IndexMode,
            knowledgeBase.EmbeddingModel,
            knowledgeBase.RerankModel);
        document.Status = KnowledgeDocumentStatus.Processing; document.Error = null; document.UpdatedAt = DateTimeOffset.UtcNow;
        await store.SaveDocumentAsync(document, ct);
        try
        {
            var text = await parser.ParseAsync(document, ct);
            var chunks = parser.Chunk(document, text, knowledgeBase);
            _logger.LogInformation(
                "Parsed document {DocumentId} into {ChunkCount} chunks using chunk mode {ChunkMode}",
                document.Id,
                chunks.Count,
                knowledgeBase.ChunkMode);
            if (chunks.Count == 0) throw new InvalidDataException("文档中没有可索引的文本。");
            if (string.Equals(knowledgeBase.IndexMode, "full-text", StringComparison.OrdinalIgnoreCase))
            {
                await vectors.DeleteDocumentAsync(document.Id, ct);
            }
            else
            {
                var embeddingInputs = chunks
                    .SelectMany(chunk => parser.BuildEmbeddingTexts(chunk).Select(textValue => (Chunk: chunk, Text: textValue)))
                    .ToList();
                var embeddings = new List<float[]>(embeddingInputs.Count);
                foreach (var batch in embeddingInputs.Chunk(EmbeddingBatchSize))
                {
                    _logger.LogInformation(
                        "Embedding batch for document {DocumentId}: batch size {BatchSize}, vector inputs {VectorInputCount}, model {EmbeddingModel}, batch limit {EmbeddingBatchSize}",
                        document.Id,
                        batch.Length,
                        embeddingInputs.Count,
                        knowledgeBase.EmbeddingModel,
                        EmbeddingBatchSize);
                    embeddings.AddRange(await embedding.EmbedAsync(
                        knowledgeBase.EmbeddingModel,
                        batch.Select(x => x.Text).ToList(),
                        ct));
                }
                await vectors.UpsertAsync(embeddingInputs.Select(item => item.Chunk).ToList(), embeddings, ct);
            }
            await store.ReplaceChunksAsync(document.Id, chunks, ct);
            document.Status = KnowledgeDocumentStatus.Ready; document.ChunkCount = chunks.Count; document.UpdatedAt = DateTimeOffset.UtcNow;
            _logger.LogInformation(
                "Knowledge ingestion completed for document {DocumentId}. ChunkCount={ChunkCount}, Status={Status}",
                document.Id,
                document.ChunkCount,
                document.Status);
        }
        catch (Exception error)
        {
            document.Status = KnowledgeDocumentStatus.Failed; document.Error = error.Message; document.UpdatedAt = DateTimeOffset.UtcNow;
            _logger.LogError(
                error,
                "Knowledge ingestion failed for document {DocumentId} ({FileName}) in base {KnowledgeBaseId}. IndexMode={IndexMode}, EmbeddingModel={EmbeddingModel}",
                document.Id,
                document.FileName,
                knowledgeBase.Id,
                knowledgeBase.IndexMode,
                knowledgeBase.EmbeddingModel);
        }
        await store.SaveDocumentAsync(document, ct);
    }
}
