using System.Text.RegularExpressions;

namespace EaseGPT.Knowledge;

public sealed partial class RagService
{
    private readonly IEmbeddingModel _embedding;
    private readonly IKnowledgeVectorStore _vectors;
    private readonly IKnowledgeStore _store;
    private readonly IRagChatModel _chat;
    private readonly IRagReranker _reranker;

    public RagService(
        IEmbeddingModel embedding,
        IKnowledgeVectorStore vectors,
        IKnowledgeStore store,
        IRagChatModel chat,
        IRagReranker reranker)
        => (_embedding, _vectors, _store, _chat, _reranker) = (embedding, vectors, store, chat, reranker);

    public async Task<RagAnswer> AskAsync(string knowledgeBaseId, string question, int topK, CancellationToken ct)
    {
        var expanded = await RecallChunksAsync(knowledgeBaseId, question, topK, null, ct);
        var answer = await _chat.AnswerAsync(question, expanded, ct);
        var citations = expanded
            .Take(Math.Clamp(topK, 1, 8))
            .Select(x => new RagCitation(
                x.Chunk.DocumentId,
                x.Chunk.FileName,
                x.Chunk.Index,
                x.Chunk.Heading,
                x.Chunk.Text.Length <= 240 ? x.Chunk.Text : x.Chunk.Text[..240] + "…",
                Math.Round(x.Score, 4)))
            .ToList();

        return new RagAnswer(answer, citations);
    }

    public async Task<RagRecallResult> RecallAsync(string knowledgeBaseId, string question, int topK, CancellationToken ct)
    {
        var hits = (await RecallChunksAsync(knowledgeBaseId, question, topK, null, ct))
            .Take(Math.Clamp(topK, 1, 12))
            .ToList();
        var result = hits
            .Select(item => new RagRecallHit(
                item.Chunk.DocumentId,
                item.Chunk.FileName,
                item.Chunk.Index,
                item.Chunk.Heading,
                item.Chunk.KeywordSummary,
                item.Chunk.Text.Length <= 320 ? item.Chunk.Text : item.Chunk.Text[..320] + "…",
                Math.Round(item.Score, 4),
                Math.Round(item.VectorScore, 4),
                Math.Round(item.KeywordScore, 4)))
            .ToList();

        return new RagRecallResult(question, result);
    }

    public async Task<RagRecallResult> RecallAsync(
        string knowledgeBaseId,
        string question,
        int topK,
        RagRecallOptions? options,
        CancellationToken ct)
    {
        var hits = (await RecallChunksAsync(knowledgeBaseId, question, topK, options, ct))
            .Take(Math.Clamp(topK, 1, 12))
            .ToList();
        var result = hits
            .Select(item => new RagRecallHit(
                item.Chunk.DocumentId,
                item.Chunk.FileName,
                item.Chunk.Index,
                item.Chunk.Heading,
                item.Chunk.KeywordSummary,
                item.Chunk.Text.Length <= 320 ? item.Chunk.Text : item.Chunk.Text[..320] + "…",
                Math.Round(item.Score, 4),
                Math.Round(item.VectorScore, 4),
                Math.Round(item.KeywordScore, 4)))
            .ToList();

        return new RagRecallResult(question, result);
    }

    public async Task<IReadOnlyList<RetrievedChunk>> RetrieveChunksAsync(
        string knowledgeBaseId,
        string question,
        int topK,
        RagRecallOptions? options,
        CancellationToken ct)
        => await RecallChunksAsync(knowledgeBaseId, question, topK, options, ct);

    private async Task<List<RetrievedChunk>> RecallChunksAsync(
        string knowledgeBaseId,
        string question,
        int topK,
        RagRecallOptions? options,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(question))
        {
            throw new ArgumentException("问题不能为空。", nameof(question));
        }

        var knowledgeBase = await _store.GetBaseAsync(knowledgeBaseId, ct)
            ?? throw new KeyNotFoundException("知识库不存在。");
        var candidateLimit = Math.Clamp(topK * 4, 12, 50);
        var terms = Terms(question);
        var vectorScores = new Dictionary<string, double>(StringComparer.Ordinal);
        var keywordChunks = new List<KnowledgeChunk>();

        if (!string.Equals(knowledgeBase.IndexMode, "full-text", StringComparison.OrdinalIgnoreCase))
        {
            var vector = (await _embedding.EmbedAsync(knowledgeBase.EmbeddingModel, [question], ct))[0];
            foreach (var candidate in await _vectors.SearchAsync(knowledgeBaseId, vector, candidateLimit, ct))
            {
                vectorScores[candidate.ChunkId] = candidate.Score;
            }
        }

        if (!string.Equals(knowledgeBase.IndexMode, "vector", StringComparison.OrdinalIgnoreCase))
        {
            keywordChunks.AddRange(await _store.SearchChunksAsync(knowledgeBaseId, terms, candidateLimit, ct));
        }

