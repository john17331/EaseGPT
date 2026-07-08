using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed class CurrentTimeNode : IWorkflowNode
{
    public string Type => "utility.current-time";

    public string DisplayName => "时间";

    public string Description => "Returns the current server time with configurable base time zone and output format.";

    public Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var mode = (context.GetString("mode") ?? "local").Trim().ToLowerInvariant();
        var requestedTimeZone = (context.GetString("timeZone") ?? string.Empty).Trim();
        var format = context.GetString("format") ?? "yyyy-MM-dd HH:mm:ss zzz";
        if (string.IsNullOrWhiteSpace(format))
        {
            format = "yyyy-MM-dd HH:mm:ss zzz";
        }

        var utcNow = DateTimeOffset.UtcNow;
        var timeZone = ResolveTimeZone(mode, requestedTimeZone);
        var currentTime = TimeZoneInfo.ConvertTime(utcNow, timeZone);

        var output = new Dictionary<string, object?>
        {
            ["currentTime"] = currentTime.ToString(format),
            ["currentTimeIso"] = currentTime.ToString("O"),
            ["currentTimeUtc"] = utcNow.ToString("O"),
            ["currentTimeZone"] = timeZone.Id,
            ["currentUnixTimeSeconds"] = utcNow.ToUnixTimeSeconds()
        };

        return Task.FromResult(NodeExecutionResult.Continue(
            output,
            recordedOutput: new Dictionary<string, object?>(output)));
    }

    private static TimeZoneInfo ResolveTimeZone(string mode, string requestedTimeZone)
    {
        if (string.Equals(mode, "utc", StringComparison.OrdinalIgnoreCase))
        {
            return TimeZoneInfo.Utc;
        }

        if (!string.Equals(mode, "custom", StringComparison.OrdinalIgnoreCase))
        {
            return TimeZoneInfo.Local;
        }

        if (string.IsNullOrWhiteSpace(requestedTimeZone))
        {
            throw new InvalidOperationException("Time zone ID is required when using custom time mode.");
        }

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(requestedTimeZone);
        }
        catch (TimeZoneNotFoundException)
        {
            if (TryMapTimeZoneId(requestedTimeZone, out var mappedTimeZoneId))
            {
                return TimeZoneInfo.FindSystemTimeZoneById(mappedTimeZoneId);
            }

            throw new InvalidOperationException($"Time zone '{requestedTimeZone}' was not found.");
        }
        catch (InvalidTimeZoneException)
        {
            throw new InvalidOperationException($"Time zone '{requestedTimeZone}' is invalid.");
        }
    }

    private static bool TryMapTimeZoneId(string timeZoneId, out string mappedTimeZoneId)
    {
        mappedTimeZoneId = timeZoneId.Trim() switch
        {
            "Asia/Shanghai" => "China Standard Time",
            "Asia/Tokyo" => "Tokyo Standard Time",
            "Europe/London" => "GMT Standard Time",
            "America/New_York" => "Eastern Standard Time",
            "UTC" => "UTC",
            "China Standard Time" => "Asia/Shanghai",
            "Tokyo Standard Time" => "Asia/Tokyo",
            "GMT Standard Time" => "Europe/London",
            "Eastern Standard Time" => "America/New_York",
            _ => string.Empty
        };

        return !string.IsNullOrWhiteSpace(mappedTimeZoneId);
    }
}
