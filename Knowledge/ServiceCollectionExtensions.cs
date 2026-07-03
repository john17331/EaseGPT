namespace EaseGPT.Knowledge;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRagKnowledgeBase(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<RagOptions>(configuration.GetSection(RagOptions.SectionName));
        services.AddHttpClient("rag-models", client => client.Timeout = TimeSpan.FromMinutes(5));
        services.AddSingleton<IKnowledgeStore, LiteDbKnowledgeStore>();
        services.AddSingleton<LocalFileStore>();
        services.AddSingleton<DocumentProcessor>();
        services.AddSingleton<IEmbeddingModel, ConfiguredEmbeddingModel>();
        services.AddSingleton<IRagChatModel, ConfiguredRagChatModel>();
        services.AddSingleton<IRagReranker, ConfiguredRagReranker>();
        services.AddSingleton<IKnowledgeVectorStore, LanceDbVectorStore>();
        services.AddSingleton<RagService>();
        services.AddSingleton<KnowledgeIngestionQueue>();
        services.AddHostedService<KnowledgeIngestionService>();
        return services;
    }
}
