namespace EaseGPT.Workflows.Execution;

/// <summary>
/// 节点输出。OutputPort 决定走哪条分支，Data 会传给后继节点。
/// </summary>
public sealed class NodeExecutionResult
{
    public string OutputPort { get; init; } = "main";

    /// <summary>
    /// Data passed to downstream nodes.
    /// </summary>
    public Dictionary<string, object?> Data { get; init; } = [];

    /// <summary>
    /// Optional output shown in execution records. Use it for node-local diagnostic data
    /// that should not be passed to downstream nodes.
    /// </summary>
    public Dictionary<string, object?>? RecordedOutput { get; init; }

    /// <summary>
    /// Optional effective input shown in execution records. Nodes can use this to expose
    /// the fully resolved request without changing data passed through the workflow.
    /// </summary>
    public Dictionary<string, object?>? RecordedInput { get; init; }

    /// <summary>
    /// Optional UI presentation metadata. It is recorded for clients but never passed downstream.
    /// </summary>
    public Dictionary<string, object?>? Presentation { get; init; }

    public static NodeExecutionResult Continue(
        Dictionary<string, object?>? data = null,
        string outputPort = "main",
        Dictionary<string, object?>? recordedOutput = null,
        Dictionary<string, object?>? recordedInput = null,
        Dictionary<string, object?>? presentation = null)
        => new()
        {
            OutputPort = outputPort,
            Data = data ?? [],
            RecordedOutput = recordedOutput,
            RecordedInput = recordedInput,
            Presentation = presentation
        };
}
