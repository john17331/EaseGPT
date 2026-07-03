using EaseGPT.Workflows.Storage;
using LiteDB;

namespace EaseGPT.Knowledge;

public sealed class LiteDbKnowledgeStore : IKnowledgeStore
{
    private readonly ILiteCollection<KnowledgeBase> _bases;
    private readonly ILiteCollection<KnowledgeDocument> _documents;
    private readonly ILiteCollection<KnowledgeChunk> _chunks;
    private readonly object _sync = new();

    public LiteDbKnowledgeStore(LiteDbContext context)
    {
        _bases = context.Database.GetCollection<KnowledgeBase>("knowledge_bases");
        _documents = context.Database.GetCollection<KnowledgeDocument>("knowledge_documents");
        _chunks = context.Database.GetCollection<KnowledgeChunk>("knowledge_chunks");
        _documents.EnsureIndex(x => x.KnowledgeBaseId);
        _chunks.EnsureIndex(x => x.DocumentId);
        _chunks.EnsureIndex(x => x.KnowledgeBaseId);
    }

    public Task<IReadOnlyList<KnowledgeBase>> ListBasesAsync(CancellationToken ct) => Read<IReadOnlyList<KnowledgeBase>>(() => _bases.FindAll().OrderByDescending(x => x.UpdatedAt).ToList(), ct);
    public Task<KnowledgeBase?> GetBaseAsync(string id, CancellationToken ct) => Read<KnowledgeBase?>(() => _bases.FindById(id), ct);
    public Task SaveBaseAsync(KnowledgeBase item, CancellationToken ct) => Write(() => _bases.Upsert(item), ct);
    public Task<IReadOnlyList<KnowledgeDocument>> ListDocumentsAsync(string baseId, CancellationToken ct) => Read<IReadOnlyList<KnowledgeDocument>>(() => _documents.Find(x => x.KnowledgeBaseId == baseId).OrderByDescending(x => x.CreatedAt).ToList(), ct);
    public Task<IReadOnlyList<KnowledgeDocument>> ListPendingDocumentsAsync(CancellationToken ct) => Read<IReadOnlyList<KnowledgeDocument>>(
        () => _documents.Find(x => x.Status == KnowledgeDocumentStatus.Pending || x.Status == KnowledgeDocumentStatus.Processing).ToList(), ct);
    public Task<KnowledgeDocument?> GetDocumentAsync(string id, CancellationToken ct) => Read<KnowledgeDocument?>(() => _documents.FindById(id), ct);
    public Task SaveDocumentAsync(KnowledgeDocument item, CancellationToken ct) => Write(() => _documents.Upsert(item), ct);

    public Task DeleteBaseAsync(string id, CancellationToken ct) => Write(() =>
    {
        var documentIds = _documents.Find(x => x.KnowledgeBaseId == id).Select(x => x.Id).ToList();
        foreach (var documentId in documentIds) _chunks.DeleteMany(x => x.DocumentId == documentId);
        _documents.DeleteMany(x => x.KnowledgeBaseId == id);
        return _bases.Delete(id);
    }, ct);

    public Task DeleteDocumentAsync(string id, CancellationToken ct) => Write(() =>
    {
        _chunks.DeleteMany(x => x.DocumentId == id);
        return _documents.Delete(id);
    }, ct);

    public Task ReplaceChunksAsync(string documentId, IReadOnlyList<KnowledgeChunk> chunks, CancellationToken ct) => Write(() =>
    {
        _chunks.DeleteMany(x => x.DocumentId == documentId);
        if (chunks.Count > 0) _chunks.InsertBulk(chunks);
        return true;
    }, ct);

    public Task<IReadOnlyList<KnowledgeChunk>> GetChunksAsync(IEnumerable<string> ids, CancellationToken ct)
    {
        var set = ids.Distinct().ToHashSet(StringComparer.Ordinal);
        return Read<IReadOnlyList<KnowledgeChunk>>(() => set.Select(id => _chunks.FindById(id)).Where(x => x is not null).ToList(), ct);
    }

    public Task<IReadOnlyList<KnowledgeChunk>> ListDocumentChunksAsync(string documentId, int skip, int take, CancellationToken ct)
        => Read<IReadOnlyList<KnowledgeChunk>>(() => _chunks.Find(x => x.DocumentId == documentId)
            .OrderBy(x => x.Index)
            .Skip(Math.Max(0, skip))
            .Take(Math.Clamp(take, 1, 100))
            .ToList(), ct);

    public Task<IReadOnlyList<KnowledgeChunk>> SearchChunksAsync(string knowledgeBaseId, IReadOnlyCollection<string> terms, int limit, CancellationToken ct)
        => Read<IReadOnlyList<KnowledgeChunk>>(() =>
        {
            if (terms.Count == 0) return [];
            return _chunks.Find(x => x.KnowledgeBaseId == knowledgeBaseId)
                .Select(chunk => new
                {
                    Chunk = chunk,
                    SearchCorpus = string.Join(" ", new[]
                    {
                        chunk.Heading,
                        chunk.TitlePath,
                        chunk.KeywordSummary,
                        chunk.SearchText,
                        chunk.Text
                    }.Where(value => !string.IsNullOrWhiteSpace(value))),
                    Score = terms.Count(term =>
                        (!string.IsNullOrWhiteSpace(chunk.Text) && chunk.Text.Contains(term, StringComparison.OrdinalIgnoreCase))
                        || (!string.IsNullOrWhiteSpace(chunk.Heading) && chunk.Heading.Contains(term, StringComparison.OrdinalIgnoreCase))
                        || (!string.IsNullOrWhiteSpace(chunk.TitlePath) && chunk.TitlePath.Contains(term, StringComparison.OrdinalIgnoreCase))
                        || (!string.IsNullOrWhiteSpace(chunk.KeywordSummary) && chunk.KeywordSummary.Contains(term, StringComparison.OrdinalIgnoreCase))
                        || (!string.IsNullOrWhiteSpace(chunk.SearchText) && chunk.SearchText.Contains(term, StringComparison.OrdinalIgnoreCase)))
                })
                .Where(item => item.Score > 0)
                .OrderByDescending(item => item.Score)
                .ThenBy(item => item.Chunk.Index)
                .Take(Math.Clamp(limit, 1, 100))
                .Select(item => item.Chunk)
                .ToList();
        }, ct);

    public Task<IReadOnlyList<KnowledgeChunk>> GetAdjacentChunksAsync(string documentId, int index, int radius, CancellationToken ct)
        => Read<IReadOnlyList<KnowledgeChunk>>(() => _chunks.Find(x => x.DocumentId == documentId && x.Index >= index - radius && x.Index <= index + radius).OrderBy(x => x.Index).ToList(), ct);

    private Task<T> Read<T>(Func<T> action, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        lock (_sync) return Task.FromResult(action());
    }

    private Task Write(Func<bool> action, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        lock (_sync) action();
        return Task.CompletedTask;
    }
}
