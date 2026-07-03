using System.Text.RegularExpressions;

namespace EaseGPT.Workflows.Nodes;

internal static partial class TemplateRenderer
{
    public static string Render(string template, IReadOnlyDictionary<string, object?> input, IDictionary<string, object?> variables)
        => TokenRegex().Replace(template, match =>
        {
            var key = match.Groups["key"].Value.Trim();
            return ValueResolver.Resolve(key, input, variables)?.ToString() ?? string.Empty;
        });

    [GeneratedRegex("\\{\\{(?<key>[^}]+)\\}\\}")]
    private static partial Regex TokenRegex();
}
