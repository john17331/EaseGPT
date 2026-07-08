using System.Diagnostics;
using System.Text;
using System.Text.Json;
using EaseGPT.Knowledge;
using EaseGPT.Workflows.Domain;
using EaseGPT.Workflows.Execution;
using EaseGPT.Workflows.Nodes;
using EaseGPT.Workflows.Nodes.Llm;

namespace EaseGPT.ConversationAgents;

public sealed class ConversationAgentPreviewService
{
    private readonly ILlmProviderConfigStore _configStore;
    private readonly RagService _ragService;
    private readonly IKnowledgeStore _knowledgeStore;
    private readonly IConversationAgentExecutionLog _executionLog;
    private readonly LlmChatProviderRegistry _providerRegistry;
    private readonly AgentNode _agentNode;

    public ConversationAgentPreviewService(
        ILlmProviderConfigStore configStore,
        RagService ragService,
        IKnowledgeStore knowledgeStore,
        IConversationAgentExecutionLog executionLog,
        LlmChatProviderRegistry providerRegistry,
        AgentNode agentNode)
    {
        _configStore = configStore;
        _ragService = ragService;
        _knowledgeStore = knowledgeStore;
        _executionLog = executionLog;
        _providerRegistry = providerRegistry;
        _agentNode = agentNode;
    }

    public Task<ConversationAgentPreviewResponse> PreviewAsync(
        ConversationAgentDefinition agent,
        string message,
        IReadOnlyList<ConversationAgentPreviewMessage>? history,
        CancellationToken cancellationToken)
        => ExecutePreviewAsync(agent, message, history, null, cancellationToken);

    public Task<ConversationAgentPreviewResponse> PreviewStreamAsync(
        ConversationAgentDefinition agent,
        string message,
        IReadOnlyList<ConversationAgentPreviewMessage>? history,
        Func<ConversationAgentPreviewStreamEvent, Task> onEvent,
        CancellationToken cancellationToken)
        => ExecutePreviewAsync(agent, message, history, onEvent, cancellationToken);

    private async Task<ConversationAgentPreviewResponse> ExecutePreviewAsync(
        ConversationAgentDefinition agent,
        string message,
        IReadOnlyList<ConversationAgentPreviewMessage>? history,
        Func<ConversationAgentPreviewStreamEvent, Task>? onEvent,
        CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var steps = new List<ConversationAgentPreviewStep>();
        var execution = new ConversationAgentExecutionRecord
        {
            Id = $"agent-exec-{Guid.NewGuid():N}"[..23],
            AgentId = agent.Id,
            AgentName = agent.Name,
            Message = message,
            History = history?.ToList() ?? []
        };

        async Task ReportStepAsync(string text)
        {
            var step = new ConversationAgentPreviewStep(text, stopwatch.ElapsedMilliseconds);
            steps.Add(step);

            if (onEvent is not null)
            {
                await onEvent(new ConversationAgentPreviewStreamEvent(
                    "preview.progress",
                    stopwatch.ElapsedMilliseconds,
                    steps.ToArray(),
                    null,
                    null,
                    null));
            }
        }

        try
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                throw new ArgumentException("Message cannot be empty.", nameof(message));
            }

            if (string.IsNullOrWhiteSpace(agent.ProviderConfigId))
            {
                throw new InvalidOperationException("Please select a model first.");
            }

            var providerConfig = await _configStore.GetAsync(agent.ProviderConfigId, cancellationToken)
                ?? throw new InvalidOperationException("Selected model configuration was not found.");

            if (!providerConfig.Enabled)
            {
                throw new InvalidOperationException("Selected model configuration is disabled.");
            }

