using System.Collections.Concurrent;

namespace EaseGPT.Workflows.Execution;

public sealed class WorkflowExecutionControl : IWorkflowExecutionControl, IDisposable
{
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _executions =
        new(StringComparer.OrdinalIgnoreCase);

    public CancellationToken Register(string executionId, CancellationToken requestCancellationToken)
    {
        var source = CancellationTokenSource.CreateLinkedTokenSource(requestCancellationToken);
        if (!_executions.TryAdd(executionId, source))
        {
            source.Dispose();
            throw new InvalidOperationException($"Execution '{executionId}' is already registered.");
        }

        return source.Token;
    }

    public bool Cancel(string executionId)
    {
        if (!_executions.TryGetValue(executionId, out var source))
        {
            return false;
        }

        source.Cancel();
        return true;
    }

    public void Complete(string executionId)
    {
        if (_executions.TryRemove(executionId, out var source))
        {
            source.Dispose();
        }
    }

    public void Dispose()
    {
        foreach (var source in _executions.Values)
        {
            source.Dispose();
        }

        _executions.Clear();
    }
}
