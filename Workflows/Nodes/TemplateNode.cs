using System.Text.Json;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed class TemplateNode : IWorkflowNode
{
    private const string CustomVariable = "__custom__";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public string Type => "data.template";

    public string DisplayName => "输出";

    public string Description => "选择工作流变量或使用支持 {{变量}} 的自定义内容作为最终输出。";

    public Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var variable = context.GetString("variable");
        if (string.IsNullOrWhiteSpace(variable))
        {
            var allVariablesOutput = new Dictionary<string, object?>(context.Input);
            return Task.FromResult(CreateResult(context, allVariablesOutput, allVariablesOutput));
        }

        if (variable.Equals(CustomVariable, StringComparison.Ordinal))
        {
            var customValue = context.GetString("customValue") ?? string.Empty;
            var rendered = TemplateRenderer.Render(customValue, context.Input, context.Variables);
            var customOutput = new Dictionary<string, object?>
            {
                ["text"] = rendered
            };
            return Task.FromResult(CreateResult(context, customOutput, rendered));
        }

        var outputKey = variable.Contains('.') ? variable[(variable.LastIndexOf('.') + 1)..] : variable;
        var resolvedValue = ValueResolver.Resolve(variable, context.Input, context.Variables);
        var output = new Dictionary<string, object?>
        {
            [outputKey] = resolvedValue
        };

        return Task.FromResult(CreateResult(context, output, resolvedValue));
    }

    private static NodeExecutionResult CreateResult(
        NodeExecutionContext context,
        Dictionary<string, object?> output,
        object? tableSource)
        => NodeExecutionResult.Continue(
            output,
            presentation: BuildTablePresentation(context, tableSource));

    private static Dictionary<string, object?>? BuildTablePresentation(
        NodeExecutionContext context,
        object? source)
    {
        if (!string.Equals(context.GetString("outputFormat"), "table", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var columns = context.GetSetting<List<TemplateTableColumnSetting>>("tableColumns") ?? [];
        columns = columns
            .Where(column => !string.IsNullOrWhiteSpace(column.Title) && !string.IsNullOrWhiteSpace(column.Path))
            .ToList();
        if (columns.Count == 0 || !TryGetJsonRows(source, out var jsonRows))
        {
            return null;
        }

        var presentationColumns = columns
            .Select((column, index) => new Dictionary<string, object?>
            {
                ["key"] = string.IsNullOrWhiteSpace(column.Id) ? $"column-{index + 1}" : column.Id,
                ["title"] = column.Title
            })
            .ToList();

        var rows = jsonRows.Select(row =>
        {
            var values = new Dictionary<string, object?>();
            for (var index = 0; index < columns.Count; index++)
            {
                var column = columns[index];
                var key = string.IsNullOrWhiteSpace(column.Id) ? $"column-{index + 1}" : column.Id;
                values[key] = TryResolveJsonPath(row, column.Path, out var value)
                    ? ToDisplayValue(value)
                    : null;
            }
            return values;
        }).ToList();

        return new Dictionary<string, object?>
        {
            ["type"] = "table",
            ["columns"] = presentationColumns,
            ["rows"] = rows
        };
    }

    private static bool TryGetJsonRows(object? source, out List<JsonElement> rows)
    {
        rows = [];
        if (!TryConvertToJson(source, out var root))
        {
            return false;
        }

        if (root.ValueKind == JsonValueKind.Object)
        {
            var properties = root.EnumerateObject().ToList();
            if (properties.Count == 1 && properties[0].Value.ValueKind == JsonValueKind.Array)
            {
                root = properties[0].Value;
            }
        }

        if (root.ValueKind == JsonValueKind.Array)
        {
            rows = root.EnumerateArray().Select(item => item.Clone()).ToList();
            return true;
        }

        if (root.ValueKind == JsonValueKind.Object)
        {
            rows.Add(root.Clone());
            return true;
        }

        return false;
    }

    private static bool TryConvertToJson(object? source, out JsonElement root)
    {
        root = default;
        if (source is null)
        {
            return false;
        }

        if (source is JsonElement element)
        {
            if (element.ValueKind == JsonValueKind.String)
            {
                return TryConvertToJson(element.GetString(), out root);
            }
            root = element.Clone();
        }
        else if (source is string text)
        {
            try
            {
                using var document = JsonDocument.Parse(text);
                root = document.RootElement.Clone();
            }
            catch (JsonException)
            {
                return false;
            }
        }
        else
        {
            root = JsonSerializer.SerializeToElement(source, JsonOptions);
        }

        return root.ValueKind is JsonValueKind.Array or JsonValueKind.Object;
    }

    private static bool TryResolveJsonPath(JsonElement row, string path, out JsonElement value)
    {
        value = row;
        var normalizedPath = path.Trim();
        if (normalizedPath == "$")
        {
            return true;
        }
        if (normalizedPath.StartsWith("$.", StringComparison.Ordinal))
        {
            normalizedPath = normalizedPath[2..];
        }

        foreach (var segment in normalizedPath.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (value.ValueKind == JsonValueKind.Object)
            {
                var found = value.EnumerateObject()
                    .FirstOrDefault(property => property.Name.Equals(segment, StringComparison.OrdinalIgnoreCase));
                if (found.Name is null)
                {
                    value = default;
                    return false;
                }
                value = found.Value;
                continue;
            }

            if (value.ValueKind == JsonValueKind.Array
                && int.TryParse(segment, out var index)
                && index >= 0
                && index < value.GetArrayLength())
            {
                value = value[index];
                continue;
            }

            value = default;
            return false;
        }

        return true;
    }

    private static object? ToDisplayValue(JsonElement value)
        => value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number when value.TryGetInt64(out var integer) => integer,
            JsonValueKind.Number when value.TryGetDecimal(out var number) => number,
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => value.GetRawText()
        };

}

public sealed class TemplateTableColumnSetting
{
    public string Id { get; init; } = string.Empty;

    public string Title { get; init; } = string.Empty;

    public string Path { get; init; } = string.Empty;
}
