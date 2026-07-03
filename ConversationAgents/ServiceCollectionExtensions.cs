namespace EaseGPT.ConversationAgents;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddConversationAgents(this IServiceCollection services)
    {
        services.AddSingleton<IConversationAgentStore, LiteDbConversationAgentStore>();
        services.AddSingleton<IConversationAgentExecutionLog, LiteDbConversationAgentExecutionLog>();
        services.AddSingleton<ConversationAgentPreviewService>();
        return services;
    }
}
