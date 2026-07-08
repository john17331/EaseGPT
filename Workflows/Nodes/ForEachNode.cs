using System.Text.Json;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed class ForEachNode : IWorkflowNode
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string Type => "flow.for-each";

    public string DisplayName => "For Each";

    public string Description => "遍历数组或 JSON 列表，并将每一项分别发送到下游节点。";

    public Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var itemsVariable = context.GetString("itemsVariable")?.Trim();
        if (string.IsNullOrWhiteSpace(itemsVariable))
        {
            throw new InvalidOperationException("For Each 节点必须配置数组变量。");
        }
        var itemVariableName = context.GetString("itemVariableName") ?? "currentItem";
        var indexVariableName = context.GetString("indexVariableName") ?? "currentIndex";
        var source = ValueResolver.Resolve(itemsVariable, context.Input, context.Variables);
        var items = ConvertToItemList(source);

        var dispatches = new List<NodeExecutionDispatch>(items.Count);
        for (var index = 0; index < items.Count; index++)
        {
            var data = new Dictionary<string, object?>(context.Input)
            {
                [itemVariableName] = items[index],
                [indexVariableName] = index,
                ["forEachCount"] = items.Count
            };

            dispatches.Add(new NodeExecutionDispatch
            {
                OutputPort = "main",
                Data = data
            });
        }

        var output = new Dictionary<string, object?>
        {
            ["itemsVariable"] = itemsVariable,
            ["itemVariableName"] = itemVariableName,
            ["indexVariableName"] = indexVariableName,
            ["itemCount"] = items.Count
        };

        return Task.FromResult(NodeExecutionResult.Continue(
            data: new Dictionary<string, object?>(context.Input),
            recordedOutput: output,
            recordedInput: new Dictionary<string, object?>
            {
                ["itemsVariable"] = itemsVariable,
                ["itemVariableName"] = itemVariableName,
                ["indexVariableName"] = indexVariableName
            },
            dispatches: dispatches));
    }

    private static List<object?> ConvertToItemList(object? source)
    {
        return source switch
        {
            null => [],
            JsonElement element => ConvertJsonElementToList(element),
            string text => ConvertJsonTextToList(text),
            IEnumerable<object?> items => items.ToList(),
            System.Collections.IEnumerable items => items.Cast<object?>().ToList(),
            _ => []
        };
    }

    private static List<object?> ConvertJsonElementToList(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Array)
        {
            return element.EnumerateArray()
                .Select(item => item.Deserialize<object?>(JsonOptions))
                .ToList();
        }

        if (element.ValueKind == JsonValueKind.String)
        {
            return ConvertJsonTextToList(element.GetString() ?? string.Empty);
        }

        return [];
    }

    private static List<object?> ConvertJsonTextToList(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return [];
        }

        try
        {
            using var document = JsonDocument.Parse(text);
            return document.RootElement.ValueKind == JsonValueKind.Array
                ? document.RootElement.EnumerateArray()
                    .Select(item => item.Deserialize<object?>(JsonOptions))
                    .ToList()
                : [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
