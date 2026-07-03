namespace EaseGPT.ConversationAgents;

public interface IConversationAgentStore
{
    Task<IReadOnlyCollection<ConversationAgentDefinition>> ListAsync(CancellationToken cancellationToken);

    Task<ConversationAgentDefinition?> GetAsync(string id, CancellationToken cancellationToken);

    Task SaveAsync(ConversationAgentDefinition agent, CancellationToken cancellationToken);

    Task DeleteAsync(string id, CancellationToken cancellationToken);
}
