using System.Text.Json;
using LiteDB;
using EaseGPT.Workflows.Storage;
using SystemJsonSerializer = System.Text.Json.JsonSerializer;

namespace EaseGPT.ConversationAgents;

public sealed class LiteDbConversationAgentExecutionLog : IConversationAgentExecutionLog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ILiteCollection<ConversationAgentExecutionDocument> _executions;

    public LiteDbConversationAgentExecutionLog(LiteDbContext context)
    {
        _executions = context.Database.GetCollection<ConversationAgentExecutionDocument>("conversation_agent_executions");
        _executions.EnsureIndex(execution => execution.Id, unique: true);
        _executions.EnsureIndex(execution => execution.AgentId);
        _executions.EnsureIndex(execution => execution.StartedAt);
    }

    public Task AddAsync(ConversationAgentExecutionRecord execution, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        _executions.Upsert(new ConversationAgentExecutionDocument
        {
            Id = execution.Id,
            AgentId = execution.AgentId,
            StartedAt = execution.StartedAt,
            Json = SystemJsonSerializer.Serialize(execution, JsonOptions)
        });

        return Task.CompletedTask;
    }

    public Task<IReadOnlyCollection<ConversationAgentExecutionRecord>> ListAsync(
        string agentId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        string? keyword,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var normalizedKeyword = string.IsNullOrWhiteSpace(keyword)
            ? null
            : keyword.Trim().ToLowerInvariant();

        var items = _executions.Find(execution => execution.AgentId == agentId)
            .OrderByDescending(execution => execution.StartedAt)
            .Select(document => SystemJsonSerializer.Deserialize<ConversationAgentExecutionRecord>(document.Json, JsonOptions))
            .Where(record => record is not null)
            .Select(record => record!)
            .Where(record => !from.HasValue || record.StartedAt >= from.Value)
            .Where(record => !to.HasValue || record.StartedAt <= to.Value)
            .Where(record => normalizedKeyword is null || MatchesKeyword(record, normalizedKeyword))
            .Take(200)
            .ToList();

        return Task.FromResult<IReadOnlyCollection<ConversationAgentExecutionRecord>>(items);
    }

    private static bool MatchesKeyword(ConversationAgentExecutionRecord record, string keyword)
    {
        if (record.Message.Contains(keyword, StringComparison.OrdinalIgnoreCase)) return true;
        if (!string.IsNullOrWhiteSpace(record.Reply) && record.Reply.Contains(keyword, StringComparison.OrdinalIgnoreCase)) return true;
        if (!string.IsNullOrWhiteSpace(record.Error) && record.Error.Contains(keyword, StringComparison.OrdinalIgnoreCase)) return true;
        return record.History.Any(item => item.Content.Contains(keyword, StringComparison.OrdinalIgnoreCase));
    }

}

public sealed class ConversationAgentExecutionDocument
{
    [BsonId]
    public required string Id { get; init; }

    public required string AgentId { get; init; }

    public DateTimeOffset StartedAt { get; init; }

    public required string Json { get; init; }
}
