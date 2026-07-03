using LiteDB;

namespace EaseGPT.Knowledge;

public sealed class KnowledgeBase
{
    [BsonId] public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string ChunkMode { get; set; } = "paragraph";
    public string ChunkDelimiter { get; set; } = "\\n\\n";
    public int ChunkSize { get; set; } = 1024;
    public int ChunkOverlap { get; set; } = 100;
    public string IndexMode { get; set; } = "hybrid";
    public string EmbeddingModel { get; set; } = "system-default";
    public string RerankModel { get; set; } = "none";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum KnowledgeDocumentStatus { Pending, Processing, Ready, Failed }

public sealed class KnowledgeDocument
{
    [BsonId] public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string KnowledgeBaseId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string StoragePath { get; set; } = string.Empty;
    public string Sha256 { get; set; } = string.Empty;
    public KnowledgeDocumentStatus Status { get; set; } = KnowledgeDocumentStatus.Pending;
    public int ChunkCount { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class KnowledgeChunk
{
    [BsonId] public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string KnowledgeBaseId { get; set; } = string.Empty;
    public string DocumentId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public int Index { get; set; }
    public string? Heading { get; set; }
    public string? TitlePath { get; set; }
    public string? KeywordSummary { get; set; }
    public string? SearchText { get; set; }
    public string Text { get; set; } = string.Empty;
    public int StartOffset { get; set; }
    public int EndOffset { get; set; }
}

public sealed record RetrievedChunk(KnowledgeChunk Chunk, double VectorScore, double KeywordScore, double Score);
public sealed record RagCitation(string DocumentId, string FileName, int ChunkIndex, string? Heading, string Quote, double Score);
public sealed record RagAnswer(string Answer, IReadOnlyList<RagCitation> Citations);
public sealed record RagRecallHit(
    string DocumentId,
    string FileName,
    int ChunkIndex,
    string? Heading,
    string? KeywordSummary,
    string Quote,
    double Score,
    double VectorScore,
    double KeywordScore);
public sealed record RagRecallResult(string Question, IReadOnlyList<RagRecallHit> Hits);
