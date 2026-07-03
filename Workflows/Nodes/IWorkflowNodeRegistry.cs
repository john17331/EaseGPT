namespace EaseGPT.Workflows.Nodes;

public interface IWorkflowNodeRegistry
{
    IReadOnlyCollection<WorkflowNodeDescriptor> List();

    IWorkflowNode Get(string type);
}

public sealed record WorkflowNodeDescriptor(string Type, string DisplayName, string Description);

