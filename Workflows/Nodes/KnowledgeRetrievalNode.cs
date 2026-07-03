using EaseGPT.Knowledge;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed class KnowledgeRetrievalNode : IWorkflowNode
{
    private readonly RagService _ragService;
    private readonly IKnowledgeStore _knowledgeStore;

    public KnowledgeRetrievalNode(RagService ragService, IKnowledgeStore knowledgeStore)
    {
        _ragService = ragService;
        _knowledgeStore = knowledgeStore;
    }

    public string Type => "ai.knowledge-retrieval";

    public string DisplayName => "知识检索";

    public string Description => "从一个或多个知识库召回相关 Chunk，并按分数合并排序。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var queryTemplate = context.GetString("query") ?? "{{question}}";
        var query = TemplateRenderer.Render(queryTemplate, context.Input, context.Variables).Trim();
        if (string.IsNullOrWhiteSpace(query))
        {
            throw new InvalidOperationException("知识检索的查询文本不能为空。");
        }

        var knowledgeBaseIds = (context.GetSetting<List<string>>("knowledgeBaseIds") ?? [])
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (knowledgeBaseIds.Count == 0)
        {
            throw new InvalidOperationException("知识检索至少需要添加一个知识库。");
        }

        var topK = Math.Clamp(context.GetInt32("topK") ?? 4, 1, 12);
        var rerankModel = context.GetString("rerankModel");
        var scoreThresholdEnabled = context.GetBoolean("scoreThresholdEnabled") ?? false;
        var scoreThreshold = Math.Clamp(context.GetSetting<double?>("scoreThreshold") ?? 0, 0, 1);
        var recallOptions = new RagRecallOptions(
            string.IsNullOrWhiteSpace(rerankModel) ? null : rerankModel,
            scoreThresholdEnabled,
            scoreThreshold);

        var recalls = await Task.WhenAll(knowledgeBaseIds.Select(async knowledgeBaseId =>
        {
            var knowledgeBase = await _knowledgeStore.GetBaseAsync(
                knowledgeBaseId,
                context.CancellationToken)
                ?? throw new InvalidOperationException($"知识库不存在：{knowledgeBaseId}");
            var chunks = await _ragService.RetrieveChunksAsync(
                knowledgeBaseId,
                query,
                topK,
                recallOptions,
                context.CancellationToken);
            return (KnowledgeBase: knowledgeBase, Chunks: chunks);
        }));

        var rankedHits = recalls
            .SelectMany(result => result.Chunks.Select(chunk => new KnowledgeRetrievalHit(
                result.KnowledgeBase.Id,
                result.KnowledgeBase.Name,
                result.KnowledgeBase.IndexMode,
                chunk.Chunk.DocumentId,
                chunk.Chunk.FileName,
                chunk.Chunk.Index,
                chunk.Chunk.Heading,
                chunk.Chunk.TitlePath,
                chunk.Chunk.KeywordSummary,
                chunk.Chunk.Text,
                Math.Round(chunk.Score, 4),
                Math.Round(chunk.VectorScore, 4),
                Math.Round(chunk.KeywordScore, 4))))
            .OrderByDescending(hit => hit.Score)
            .Take(topK)
            .ToList();

        var knowledgeContext = string.Join(
            "\n\n",
            rankedHits.Select((hit, index) =>
            {
                var heading = string.IsNullOrWhiteSpace(hit.TitlePath)
                    ? hit.Heading
                    : hit.TitlePath;
                var source = string.IsNullOrWhiteSpace(heading)
                    ? $"{hit.KnowledgeBaseName} / {hit.FileName}"
                    : $"{hit.KnowledgeBaseName} / {hit.FileName} / {heading}";
                return $"[{index + 1}] {source}\n{hit.Text}";
            }));

        var output = new Dictionary<string, object?>(context.Input)
        {
            ["knowledgeQuery"] = query,
            ["knowledgeHits"] = rankedHits,
            ["knowledgeContext"] = knowledgeContext,
            ["knowledgeHitCount"] = rankedHits.Count
        };

        return NodeExecutionResult.Continue(
            output,
            recordedInput: new Dictionary<string, object?>
            {
                ["query"] = query,
                ["knowledgeBaseIds"] = knowledgeBaseIds,
                ["topK"] = topK,
                ["rerankModel"] = string.IsNullOrWhiteSpace(rerankModel) ? "使用知识库设置" : rerankModel,
                ["scoreThreshold"] = scoreThresholdEnabled ? scoreThreshold : null
            },
            recordedOutput: new Dictionary<string, object?>
            {
                ["hitCount"] = rankedHits.Count,
                ["knowledgeBases"] = recalls.Select(item => item.KnowledgeBase.Name).ToList(),
                ["hits"] = rankedHits
            });
    }
}

public sealed record KnowledgeRetrievalHit(
    string KnowledgeBaseId,
    string KnowledgeBaseName,
    string IndexMode,
    string DocumentId,
    string FileName,
    int ChunkIndex,
    string? Heading,
    string? TitlePath,
    string? KeywordSummary,
    string Text,
    double Score,
    double VectorScore,
    double KeywordScore);
