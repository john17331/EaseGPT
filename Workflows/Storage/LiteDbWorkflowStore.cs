using System.Text.Json;
using EaseGPT.Workflows.Domain;
using LiteDB;
using SystemJsonSerializer = System.Text.Json.JsonSerializer;

namespace EaseGPT.Workflows.Storage;

/// <summary>
/// 使用 LiteDB 持久化工作流定义。
/// 工作流以 JSON 字符串保存，避免节点 Settings 中的 JsonElement 被 LiteDB 映射器误解。
/// </summary>
public sealed class LiteDbWorkflowStore : IWorkflowStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly HashSet<string> RemovedNodeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "data.set-variable",
        "logic.condition",
        "utility.log",
        "flow.delay"
    };
    private readonly ILiteCollection<WorkflowDocument> _workflows;

    public LiteDbWorkflowStore(LiteDbContext context)
    {
        _workflows = context.Database.GetCollection<WorkflowDocument>("workflows");
        _workflows.EnsureIndex(workflow => workflow.Id, unique: true);
        MigrateOutputNodes();
        RemoveDeletedNodes();
    }

    public Task<IReadOnlyCollection<WorkflowDefinition>> ListAsync(CancellationToken cancellationToken)
    {
        var workflows = _workflows
            .FindAll()
            .Select(document => Deserialize(document.Json))
            .OrderBy(workflow => workflow.Name)
            .ToList();

        return Task.FromResult<IReadOnlyCollection<WorkflowDefinition>>(workflows);
    }

    public Task<WorkflowDefinition?> GetAsync(string id, CancellationToken cancellationToken)
    {
        var document = _workflows.FindById(id);
        return Task.FromResult(document is null ? null : Deserialize(document.Json));
    }

    public Task SaveAsync(WorkflowDefinition workflow, CancellationToken cancellationToken)
    {
        workflow.UpdatedAt = DateTimeOffset.UtcNow;
        _workflows.Upsert(new WorkflowDocument
        {
            Id = workflow.Id,
            Json = SystemJsonSerializer.Serialize(workflow, JsonOptions),
            UpdatedAt = workflow.UpdatedAt
        });

        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        _workflows.Delete(id);
        return Task.CompletedTask;
    }

    private void MigrateOutputNodes()
    {
        foreach (var document in _workflows.FindAll().ToList())
        {
            var workflow = Deserialize(document.Json);
            var changed = false;
            foreach (var outputNode in workflow.Nodes.Where(node =>
                         node.Type.Equals("data.template", StringComparison.OrdinalIgnoreCase)
                         && !node.Settings.ContainsKey("variable")))
            {
                var variable = TryReadLegacyVariable(outputNode);
                var description = outputNode.Settings.TryGetValue("description", out var descriptionValue)
                    ? descriptionValue
                    : (JsonElement?)null;

                outputNode.Settings.Clear();
                outputNode.Settings["variable"] = SystemJsonSerializer.SerializeToElement(variable, JsonOptions);
                if (description is not null)
                {
                    outputNode.Settings["description"] = description.Value;
                }
                changed = true;
            }

            if (!changed)
            {
                continue;
            }

            workflow.UpdatedAt = DateTimeOffset.UtcNow;
            _workflows.Upsert(new WorkflowDocument
            {
                Id = workflow.Id,
                Json = SystemJsonSerializer.Serialize(workflow, JsonOptions),
                UpdatedAt = workflow.UpdatedAt
            });
        }
    }

    private static string TryReadLegacyVariable(WorkflowNodeDefinition node)
    {
        if (!node.Settings.TryGetValue("template", out var templateValue)
            || templateValue.ValueKind != JsonValueKind.String)
        {
            return string.Empty;
        }

        var template = templateValue.GetString()?.Trim() ?? string.Empty;
        return template.StartsWith("{{", StringComparison.Ordinal)
               && template.EndsWith("}}", StringComparison.Ordinal)
               && template.IndexOf("}}", StringComparison.Ordinal) == template.Length - 2
            ? template[2..^2].Trim()
            : string.Empty;
    }

    private void RemoveDeletedNodes()
    {
        foreach (var document in _workflows.FindAll().ToList())
        {
            var workflow = Deserialize(document.Json);
            var removedNodeIds = workflow.Nodes
                .Where(node => RemovedNodeTypes.Contains(node.Type))
                .Select(node => node.Id)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (removedNodeIds.Count == 0)
            {
                continue;
            }

            workflow.Nodes.RemoveAll(node => removedNodeIds.Contains(node.Id));
            workflow.Edges.RemoveAll(edge =>
                removedNodeIds.Contains(edge.SourceNodeId) || removedNodeIds.Contains(edge.TargetNodeId));
            workflow.UpdatedAt = DateTimeOffset.UtcNow;

            _workflows.Upsert(new WorkflowDocument
            {
                Id = workflow.Id,
                Json = SystemJsonSerializer.Serialize(workflow, JsonOptions),
                UpdatedAt = workflow.UpdatedAt
            });
        }
    }

    private static WorkflowDefinition Deserialize(string json)
        => SystemJsonSerializer.Deserialize<WorkflowDefinition>(json, JsonOptions)
            ?? throw new InvalidOperationException("Workflow document could not be deserialized.");
}

public sealed class WorkflowDocument
{
    [BsonId]
    public required string Id { get; init; }

    public required string Json { get; init; }

    public DateTimeOffset UpdatedAt { get; init; }
}
