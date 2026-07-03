namespace EaseGPT.Knowledge;

public interface IEmbeddingModel
{
    Task<IReadOnlyList<float[]>> EmbedAsync(string embeddingModel, IReadOnlyList<string> texts, CancellationToken cancellationToken);
}

public interface IRagChatModel
{
    Task<string> AnswerAsync(string question, IReadOnlyList<RetrievedChunk> context, CancellationToken cancellationToken);
}

public interface IRagReranker
{
    Task<IReadOnlyList<(string ChunkId, double Score)>> RerankAsync(
        string rerankModelConfigId,
        string question,
        IReadOnlyList<KnowledgeChunk> candidates,
        CancellationToken cancellationToken);
}

public interface IKnowledgeStore
{
    Task<IReadOnlyList<KnowledgeBase>> ListBasesAsync(CancellationToken cancellationToken);
    Task<KnowledgeBase?> GetBaseAsync(string id, CancellationToken cancellationToken);
    Task SaveBaseAsync(KnowledgeBase knowledgeBase, CancellationToken cancellationToken);
    Task DeleteBaseAsync(string id, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgeDocument>> ListDocumentsAsync(string knowledgeBaseId, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgeDocument>> ListPendingDocumentsAsync(CancellationToken cancellationToken);
    Task<KnowledgeDocument?> GetDocumentAsync(string id, CancellationToken cancellationToken);
    Task SaveDocumentAsync(KnowledgeDocument document, CancellationToken cancellationToken);
    Task DeleteDocumentAsync(string id, CancellationToken cancellationToken);
    Task ReplaceChunksAsync(string documentId, IReadOnlyList<KnowledgeChunk> chunks, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgeChunk>> GetChunksAsync(IEnumerable<string> ids, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgeChunk>> ListDocumentChunksAsync(string documentId, int skip, int take, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgeChunk>> SearchChunksAsync(string knowledgeBaseId, IReadOnlyCollection<string> terms, int limit, CancellationToken cancellationToken);
    Task<IReadOnlyList<KnowledgeChunk>> GetAdjacentChunksAsync(string documentId, int index, int radius, CancellationToken cancellationToken);
}

public interface IKnowledgeVectorStore
{
    Task UpsertAsync(IReadOnlyList<KnowledgeChunk> chunks, IReadOnlyList<float[]> vectors, CancellationToken cancellationToken);
    Task DeleteDocumentAsync(string documentId, CancellationToken cancellationToken);
    Task<IReadOnlyList<(string ChunkId, double Score)>> SearchAsync(string knowledgeBaseId, float[] vector, int limit, CancellationToken cancellationToken);
}
