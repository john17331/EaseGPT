using System.Text.Json;

namespace EaseGPT.Workflows.Domain;

/// <summary>
/// 节点定义只保存声明式配置，执行逻辑由节点注册表中的 IWorkflowNode 提供。
/// 这让系统可以像 n8n 一样通过注册新节点扩展能力。
/// </summary>
public sealed class WorkflowNodeDefinition
{
    public required string Id { get; init; }

    public required string Type { get; init; }

    public required string Name { get; set; }

    public WorkflowNodePosition Position { get; set; } = new();

    public Dictionary<string, JsonElement> Settings { get; set; } = [];
}

public sealed class WorkflowNodePosition
{
    public double X { get; set; }

    public double Y { get; set; }
}
