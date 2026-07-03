using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed class ManualTriggerNode : IWorkflowNode
{
    public string Type => "trigger.manual";

    public string DisplayName => "用户输入";

    public string Description => "通过 API 手动触发工作流，用于测试和人工启动。";

    public Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
        => Task.FromResult(NodeExecutionResult.Continue(new Dictionary<string, object?>(context.Input)));
}
