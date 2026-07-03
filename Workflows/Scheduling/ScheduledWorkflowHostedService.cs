using System.Collections.Concurrent;
using Cronos;
using EaseGPT.Workflows.Execution;
using EaseGPT.Workflows.Storage;

namespace EaseGPT.Workflows.Scheduling;

/// <summary>
/// 定时触发后台服务。
/// 设计上把 trigger.schedule 当成普通触发节点，使手动触发和定时触发共用同一套执行器。
/// </summary>
public sealed class ScheduledWorkflowHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IWorkflowSchedulerClock _clock;
    private readonly ILogger<ScheduledWorkflowHostedService> _logger;
    private readonly ConcurrentDictionary<string, ScheduleState> _schedules = new(StringComparer.OrdinalIgnoreCase);

    public ScheduledWorkflowHostedService(
        IServiceProvider serviceProvider,
        IWorkflowSchedulerClock clock,
        ILogger<ScheduledWorkflowHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _clock = clock;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await TickAsync(stoppingToken);
        }
    }

    private async Task TickAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IWorkflowStore>();
        var executor = scope.ServiceProvider.GetRequiredService<IWorkflowExecutor>();
        var workflows = await store.ListAsync(cancellationToken);

        foreach (var workflow in workflows.Where(workflow => workflow.Enabled))
        {
            var scheduleNodes = workflow.Nodes.Where(node => node.Type.Equals("trigger.schedule", StringComparison.OrdinalIgnoreCase));
            foreach (var scheduleNode in scheduleNodes)
            {
                var key = $"{workflow.Id}:{scheduleNode.Id}";
                var now = _clock.UtcNow;
                ScheduleConfiguration configuration;
                try
                {
                    configuration = ReadConfiguration(scheduleNode);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Invalid schedule configuration for workflow {WorkflowId}, node {NodeId}.", workflow.Id, scheduleNode.Id);
                    continue;
                }

                var state = _schedules.GetOrAdd(key, _ => new ScheduleState(
                    configuration.Signature,
                    GetNextRun(configuration, now)));
                if (!state.Signature.Equals(configuration.Signature, StringComparison.Ordinal))
                {
                    state = new ScheduleState(configuration.Signature, GetNextRun(configuration, now));
                    _schedules[key] = state;
                }

                if (state.NextRun is null || state.NextRun > now)
                {
                    continue;
                }

                _schedules[key] = new ScheduleState(configuration.Signature, GetNextRun(configuration, now));
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await executor.ExecuteAsync(new WorkflowExecutionRequest
                        {
                            WorkflowId = workflow.Id,
                            TriggerNodeId = scheduleNode.Id,
                            Input =
                            {
                                ["scheduledAt"] = now,
                                ["trigger"] = "schedule"
                            }
                        }, cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Scheduled workflow {WorkflowId} failed.", workflow.Id);
                    }
                }, cancellationToken);
            }
        }
    }

    private static ScheduleConfiguration ReadConfiguration(Domain.WorkflowNodeDefinition node)
    {
        var scheduleType = node.Settings.TryGetValue("scheduleType", out var scheduleTypeValue)
            ? scheduleTypeValue.GetString() ?? "interval"
            : "interval";
        if (!scheduleType.Equals("cron", StringComparison.OrdinalIgnoreCase))
        {
            var seconds = node.Settings.TryGetValue("intervalSeconds", out var intervalValue)
                          && intervalValue.TryGetInt32(out var parsedSeconds)
                ? Math.Clamp(parsedSeconds, 1, 86_400)
                : 60;
            return new ScheduleConfiguration("interval", seconds, null, null, $"interval:{seconds}");
        }

        var cronExpression = node.Settings.TryGetValue("cronExpression", out var cronValue)
            ? cronValue.GetString()
            : null;
        if (string.IsNullOrWhiteSpace(cronExpression))
        {
            throw new InvalidOperationException("Cron expression is required.");
        }

        var timeZoneId = node.Settings.TryGetValue("timeZone", out var timeZoneValue)
            ? timeZoneValue.GetString() ?? "Asia/Shanghai"
            : "Asia/Shanghai";
        var timeZone = ResolveTimeZone(timeZoneId);
        CronExpression.Parse(cronExpression, CronFormat.Standard);
        return new ScheduleConfiguration("cron", null, cronExpression, timeZone, $"cron:{cronExpression}:{timeZone.Id}");
    }

    private static DateTimeOffset? GetNextRun(ScheduleConfiguration configuration, DateTimeOffset now)
        => configuration.Type == "cron"
            ? CronExpression.Parse(configuration.CronExpression!, CronFormat.Standard)
                .GetNextOccurrence(now, configuration.TimeZone!, inclusive: false)
            : now.AddSeconds(configuration.IntervalSeconds!.Value);

    private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException) when (timeZoneId.Equals("Asia/Shanghai", StringComparison.OrdinalIgnoreCase))
        {
            return TimeZoneInfo.FindSystemTimeZoneById("China Standard Time");
        }
    }

    private sealed record ScheduleConfiguration(
        string Type,
        int? IntervalSeconds,
        string? CronExpression,
        TimeZoneInfo? TimeZone,
        string Signature);

    private sealed record ScheduleState(string Signature, DateTimeOffset? NextRun);
}
