namespace EaseGPT.Workflows.Nodes;

/// <summary>
/// 节点注册表。新增节点时只需实现 IWorkflowNode 并放入这里，控制器和执行器无需改动。
/// </summary>
public sealed class WorkflowNodeRegistry : IWorkflowNodeRegistry
{
    private readonly IReadOnlyDictionary<string, IWorkflowNode> _nodes;

    public WorkflowNodeRegistry(IEnumerable<IWorkflowNode> nodes)
    {
        _nodes = nodes.ToDictionary(node => node.Type, StringComparer.OrdinalIgnoreCase);
    }

    public IReadOnlyCollection<WorkflowNodeDescriptor> List()
        => _nodes.Values
            .Select(node => new WorkflowNodeDescriptor(node.Type, node.DisplayName, node.Description))
            .OrderBy(node => node.Type)
            .ToList();

    public IWorkflowNode Get(string type)
        => _nodes.TryGetValue(type, out var node)
            ? node
            : throw new InvalidOperationException($"Node type '{type}' is not registered.");
}
