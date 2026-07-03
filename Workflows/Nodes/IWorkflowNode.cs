using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public interface IWorkflowNode
{
    string Type { get; }

    string DisplayName { get; }

    string Description { get; }

    Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context);
}

