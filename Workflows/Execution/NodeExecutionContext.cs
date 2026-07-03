using System.Text.Json;
using EaseGPT.Workflows.Domain;

namespace EaseGPT.Workflows.Execution;

/// <summary>
/// 单个节点执行时可见的上下文。节点可以读取输入、全局变量和自身配置。
/// </summary>
public sealed class NodeExecutionContext
{
    private static readonly JsonSerializerOptions JsonOptions = JsonSerializerOptions.Web;

    public NodeExecutionContext(
        WorkflowDefinition workflow,
        WorkflowNodeDefinition node,
        IReadOnlyDictionary<string, object?> input,
        IDictionary<string, object?> variables,
        CancellationToken cancellationToken,
        string? executionId = null,
        Func<string, object?, ValueTask>? emitAsync = null)
    {
        Workflow = workflow;
        Node = node;
        Input = input;
        Variables = variables;
        CancellationToken = cancellationToken;
        ExecutionId = executionId;
        _emitAsync = emitAsync;
    }

    private readonly Func<string, object?, ValueTask>? _emitAsync;

    public WorkflowDefinition Workflow { get; }

    public WorkflowNodeDefinition Node { get; }

    public IReadOnlyDictionary<string, object?> Input { get; }

    public IDictionary<string, object?> Variables { get; }

    public CancellationToken CancellationToken { get; }

    public string? ExecutionId { get; }

    public ValueTask EmitAsync(string type, object? data)
        => _emitAsync?.Invoke(type, data) ?? ValueTask.CompletedTask;

    public string? GetString(string name)
        => Node.Settings.TryGetValue(name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    public int? GetInt32(string name)
        => Node.Settings.TryGetValue(name, out var value) && value.TryGetInt32(out var result)
            ? result
            : null;

    public bool? GetBoolean(string name)
        => Node.Settings.TryGetValue(name, out var value) && value.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? value.GetBoolean()
            : null;

    public JsonElement? GetSetting(string name)
        => Node.Settings.TryGetValue(name, out var value) ? value : null;

    public T? GetSetting<T>(string name)
        => Node.Settings.TryGetValue(name, out var value)
            ? value.Deserialize<T>(JsonOptions)
            : default;
}
