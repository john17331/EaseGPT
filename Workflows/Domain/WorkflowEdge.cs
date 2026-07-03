namespace EaseGPT.Workflows.Domain;

/// <summary>
/// 节点连线。SourcePort 支持条件节点输出 true/false 等分支。
/// </summary>
public sealed class WorkflowEdge
{
    public required string SourceNodeId { get; init; }

    public string SourcePort { get; init; } = "main";

    public required string TargetNodeId { get; init; }
}

