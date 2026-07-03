using EaseGPT.Workflows.Storage;
using LiteDB;

namespace EaseGPT.ConversationAgents;

public sealed class LiteDbConversationAgentStore : IConversationAgentStore
{
    private readonly ILiteCollection<ConversationAgentDefinition> _agents;
    private readonly object _sync = new();

    public LiteDbConversationAgentStore(LiteDbContext context)
    {
        _agents = context.Database.GetCollection<ConversationAgentDefinition>("conversation_agents");
        _agents.EnsureIndex(agent => agent.Id, unique: true);
    }

    public Task<IReadOnlyCollection<ConversationAgentDefinition>> ListAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_sync)
        {
            return Task.FromResult<IReadOnlyCollection<ConversationAgentDefinition>>(
                _agents.FindAll().OrderByDescending(agent => agent.UpdatedAt).ToList());
        }
    }

    public Task<ConversationAgentDefinition?> GetAsync(string id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_sync)
        {
            ConversationAgentDefinition? agent = _agents.FindById(id);
            return Task.FromResult<ConversationAgentDefinition?>(agent);
        }
    }

    public Task SaveAsync(ConversationAgentDefinition agent, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        agent.UpdatedAt = DateTimeOffset.UtcNow;
        lock (_sync)
        {
            _agents.Upsert(agent);
        }
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_sync)
        {
            _agents.Delete(id);
        }
        return Task.CompletedTask;
    }
}
