namespace EaseGPT.Workflows.Nodes;

internal static class ValueResolver
{
    public static object? Resolve(string key, IReadOnlyDictionary<string, object?> input, IDictionary<string, object?> variables)
    {
        if (key.StartsWith("input.", StringComparison.OrdinalIgnoreCase))
        {
            return TryGet(input, key["input.".Length..]);
        }

        if (key.StartsWith("var.", StringComparison.OrdinalIgnoreCase))
        {
            return TryGet(variables, key["var.".Length..]);
        }

        return TryGet(input, key) ?? TryGet(variables, key);
    }

    private static object? TryGet(IReadOnlyDictionary<string, object?> values, string key)
        => values.TryGetValue(key, out var value) ? value : null;

    private static object? TryGet(IDictionary<string, object?> values, string key)
        => values.TryGetValue(key, out var value) ? value : null;
}
