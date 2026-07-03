using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed class ScheduleTriggerNode : IWorkflowNode
{
    public string Type => "trigger.schedule";

    public string DisplayName => "定时触发";

    public string Description => "由后台调度器按固定间隔或 Cron 表达式触发。";

    public Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var data = new Dictionary<string, object?>
        {
            ["scheduledAt"] = DateTimeOffset.UtcNow,
            ["triggerNodeId"] = context.Node.Id
        };

        return Task.FromResult(NodeExecutionResult.Continue(data));
    }
}