        var candidateIds = vectorScores.Keys
            .Concat(keywordChunks.Select(x => x.Id))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var byId = (await _store.GetChunksAsync(candidateIds, ct))
            .Concat(keywordChunks)
            .DistinctBy(x => x.Id)
            .ToDictionary(x => x.Id);

        var initialRanked = candidateIds
            .Where(byId.ContainsKey)
            .Select(id =>
            {
                var chunk = byId[id];
                var vectorScore = vectorScores.GetValueOrDefault(id);
                var keyword = KeywordScore(chunk, terms);
                var score = knowledgeBase.IndexMode.ToLowerInvariant() switch
                {
                    "vector" => vectorScore,
                    "full-text" => keyword,
                    _ => Math.Max(vectorScore, keyword)
                };
                return new RetrievedChunk(chunk, vectorScore, keyword, score);
            })
            .OrderByDescending(x => x.Score)
            .Take(Math.Clamp(candidateLimit, 1, 50))
            .ToList();

        var rerankModel = string.IsNullOrWhiteSpace(options?.RerankModel)
            ? knowledgeBase.RerankModel
            : options.RerankModel;
        var reranked = await ApplyRerankAsync(question, rerankModel, initialRanked, ct);
        reranked = reranked.Take(Math.Clamp(topK, 1, 12)).ToList();

        var expanded = new List<RetrievedChunk>(reranked);
        foreach (var hit in reranked.Take(3))
        {
            foreach (var neighbor in await _store.GetAdjacentChunksAsync(hit.Chunk.DocumentId, hit.Chunk.Index, 1, ct))
            {
                if (expanded.All(x => x.Chunk.Id != neighbor.Id))
                {
                    expanded.Add(new RetrievedChunk(neighbor, hit.VectorScore * 0.85, 0, hit.Score * 0.85));
                }
            }
        }

        var threshold = options?.ScoreThresholdEnabled == true
            ? Math.Max(0, options.ScoreThreshold)
            : 0;

        return expanded
            .OrderByDescending(x => x.Score)
            .Where(x => x.Score >= threshold)
            .Take(12)
            .ToList();
    }

    private static double KeywordScore(KnowledgeChunk chunk, HashSet<string> terms)
    {
        if (terms.Count == 0) return 0;
        var text = string.Join(" ", new[]
        {
            chunk.Heading,
            chunk.TitlePath,
            chunk.KeywordSummary,
            chunk.SearchText,
            chunk.Text
        }.Where(value => !string.IsNullOrWhiteSpace(value))).ToLowerInvariant();
        var hits = terms.Count(text.Contains);
        var headingHits = string.IsNullOrWhiteSpace(chunk.Heading) ? 0 : terms.Count(x => chunk.Heading.Contains(x, StringComparison.OrdinalIgnoreCase));
        var titlePathHits = string.IsNullOrWhiteSpace(chunk.TitlePath) ? 0 : terms.Count(x => chunk.TitlePath.Contains(x, StringComparison.OrdinalIgnoreCase));
        return Math.Min(1d, (double)hits / terms.Count + headingHits * 0.15 + titlePathHits * 0.12);
    }

    private static HashSet<string> Terms(string text)
    {
        var normalized = text.ToLowerInvariant();
        var terms = LatinTermRegex().Matches(normalized).Select(x => x.Value).Where(x => x.Length > 1).ToHashSet();
        var han = string.Concat(normalized.Where(c => c >= '\u3400' && c <= '\u9fff'));
        for (var i = 0; i + 1 < han.Length; i++) terms.Add(han.Substring(i, 2));
        return terms;
    }

    [GeneratedRegex(@"[a-z0-9_-]+", RegexOptions.CultureInvariant)]
    private static partial Regex LatinTermRegex();

    private async Task<List<RetrievedChunk>> ApplyRerankAsync(
        string question,
        string? rerankModel,
        IReadOnlyList<RetrievedChunk> candidates,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(rerankModel)
            || string.Equals(rerankModel, "none", StringComparison.OrdinalIgnoreCase))
        {
            return candidates.ToList();
        }

        var rerankedScores = await _reranker.RerankAsync(
            rerankModel,
            question,
            candidates.Select(item => item.Chunk).ToList(),
            ct);

        if (rerankedScores.Count == 0) return candidates.ToList();

        var byId = candidates.ToDictionary(item => item.Chunk.Id, StringComparer.Ordinal);
        return rerankedScores
            .Where(item => byId.ContainsKey(item.ChunkId))
            .OrderByDescending(item => item.Score)
            .Select(item =>
            {
                var source = byId[item.ChunkId];
                return source with { Score = item.Score };
            })
            .ToList();
    }
}

public sealed record RagRecallOptions(
    string? RerankModel = null,
    bool ScoreThresholdEnabled = false,
    double ScoreThreshold = 0);
