namespace EaseGPT.Workflows.Scheduling;

public interface IWorkflowSchedulerClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed class SystemWorkflowSchedulerClock : IWorkflowSchedulerClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}

