using System.Diagnostics;
using EaseGPT.Knowledge;
using EaseGPT.Workflows.Nodes.Llm;

namespace EaseGPT.ConversationAgents;

public sealed class ConversationAgentPreviewService
{
    private readonly ILlmProviderConfigStore _configStore;
    private readonly RagService _ragService;
    private readonly IKnowledgeStore _knowledgeStore;
    private readonly IConversationAgentExecutionLog _executionLog;
    private readonly LlmChatProviderRegistry _providerRegistry;

    public ConversationAgentPreviewService(
        ILlmProviderConfigStore configStore,
        RagService ragService,
        IKnowledgeStore knowledgeStore,
        IConversationAgentExecutionLog executionLog,
        LlmChatProviderRegistry providerRegistry)
    {
        _configStore = configStore;
        _ragService = ragService;
        _knowledgeStore = knowledgeStore;
        _executionLog = executionLog;
        _providerRegistry = providerRegistry;
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
                    null));
            }
        }

        try
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                throw new ArgumentException("消息不能为空。", nameof(message));
            }

            if (string.IsNullOrWhiteSpace(agent.ProviderConfigId))
            {
                throw new InvalidOperationException("请先选择模型。");
            }

            var providerConfig = await _configStore.GetAsync(agent.ProviderConfigId, cancellationToken)
                ?? throw new InvalidOperationException("所选模型配置不存在。");

            if (!providerConfig.Enabled)
            {
                throw new InvalidOperationException("所选模型配置已禁用。");
            }

            if (!string.Equals(providerConfig.ModelType, "llm", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("所选模型不是可用的 LLM 配置。");
            }

            var providerName = string.IsNullOrWhiteSpace(providerConfig.Provider) ? "openai" : providerConfig.Provider;
            await ReportStepAsync($"已加载模型配置：{providerConfig.Model ?? providerConfig.Name}");

            var preset = _providerRegistry.GetPreset(providerName);
            var provider = _providerRegistry.GetProvider(preset);
            var messages = await BuildMessagesAsync(agent, message, history, ReportStepAsync, cancellationToken);

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

            await ReportStepAsync("开始调用模型生成回复");
            var response = await provider.ChatAsync(request, cancellationToken);
            await ReportStepAsync("模型回复完成");
            stopwatch.Stop();

            execution.Status = "Completed";
            execution.Reply = response.Text;
            execution.ElapsedMilliseconds = stopwatch.ElapsedMilliseconds;
            execution.FinishedAt = DateTimeOffset.UtcNow;
            execution.StepDetails = steps.ToList();
            await _executionLog.AddAsync(execution, cancellationToken);

            var result = new ConversationAgentPreviewResponse(
                response.Text,
                stopwatch.ElapsedMilliseconds,
                steps.Select(step => step.Message).ToArray(),
                steps.ToArray());

            if (onEvent is not null)
            {
                await onEvent(new ConversationAgentPreviewStreamEvent(
                    "preview.completed",
                    result.ElapsedMilliseconds,
                    result.StepDetails,
                    result.Reply,
                    null));
            }

            return result;
        }
        catch (OperationCanceledException)
        {
            stopwatch.Stop();
            execution.Status = "Cancelled";
            execution.Error = "已终止执行";
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
            await reportStepAsync("已应用系统提示词");
        }
        else
        {
            await reportStepAsync("未设置系统提示词，按默认方式执行");
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
            await reportStepAsync("未启用知识库检索");
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
                ?? throw new InvalidOperationException($"知识库“{knowledgeBaseId}”不存在。");

            var recall = await _ragService.RecallAsync(knowledgeBaseId, message, recallTopK, recallOptions, cancellationToken);
            totalHits += recall.Hits.Count;
            await reportStepAsync($"检索知识库《{knowledgeBase.Name}》完成，召回内容 {recall.Hits.Count} 段");

            if (recall.Hits.Count == 0)
            {
                continue;
            }

            var chunks = recall.Hits.Select((hit, index) =>
                $"{index + 1}. 文件：{hit.FileName}；分段：{hit.ChunkIndex + 1}；标题：{hit.Heading ?? "无"}；关键词：{hit.KeywordSummary ?? "无"}；内容：{hit.Quote}");

            sections.Add($"知识库《{knowledgeBase.Name}》参考内容：\n{string.Join("\n", chunks)}");
        }

        if (sections.Count == 0)
        {
            await reportStepAsync(totalHits == 0 ? "知识库检索未命中可用内容" : "知识库检索完成");
            return null;
        }

        return $"回答时请优先参考以下知识库内容；如果参考内容不足，请明确说明，不要编造。\n\n{string.Join("\n\n", sections)}";
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
            ? throw new InvalidOperationException("所选模型缺少 API Key。")
            : apiKey;
    }
}
