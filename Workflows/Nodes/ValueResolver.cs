using System.Text.Json;

namespace EaseGPT.Workflows.Nodes;

internal static class ValueResolver
{
    public static object? Resolve(string key, IReadOnlyDictionary<string, object?> input, IDictionary<string, object?> variables)
    {
        if (key.StartsWith("input.", StringComparison.OrdinalIgnoreCase))
        {
            return TryGetPath(input, key["input.".Length..]);
        }

        if (key.StartsWith("var.", StringComparison.OrdinalIgnoreCase))
        {
            return TryGetPath(variables, key["var.".Length..]);
        }

        return TryGet(input, key)
            ?? TryGet(variables, key)
            ?? TryGetPath(input, key)
            ?? TryGetPath(variables, key);
    }

    private static object? TryGet(IReadOnlyDictionary<string, object?> values, string key)
        => values.TryGetValue(key, out var value) ? value : null;

    private static object? TryGet(IDictionary<string, object?> values, string key)
        => values.TryGetValue(key, out var value) ? value : null;

    private static object? TryGetPath(IReadOnlyDictionary<string, object?> values, string key)
        => values.TryGetValue(key, out var directValue) ? directValue : ResolvePath(values, key);

    private static object? TryGetPath(IDictionary<string, object?> values, string key)
        => values.TryGetValue(key, out var directValue) ? directValue : ResolvePath(values, key);

    private static object? ResolvePath(object? source, string path)
    {
        if (source is null || string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        object? current = source;
        foreach (var segment in path.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            current = ResolveSegment(current, segment);
            if (current is null)
            {
                return null;
            }
        }

        return current;
    }

    private static object? ResolveSegment(object? source, string segment)
    {
        return source switch
        {
            IReadOnlyDictionary<string, object?> readOnly when readOnly.TryGetValue(segment, out var value) => value,
            IDictionary<string, object?> dictionary when dictionary.TryGetValue(segment, out var value) => value,
            JsonElement element => ResolveJsonSegment(element, segment),
            IList<object?> list when int.TryParse(segment, out var index) && index >= 0 && index < list.Count => list[index],
            System.Collections.IList list when int.TryParse(segment, out var index) && index >= 0 && index < list.Count => list[index],
            _ => null
        };
    }

    private static object? ResolveJsonSegment(JsonElement element, string segment)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.Name.Equals(segment, StringComparison.OrdinalIgnoreCase))
                {
                    return property.Value.Deserialize<object?>();
                }
            }
        }

        if (element.ValueKind == JsonValueKind.Array
            && int.TryParse(segment, out var index)
            && index >= 0
            && index < element.GetArrayLength())
        {
            return element[index].Deserialize<object?>();
        }

        return null;
    }
}
