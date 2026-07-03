using System.Text.Json;
using EaseGPT.Workflows.Domain;
using LiteDB;
using SystemJsonSerializer = System.Text.Json.JsonSerializer;

namespace EaseGPT.Workflows.Storage;

/// <summary>
/// 使用 LiteDB 保存最近的工作流执行记录，便于服务重启后继续排查历史运行情况。
/// </summary>
public sealed class LiteDbWorkflowExecutionLog : IWorkflowExecutionLog
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ILiteCollection<WorkflowExecutionDocument> _executions;

    public LiteDbWorkflowExecutionLog(LiteDbContext context)
    {
        _executions = context.Database.GetCollection<WorkflowExecutionDocument>("workflow_executions");
        _executions.EnsureIndex(execution => execution.Id, unique: true);
        _executions.EnsureIndex(execution => execution.WorkflowId);
        _executions.EnsureIndex(execution => execution.StartedAt);
    }

    public Task AddAsync(WorkflowExecutionRecord execution, CancellationToken cancellationToken)
    {
        _executions.Upsert(new WorkflowExecutionDocument
        {
            Id = execution.Id,
            WorkflowId = execution.WorkflowId,
            StartedAt = execution.StartedAt,
            Json = SystemJsonSerializer.Serialize(execution, JsonOptions)
        });

        return Task.CompletedTask;
    }

    public Task<IReadOnlyCollection<WorkflowExecutionRecord>> ListAsync(
        string? workflowId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        string? keyword,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var normalizedKeyword = string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim();
        var query = string.IsNullOrWhiteSpace(workflowId)
            ? _executions.FindAll()
            : _executions.Find(execution => execution.WorkflowId == workflowId);

        var executions = query
            .OrderByDescending(execution => execution.StartedAt)
            .Select(document => SystemJsonSerializer.Deserialize<WorkflowExecutionRecord>(document.Json, JsonOptions))
            .Where(execution => execution is not null)
            .Select(execution => execution!)
            .Where(execution => !from.HasValue || execution.StartedAt >= from.Value)
            .Where(execution => !to.HasValue || execution.StartedAt <= to.Value)
            .Where(execution => normalizedKeyword is null || MatchesKeyword(execution, normalizedKeyword))
            .Take(200)
            .ToList();

        return Task.FromResult<IReadOnlyCollection<WorkflowExecutionRecord>>(executions);
    }

    private static bool MatchesKeyword(WorkflowExecutionRecord execution, string keyword)
    {
        if (execution.Id.Contains(keyword, StringComparison.OrdinalIgnoreCase)) return true;
        if (!string.IsNullOrWhiteSpace(execution.Error)
            && execution.Error.Contains(keyword, StringComparison.OrdinalIgnoreCase)) return true;

        return execution.NodeExecutions.Any(node =>
            node.NodeId.Contains(keyword, StringComparison.OrdinalIgnoreCase)
            || node.NodeName.Contains(keyword, StringComparison.OrdinalIgnoreCase)
            || node.NodeType.Contains(keyword, StringComparison.OrdinalIgnoreCase)
            || (!string.IsNullOrWhiteSpace(node.Error)
                && node.Error.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            || SystemJsonSerializer.Serialize(node.Input, JsonOptions)
                .Contains(keyword, StringComparison.OrdinalIgnoreCase)
            || SystemJsonSerializer.Serialize(node.Output, JsonOptions)
                .Contains(keyword, StringComparison.OrdinalIgnoreCase));
    }
}

public sealed class WorkflowExecutionDocument
{
    [BsonId]
    public required string Id { get; init; }

    public required string WorkflowId { get; init; }

    public DateTimeOffset StartedAt { get; init; }

    public required string Json { get; init; }
}
