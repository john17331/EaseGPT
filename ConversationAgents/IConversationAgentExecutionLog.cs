namespace EaseGPT.ConversationAgents;

public interface IConversationAgentExecutionLog
{
    Task AddAsync(ConversationAgentExecutionRecord execution, CancellationToken cancellationToken);

    Task<IReadOnlyCollection<ConversationAgentExecutionRecord>> ListAsync(
        string agentId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        string? keyword,
        CancellationToken cancellationToken);
}
