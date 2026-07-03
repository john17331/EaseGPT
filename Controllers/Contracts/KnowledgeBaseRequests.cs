namespace EaseGPT.Controllers;

public sealed record CreateKnowledgeBaseRequest(
    string Name,
    string? Description,
    string? Icon,
    string? ChunkMode = null,
    string? ChunkDelimiter = null,
    int? ChunkSize = null,
    int? ChunkOverlap = null,
    string? IndexMode = null,
    string? EmbeddingModel = null,
    string? RerankModel = null);

public sealed record AskKnowledgeBaseRequest(string Question, int TopK = 5);
