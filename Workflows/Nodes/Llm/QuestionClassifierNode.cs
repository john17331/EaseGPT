using System.Text;
using System.Text.Json;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes.Llm;

/// <summary>
/// Uses an LLM to classify text and exposes the selected class ID as the output port.
/// Downstream edges should use the class ID as their SourcePort.
/// </summary>
public sealed class QuestionClassifierNode : IWorkflowNode
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly LlmChatProviderRegistry _providerRegistry;
    private readonly ILlmProviderConfigStore _configStore;

    public QuestionClassifierNode(LlmChatProviderRegistry providerRegistry, ILlmProviderConfigStore configStore)
    {
        _providerRegistry = providerRegistry;
        _configStore = configStore;
    }

    public string Type => "ai.question-classifier";

    public string DisplayName => "问题分类器";

    public string Description => "使用大模型理解输入语义，并按配置的分类选择工作流分支。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var classes = context.GetSetting<List<QuestionClassDefinition>>("classes") ?? [];
        ValidateClasses(classes);

        var inputTemplate = context.GetString("input") ?? "{{question}}";
        var input = TemplateRenderer.Render(inputTemplate, context.Input, context.Variables).Trim();
        if (string.IsNullOrWhiteSpace(input))
        {
            throw new InvalidOperationException("问题分类器的输入内容不能为空。");
        }

        var providerConfigId = context.GetString("providerConfigId")
            ?? throw new InvalidOperationException("问题分类器必须配置 providerConfigId。");
        var providerConfig = await _configStore.GetAsync(providerConfigId, context.CancellationToken)
            ?? throw new InvalidOperationException($"LLM provider config '{providerConfigId}' was not found.");
        if (!providerConfig.Enabled)
        {
            throw new InvalidOperationException($"LLM provider config '{providerConfigId}' is disabled.");
        }

        var preset = _providerRegistry.GetPreset(providerConfig.Provider);
        var apiKey = ResolveApiKey(providerConfig, preset);
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException($"LLM provider config '{providerConfigId}' does not contain an API key.");
        }

        var request = new LlmChatRequest
        {
            Provider = providerConfig.Provider,
            Endpoint = providerConfig.Endpoint ?? preset.DefaultEndpoint,
            Model = providerConfig.Model ?? throw new InvalidOperationException($"LLM provider config '{providerConfigId}' does not contain a model."),
            ApiKey = apiKey,
            Temperature = 0,
            Stream = false,
            Messages =
            [
                new LlmChatMessage { Role = "system", Content = BuildSystemPrompt(classes, context.GetString("instruction")) },
                new LlmChatMessage { Role = "user", Content = input }
            ]
        };

        var provider = _providerRegistry.GetProvider(preset);
        var response = await provider.ChatAsync(request, context.CancellationToken);
        var classId = ParseClassId(response.Text);
        var selectedClass = classes.FirstOrDefault(item =>
            string.Equals(item.Id, classId, StringComparison.OrdinalIgnoreCase));

        if (selectedClass is null)
        {
            var fallbackClassId = context.GetString("fallbackClassId");
            selectedClass = classes.FirstOrDefault(item =>
                string.Equals(item.Id, fallbackClassId, StringComparison.OrdinalIgnoreCase));
        }

        if (selectedClass is null)
        {
            throw new InvalidOperationException($"LLM returned unknown question class '{classId}'.");
        }

        var output = new Dictionary<string, object?>(context.Input)
        {
            ["questionClassId"] = selectedClass.Id,
            ["questionClassName"] = selectedClass.Name
        };
        var recordedOutput = new Dictionary<string, object?>(output)
        {
            ["classifierRawResponse"] = response.RawResponse
        };

        var recordedInput = new Dictionary<string, object?>
        {
            ["provider"] = request.Provider,
            ["model"] = request.Model,
            ["temperature"] = request.Temperature,
            ["messages"] = request.Messages
        };

        return NodeExecutionResult.Continue(output, selectedClass.Id, recordedOutput, recordedInput);
    }

    private static string BuildSystemPrompt(IReadOnlyCollection<QuestionClassDefinition> classes, string? instruction)
    {
        var classJson = JsonSerializer.Serialize(classes.Select(item => new
        {
            id = item.Id,
            name = item.Name,
            description = item.Description
        }), JsonOptions);

        var prompt = new StringBuilder()
            .AppendLine("你是问题分类器。请判断用户输入最符合下面哪个分类。")
            .AppendLine("只返回严格 JSON，不要返回 Markdown 或解释，格式为：{\"classId\":\"分类ID\"}。")
            .AppendLine($"可选分类：{classJson}");

        if (!string.IsNullOrWhiteSpace(instruction))
        {
            prompt.AppendLine($"补充要求：{instruction.Trim()}");
        }

        return prompt.ToString();
    }

    private static string ParseClassId(string response)
    {
        var text = response.Trim();
        if (text.StartsWith("```", StringComparison.Ordinal))
        {
            var firstLineEnd = text.IndexOf('\n');
            var lastFence = text.LastIndexOf("```", StringComparison.Ordinal);
            if (firstLineEnd >= 0 && lastFence > firstLineEnd)
            {
                text = text[(firstLineEnd + 1)..lastFence].Trim();
            }
        }

        try
        {
            using var document = JsonDocument.Parse(text);
            if (document.RootElement.TryGetProperty("classId", out var classId)
                && classId.ValueKind == JsonValueKind.String
                && !string.IsNullOrWhiteSpace(classId.GetString()))
            {
                return classId.GetString()!;
            }
        }
        catch (JsonException)
        {
            // Some compatible providers may ignore the JSON-only instruction; accept a bare ID below.
        }

        return text.Trim('"', '\'', ' ', '\r', '\n');
    }

    private static string? ResolveApiKey(LlmProviderConfig config, LlmProviderPreset preset)
    {
        if (!string.IsNullOrWhiteSpace(config.ApiKey))
        {
            return config.ApiKey;
        }

        var environmentVariable = config.ApiKeyEnvironmentVariable ?? preset.DefaultApiKeyEnvironmentVariable;
        return string.IsNullOrWhiteSpace(environmentVariable)
            ? null
            : Environment.GetEnvironmentVariable(environmentVariable);
    }

    private static void ValidateClasses(IReadOnlyCollection<QuestionClassDefinition> classes)
    {
        if (classes.Count < 2)
        {
            throw new InvalidOperationException("问题分类器至少需要两个分类。");
        }

        if (classes.Any(item => string.IsNullOrWhiteSpace(item.Id) || string.IsNullOrWhiteSpace(item.Name)))
        {
            throw new InvalidOperationException("每个问题分类都必须配置分类 ID 和名称。");
        }

        if (classes.GroupBy(item => item.Id, StringComparer.OrdinalIgnoreCase).Any(group => group.Count() > 1))
        {
            throw new InvalidOperationException("问题分类的分类 ID 不能重复。");
        }
    }
}

public sealed class QuestionClassDefinition
{
    public string Id { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;
}
