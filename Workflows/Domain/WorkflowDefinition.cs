namespace EaseGPT.Workflows.Domain;

/// <summary>
/// 工作流定义。借鉴 Dify/n8n 的图模型：节点描述“做什么”，连线描述“下一步去哪里”。
/// </summary>
public sealed class WorkflowDefinition
{
    public required string Id { get; init; }

    public required string Name { get; set; }

    public string? Description { get; set; }

    public string? Icon { get; set; }

    public bool Enabled { get; set; } = true;

    public List<WorkflowNodeDefinition> Nodes { get; set; } = [];

    public List<WorkflowEdge> Edges { get; set; } = [];

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
