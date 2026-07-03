using System.Text.Json;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes.Llm;

public sealed class LlmChatNode : IWorkflowNode
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly LlmChatProviderRegistry _providerRegistry;
    private readonly ILlmProviderConfigStore _configStore;

    public LlmChatNode(LlmChatProviderRegistry providerRegistry, ILlmProviderConfigStore configStore)
    {
        _providerRegistry = providerRegistry;
        _configStore = configStore;
    }

    public string Type => "ai.llm-chat";

    public string DisplayName => "LLM";

    public string Description => "通用 LLM 对话节点，支持可扩展模型提供商、消息和文件输入。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var providerConfig = await ResolveProviderConfigAsync(context);
        var providerName = context.GetString("provider") ?? providerConfig?.Provider ?? "openai";
        var preset = _providerRegistry.GetPreset(providerName);
        var request = BuildRequest(context, providerName, preset, providerConfig);
        var provider = _providerRegistry.GetProvider(preset);
        var timeoutSeconds = Math.Clamp(context.GetInt32("timeoutSeconds") ?? 120, 1, 600);
        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
        timeoutSource.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

        LlmChatResponse response;
        try
        {
            response = request.Stream
                ? await provider.ChatStreamAsync(request, delta => context.EmitAsync("node.output.delta", delta), timeoutSource.Token)
                : await provider.ChatAsync(request, timeoutSource.Token);
        }
        catch (OperationCanceledException) when (!context.CancellationToken.IsCancellationRequested)
        {
            throw new LlmRequestTimeoutException(timeoutSeconds);
        }

        var output = new Dictionary<string, object?>(context.Input);
        output.Remove("llmRawResponse");
        output.Remove("reasoning_content");
        output.Remove("llmReasoningContent");

        output["llmText"] = response.Text;
        output["llmProvider"] = response.Provider;
        output["llmModel"] = response.Model;

        var recordedOutput = new Dictionary<string, object?>(output)
        {
            ["llmRawResponse"] = response.RawResponse,
            ["reasoning_content"] = response.ReasoningContent
        };

        return NodeExecutionResult.Continue(
            output,
            recordedOutput: recordedOutput,
            recordedInput: BuildRecordedInput(request, timeoutSeconds));
    }

    private static Dictionary<string, object?> BuildRecordedInput(LlmChatRequest request, int timeoutSeconds)
        => new()
        {
            ["provider"] = request.Provider,
            ["model"] = request.Model,
            ["temperature"] = request.Temperature,
            ["imageDetail"] = request.ImageDetail,
            ["stream"] = request.Stream,
            ["timeoutSeconds"] = timeoutSeconds,
            ["messages"] = request.Messages,
            ["files"] = request.Files.Select(file => new
            {
                file.Name,
                file.MimeType,
                file.Url,
                file.Text,
                file.Detail,
                HasBase64 = !string.IsNullOrWhiteSpace(file.Base64)
            }).ToList()
        };

    private async Task<LlmProviderConfig?> ResolveProviderConfigAsync(NodeExecutionContext context)
    {
        var configId = context.GetString("providerConfigId");
        if (string.IsNullOrWhiteSpace(configId))
        {
            return null;
        }

        var config = await _configStore.GetAsync(configId, context.CancellationToken);
        if (config is null)
        {
            throw new InvalidOperationException($"LLM provider config '{configId}' was not found.");
        }

        if (!config.Enabled)
        {
            throw new InvalidOperationException($"LLM provider config '{configId}' is disabled.");
        }

        return config;
    }

    private static LlmChatRequest BuildRequest(
        NodeExecutionContext context,
        string providerName,
        LlmProviderPreset preset,
        LlmProviderConfig? providerConfig)
    {
        var endpoint = context.GetString("endpoint") ?? providerConfig?.Endpoint ?? preset.DefaultEndpoint;
        var model = context.GetString("model") ?? providerConfig?.Model ?? throw new InvalidOperationException("Setting 'model' is required.");
        var apiKey = ResolveApiKey(context, preset, providerConfig);
        var messages = ResolveMessages(context);
        var files = ResolveFiles(context);

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("LLM API key is required. Set apiKey or apiKeyEnvironmentVariable in node settings.");
        }

        return new LlmChatRequest
        {
            Provider = providerName,
            Endpoint = endpoint,
            Model = model,
            ApiKey = apiKey,
            Temperature = ResolveTemperature(context, providerConfig),
            ImageDetail = context.GetString("imageDetail") ?? "high",
            Stream = context.GetBoolean("stream") ?? true,
            Messages = messages,
            Files = files
        };
    }

    private static string? ResolveApiKey(NodeExecutionContext context, LlmProviderPreset preset, LlmProviderConfig? providerConfig)
    {
        var explicitApiKey = context.GetString("apiKey");
        if (!string.IsNullOrWhiteSpace(explicitApiKey))
        {
            return explicitApiKey;
        }

        if (!string.IsNullOrWhiteSpace(providerConfig?.ApiKey))
        {
            return providerConfig.ApiKey;
        }

        var environmentVariable = context.GetString("apiKeyEnvironmentVariable")
            ?? providerConfig?.ApiKeyEnvironmentVariable
            ?? preset.DefaultApiKeyEnvironmentVariable;

        return string.IsNullOrWhiteSpace(environmentVariable)
            ? null
            : Environment.GetEnvironmentVariable(environmentVariable);
    }

    private static double ResolveTemperature(NodeExecutionContext context, LlmProviderConfig? providerConfig)
    {
        var value = context.GetSetting("temperature");
        if (value is null)
        {
            return providerConfig?.Temperature ?? 0.7;
        }

        if (value.Value.ValueKind == JsonValueKind.Number && value.Value.TryGetDouble(out var temperature))
        {
            return temperature;
        }

        return context.GetInt32("temperature") is { } intValue ? intValue / 100.0 : 0.7;
    }

    private static IReadOnlyCollection<LlmChatMessage> ResolveMessages(NodeExecutionContext context)
    {
        var messages = new List<LlmChatMessage>();
        var configuredMessages = context.GetSetting<List<LlmChatMessage>>("messages") ?? [];

        foreach (var message in configuredMessages)
        {
            messages.Add(new LlmChatMessage
            {
                Role = string.IsNullOrWhiteSpace(message.Role) ? "user" : message.Role,
                Content = TemplateRenderer.Render(message.Content, context.Input, context.Variables)
            });
        }

        var systemPrompt = context.GetString("systemPrompt");
        if (!string.IsNullOrWhiteSpace(systemPrompt) && messages.All(message => message.Role != "system"))
        {
            messages.Insert(0, new LlmChatMessage
            {
                Role = "system",
                Content = TemplateRenderer.Render(systemPrompt, context.Input, context.Variables)
            });
        }

        var prompt = context.GetString("prompt");
        if (!string.IsNullOrWhiteSpace(prompt))
        {
            messages.Add(new LlmChatMessage
            {
                Role = "user",
                Content = TemplateRenderer.Render(prompt, context.Input, context.Variables)
            });
        }

        var messagesInputKey = context.GetString("messagesInputKey");
        if (!string.IsNullOrWhiteSpace(messagesInputKey)
            && context.Input.TryGetValue(messagesInputKey, out var inputMessages))
        {
            messages.AddRange(ReadInputMessages(inputMessages, context));
        }

        if (messages.Count == 0)
        {
            messages.Add(new LlmChatMessage
            {
                Role = "user",
                Content = TemplateRenderer.Render("{{question}}", context.Input, context.Variables)
            });
        }

        return messages;
    }

    private static IReadOnlyCollection<LlmChatFile> ResolveFiles(NodeExecutionContext context)
    {
        var files = new List<LlmChatFile>();
        var configuredFiles = context.GetSetting<List<LlmChatFile>>("files") ?? [];
        files.AddRange(configuredFiles.Select(file => RenderFile(file, context)));

        var filesInputKey = context.GetString("filesInputKey");
        if (!string.IsNullOrWhiteSpace(filesInputKey)
            && context.Input.TryGetValue(filesInputKey, out var inputFiles))
        {
            files.AddRange(ReadInputFiles(inputFiles, context));
        }

        return files;
    }

    private static IEnumerable<LlmChatMessage> ReadInputMessages(object? value, NodeExecutionContext context)
    {
        var messages = ConvertInput<List<LlmChatMessage>>(value) ?? [];
        return messages.Select(message => new LlmChatMessage
        {
            Role = string.IsNullOrWhiteSpace(message.Role) ? "user" : message.Role,
            Content = TemplateRenderer.Render(message.Content, context.Input, context.Variables)
        });
    }

    private static IEnumerable<LlmChatFile> ReadInputFiles(object? value, NodeExecutionContext context)
    {
        var files = ConvertInput<List<LlmChatFile>>(value) ?? [];
        return files.Select(file => RenderFile(file, context));
    }

    private static LlmChatFile RenderFile(LlmChatFile file, NodeExecutionContext context)
    {
        return new LlmChatFile
        {
            Name = TemplateRenderer.Render(file.Name, context.Input, context.Variables),
            MimeType = TemplateRenderer.Render(file.MimeType, context.Input, context.Variables),
            Url = RenderNullable(file.Url, context),
            Base64 = RenderNullable(file.Base64, context),
            Text = RenderNullable(file.Text, context),
            Detail = RenderNullable(file.Detail, context)
        };
    }

    private static string? RenderNullable(string? value, NodeExecutionContext context)
        => string.IsNullOrWhiteSpace(value) ? value : TemplateRenderer.Render(value, context.Input, context.Variables);

    private static T? ConvertInput<T>(object? value)
    {
        return value switch
        {
            null => default,
            JsonElement element => element.Deserialize<T>(JsonOptions),
            T typed => typed,
            _ => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, JsonOptions), JsonOptions)
        };
    }
}