            if (!string.Equals(providerConfig.ModelType, "llm", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Selected model configuration is not an LLM.");
            }

            var providerName = string.IsNullOrWhiteSpace(providerConfig.Provider) ? "openai" : providerConfig.Provider;
            await ReportStepAsync($"Loaded model: {providerConfig.Model ?? providerConfig.Name}");

            ConversationAgentPreviewResponse result;
            if (HasConfiguredTools(agent))
            {
                result = await ExecuteWithAgentToolsAsync(
                    agent,
                    message,
                    history,
                    providerConfig,
                    ReportStepAsync,
                    cancellationToken);
            }
            else
            {
                result = await ExecuteWithStandardChatAsync(
                    agent,
                    message,
                    history,
                    providerName,
                    providerConfig,
                    ReportStepAsync,
                    cancellationToken);
            }

            stopwatch.Stop();
            execution.Status = "Completed";
            execution.Reply = result.Reply;
            execution.ExecutionMode = result.ExecutionMode;
            execution.ElapsedMilliseconds = stopwatch.ElapsedMilliseconds;
            execution.FinishedAt = DateTimeOffset.UtcNow;
            execution.StepDetails = steps.ToList();
            await _executionLog.AddAsync(execution, cancellationToken);

            var finalResult = new ConversationAgentPreviewResponse(
                result.Reply,
                stopwatch.ElapsedMilliseconds,
                steps.Select(step => step.Message).ToArray(),
                steps.ToArray(),
                result.ExecutionMode);

            if (onEvent is not null)
            {
                await onEvent(new ConversationAgentPreviewStreamEvent(
                    "preview.completed",
                    finalResult.ElapsedMilliseconds,
                    finalResult.StepDetails,
                    finalResult.Reply,
                    null,
                    finalResult.ExecutionMode));
            }

            return finalResult;
        }
        catch (OperationCanceledException)
        {
            stopwatch.Stop();
            execution.Status = "Cancelled";
            execution.Error = "Execution was cancelled.";
            execution.ElapsedMilliseconds = stopwatch.ElapsedMilliseconds;
            execution.FinishedAt = DateTimeOffset.UtcNow;
            execution.StepDetails = steps.ToList();
            await _executionLog.AddAsync(execution, CancellationToken.None);
            throw;
        }
        catch (Exception error)
        {
            stopwatch.Stop();
            execution.Status = "Failed";
            execution.Error = error.Message;
            execution.ElapsedMilliseconds = stopwatch.ElapsedMilliseconds;
            execution.FinishedAt = DateTimeOffset.UtcNow;
            execution.StepDetails = steps.ToList();
            await _executionLog.AddAsync(execution, CancellationToken.None);
            throw;
        }
    }

    private async Task<ConversationAgentPreviewResponse> ExecuteWithStandardChatAsync(
        ConversationAgentDefinition agent,
        string message,
        IReadOnlyList<ConversationAgentPreviewMessage>? history,
        string providerName,
        LlmProviderConfig providerConfig,
        Func<string, Task> reportStepAsync,
        CancellationToken cancellationToken)
    {
        var preset = _providerRegistry.GetPreset(providerName);
        var provider = _providerRegistry.GetProvider(preset);
        var messages = await BuildMessagesAsync(agent, message, history, reportStepAsync, cancellationToken);

        var request = new LlmChatRequest
        {
            Provider = providerName,
            Model = providerConfig.Model ?? providerConfig.Name,
            Endpoint = providerConfig.Endpoint ?? preset.DefaultEndpoint,
            ApiKey = ResolveApiKey(providerConfig, preset),
            Temperature = agent.Temperature > 0 ? agent.Temperature : (providerConfig.Temperature ?? 0.7),
            Stream = false,
            Messages = messages
        };

        await reportStepAsync("Calling the model");
        var response = await provider.ChatAsync(request, cancellationToken);
        await reportStepAsync("Model reply received");

        return new ConversationAgentPreviewResponse(
            response.Text,
            0,
            Array.Empty<string>(),
            Array.Empty<ConversationAgentPreviewStep>(),
            "standard-chat");
    }

    private async Task<ConversationAgentPreviewResponse> ExecuteWithAgentToolsAsync(
        ConversationAgentDefinition agent,
        string message,
        IReadOnlyList<ConversationAgentPreviewMessage>? history,
        LlmProviderConfig providerConfig,
        Func<string, Task> reportStepAsync,
        CancellationToken cancellationToken)
    {
        await reportStepAsync("Tool calling mode enabled");
        var knowledgePrompt = await BuildKnowledgePromptAsync(
            agent.KnowledgeBaseIds,
            agent,
            message,
            reportStepAsync,
            cancellationToken);
        var instruction = BuildToolCallingInstruction(agent, knowledgePrompt);
        var conversationMessage = BuildConversationMessage(message, history);

        var workflow = new WorkflowDefinition
        {
            Id = $"conversation-agent-{agent.Id}",
            Name = agent.Name,
            Description = agent.Description,
            Icon = agent.Icon,
            Nodes = [],
            Edges = []
        };

        var node = new WorkflowNodeDefinition
        {
            Id = $"conversation-agent-node-{agent.Id}",
            Type = "ai.agent",
            Name = agent.Name,
            Settings = SerializeSettings(new
            {
                providerConfigId = providerConfig.Id,
                message = "{{question}}",
                instruction,
                tools = agent.Tools ?? [],
                maxIterations = Math.Clamp(agent.MaxIterations, 1, 12),
                timeoutSeconds = Math.Clamp(agent.TimeoutSeconds, 1, 600),
                temperature = agent.Temperature > 0 ? agent.Temperature : (providerConfig.Temperature ?? 0.7)
            })
        };

        var input = new Dictionary<string, object?>
        {
            ["question"] = conversationMessage
        };
        var variables = new Dictionary<string, object?>
        {
            ["question"] = conversationMessage,
            ["agentId"] = agent.Id
        };

        ValueTask EmitAgentStepAsync(string type, object? data)
        {
            var step = MapAgentEventToStep(type, data);
            if (string.IsNullOrWhiteSpace(step))
            {
                return ValueTask.CompletedTask;
            }

            return new ValueTask(reportStepAsync(step));
        }

        var context = new NodeExecutionContext(
            workflow,
            node,
            input,
            variables,
            cancellationToken,
            executionId: $"conversation-preview-{agent.Id}",
            emitAsync: EmitAgentStepAsync);

        var result = await _agentNode.ExecuteAsync(context);
        var reply = string.Empty;
        var executionMode = "react";
        if (result.Data.TryGetValue("agentReply", out var value))
        {
            reply = Convert.ToString(value) ?? string.Empty;
        }

        if (result.Data.TryGetValue("agentExecutionMode", out var modeValue))
        {
            executionMode = Convert.ToString(modeValue) ?? executionMode;
        }

        await reportStepAsync($"Execution mode: {FormatExecutionModeLabel(executionMode)}");

        reply = reply.Trim();
        if (string.IsNullOrWhiteSpace(reply))
        {
            reply = "Model did not return any content.";
        }

        return new ConversationAgentPreviewResponse(
            reply,
            0,
            Array.Empty<string>(),
            Array.Empty<ConversationAgentPreviewStep>(),
            executionMode);
    }

    private async Task<IReadOnlyList<LlmChatMessage>> BuildMessagesAsync(
        ConversationAgentDefinition agent,
        string message,
        IReadOnlyList<ConversationAgentPreviewMessage>? history,
        Func<string, Task> reportStepAsync,
        CancellationToken cancellationToken)
    {
        var messages = new List<LlmChatMessage>();

        if (!string.IsNullOrWhiteSpace(agent.Instructions))
        {
            messages.Add(new LlmChatMessage
            {
                Role = "system",
                Content = agent.Instructions.Trim()
            });
            await reportStepAsync("Applied system instructions");
        }
        else
        {
            await reportStepAsync("No system instructions configured");
        }

        var knowledgePrompt = await BuildKnowledgePromptAsync(
            agent.KnowledgeBaseIds,
            agent,
            message,
            reportStepAsync,
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(knowledgePrompt))
        {
            messages.Add(new LlmChatMessage
            {
                Role = "system",
                Content = knowledgePrompt
            });
        }

        if (history is not null)
        {
            foreach (var item in history
                .Where(item => !string.IsNullOrWhiteSpace(item.Content))
                .TakeLast(12))
            {
                messages.Add(new LlmChatMessage
                {
                    Role = string.Equals(item.Role, "assistant", StringComparison.OrdinalIgnoreCase) ? "assistant" : "user",
                    Content = item.Content.Trim()
                });
            }
        }

        messages.Add(new LlmChatMessage
        {
            Role = "user",
            Content = message.Trim()
        });

        return messages;
    }

    private async Task<string?> BuildKnowledgePromptAsync(
        IReadOnlyCollection<string>? knowledgeBaseIds,
        ConversationAgentDefinition agent,
        string message,
        Func<string, Task> reportStepAsync,
        CancellationToken cancellationToken)
    {
        if (knowledgeBaseIds is null || knowledgeBaseIds.Count == 0)
        {
            await reportStepAsync("Knowledge retrieval disabled");
            return null;
        }

        var sections = new List<string>();
        var totalHits = 0;
        var recallTopK = Math.Clamp(agent.RecallTopK, 1, 12);
        var recallOptions = new RagRecallOptions(
            string.IsNullOrWhiteSpace(agent.RecallRerankModel) ? "none" : agent.RecallRerankModel,
            agent.RecallScoreThresholdEnabled,
            agent.RecallScoreThreshold);

        foreach (var knowledgeBaseId in knowledgeBaseIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .Take(3))
        {
            var knowledgeBase = await _knowledgeStore.GetBaseAsync(knowledgeBaseId, cancellationToken)
                ?? throw new InvalidOperationException($"Knowledge base '{knowledgeBaseId}' was not found.");

            var recall = await _ragService.RecallAsync(knowledgeBaseId, message, recallTopK, recallOptions, cancellationToken);
            totalHits += recall.Hits.Count;
            await reportStepAsync($"Knowledge base '{knowledgeBase.Name}' returned {recall.Hits.Count} chunks");

            if (recall.Hits.Count == 0)
            {
                continue;
            }

            var chunks = recall.Hits.Select((hit, index) =>
                $"{index + 1}. File: {hit.FileName}; Chunk: {hit.ChunkIndex + 1}; Heading: {hit.Heading ?? "N/A"}; Keywords: {hit.KeywordSummary ?? "N/A"}; Content: {hit.Quote}");

            sections.Add($"Knowledge base '{knowledgeBase.Name}' reference content:\n{string.Join("\n", chunks)}");
        }

        if (sections.Count == 0)
        {
            await reportStepAsync(totalHits == 0 ? "No knowledge chunks were recalled" : "Knowledge retrieval completed");
            return null;
        }

        return $"Use the following knowledge base content as high-priority reference. If it is insufficient, say so clearly and do not fabricate.\n\n{string.Join("\n\n", sections)}";
    }

    private static bool HasConfiguredTools(ConversationAgentDefinition agent)
        => (agent.Tools ?? []).Any(tool => !string.IsNullOrWhiteSpace(tool.ToolType));

    private static string FormatExecutionModeLabel(string? mode)
        => string.Equals(mode, "native-tools", StringComparison.OrdinalIgnoreCase)
            ? "Native Tools"
            : string.Equals(mode, "standard-chat", StringComparison.OrdinalIgnoreCase)
                ? "Standard Chat"
                : "ReAct";

    private static string BuildToolCallingInstruction(ConversationAgentDefinition agent, string? knowledgePrompt)
    {
        var sections = new List<string>();
        if (!string.IsNullOrWhiteSpace(agent.Instructions))
        {
            sections.Add(agent.Instructions.Trim());
        }

        if (!string.IsNullOrWhiteSpace(knowledgePrompt))
        {
            sections.Add(knowledgePrompt.Trim());
        }

        return string.Join("\n\n", sections.Where(section => !string.IsNullOrWhiteSpace(section)));
    }

    private static string BuildConversationMessage(
        string message,
        IReadOnlyList<ConversationAgentPreviewMessage>? history)
    {
        if (history is null || history.Count == 0)
        {
            return message.Trim();
        }

        var builder = new StringBuilder();
        builder.AppendLine("Recent conversation history:");
        foreach (var item in history
            .Where(item => !string.IsNullOrWhiteSpace(item.Content))
            .TakeLast(12))
        {
            var role = string.Equals(item.Role, "assistant", StringComparison.OrdinalIgnoreCase) ? "Assistant" : "User";
            builder.AppendLine($"{role}: {item.Content.Trim()}");
        }

        builder.AppendLine();
        builder.Append("Current user message: ");
        builder.Append(message.Trim());
        return builder.ToString();
    }

    private static string? MapAgentEventToStep(string type, object? data)
    {
        return type switch
        {
            "agent.iteration.started" => "Started a new tool decision round",
            "agent.tool.started" => BuildToolStep("Started tool", data),
            "agent.tool.completed" => BuildToolStep("Completed tool", data),
            "agent.tool.failed" => BuildFailedToolStep(data),
            _ => null
        };
    }

    private static string BuildToolStep(string prefix, object? data)
    {
        if (TryGetProperty(data, "DisplayName", out var displayName)
            || TryGetProperty(data, "displayName", out displayName))
        {
            return $"{prefix}: {displayName}";
        }

        if (TryGetProperty(data, "tool", out var tool))
        {
            return $"{prefix}: {tool}";
        }

        return prefix;
    }

    private static string BuildFailedToolStep(object? data)
    {
        if (TryGetProperty(data, "error", out var error))
        {
            return $"Tool failed: {error}";
        }

        return BuildToolStep("Tool failed", data);
    }

    private static bool TryGetProperty(object? source, string propertyName, out string? value)
    {
        value = null;
        if (source is null)
        {
            return false;
        }

        var property = source.GetType().GetProperty(propertyName);
        if (property is null)
        {
            return false;
        }

        value = property.GetValue(source)?.ToString();
        return !string.IsNullOrWhiteSpace(value);
    }

    private static Dictionary<string, JsonElement> SerializeSettings(object value)
    {
        var element = JsonSerializer.SerializeToElement(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var result = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        foreach (var property in element.EnumerateObject())
        {
            result[property.Name] = property.Value.Clone();
        }

        return result;
    }

    private static string ResolveApiKey(LlmProviderConfig providerConfig, LlmProviderPreset preset)
    {
        if (!string.IsNullOrWhiteSpace(providerConfig.ApiKey))
        {
            return providerConfig.ApiKey;
        }

        var environmentVariable = string.IsNullOrWhiteSpace(providerConfig.ApiKeyEnvironmentVariable)
            ? preset.DefaultApiKeyEnvironmentVariable
            : providerConfig.ApiKeyEnvironmentVariable;
        var apiKey = string.IsNullOrWhiteSpace(environmentVariable)
            ? null
            : Environment.GetEnvironmentVariable(environmentVariable);

        return string.IsNullOrWhiteSpace(apiKey)
            ? throw new InvalidOperationException("Selected model is missing an API key.")
            : apiKey;
    }
}
