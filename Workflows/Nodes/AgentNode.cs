using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using EaseGPT.Workflows.Domain;
using EaseGPT.Workflows.Execution;
using EaseGPT.Workflows.Nodes.Llm;

namespace EaseGPT.Workflows.Nodes;

public sealed partial class AgentNode : IWorkflowNode
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ILlmProviderConfigStore _configStore;
    private readonly LlmChatProviderRegistry _providerRegistry;
    private readonly HttpRequestNode _httpRequestNode;
    private readonly WebCrawlerNode _webCrawlerNode;
    private readonly DatabaseNode _databaseNode;
    private readonly CurrentTimeNode _currentTimeNode;

    public AgentNode(
        ILlmProviderConfigStore configStore,
        LlmChatProviderRegistry providerRegistry,
        HttpRequestNode httpRequestNode,
        WebCrawlerNode webCrawlerNode,
        DatabaseNode databaseNode,
        CurrentTimeNode currentTimeNode)
    {
        _configStore = configStore;
        _providerRegistry = providerRegistry;
        _httpRequestNode = httpRequestNode;
        _webCrawlerNode = webCrawlerNode;
        _databaseNode = databaseNode;
        _currentTimeNode = currentTimeNode;
    }

    public string Type => "ai.agent";

    public string DisplayName => "Agent";

    public string Description => "Agent node for multi-step tasks with real tool execution.";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var providerConfig = await ResolveProviderConfigAsync(context);
        var providerName = string.IsNullOrWhiteSpace(providerConfig.Provider) ? "openai" : providerConfig.Provider;
        var preset = _providerRegistry.GetPreset(providerName);
        var provider = _providerRegistry.GetProvider(preset);
        var messageTemplate = context.GetString("message") ?? "{{question}}";
        var message = TemplateRenderer.Render(messageTemplate, context.Input, context.Variables).Trim();
        if (string.IsNullOrWhiteSpace(message))
        {
            throw new InvalidOperationException("Agent input message cannot be empty.");
        }

        var timeoutSeconds = Math.Clamp(context.GetInt32("timeoutSeconds") ?? 180, 1, 600);
        var maxIterations = Math.Clamp(context.GetInt32("maxIterations") ?? 5, 1, 12);
        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
        timeoutSource.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

        var configuredTools = context.GetSetting<List<AgentToolSetting>>("tools") ?? [];
        var enabledTools = BuildEnabledTools(configuredTools);
        var trace = new List<AgentTraceStep>();
        var workingData = new Dictionary<string, object?>(context.Input, StringComparer.OrdinalIgnoreCase);
        var executionMode = "react";
        AgentRunResult? runResult = null;

        if (enabledTools.Count > 0)
        {
            try
            {
                runResult = await ExecuteWithNativeToolCallingAsync(
                    context,
                    provider,
                    providerName,
                    providerConfig,
                    preset,
                    message,
                    enabledTools,
                    trace,
                    workingData,
                    maxIterations,
                    timeoutSource.Token);
                executionMode = "native-tools";
            }
            catch (OperationCanceledException) when (!context.CancellationToken.IsCancellationRequested)
            {
                throw new LlmRequestTimeoutException(timeoutSeconds);
            }
            catch (Exception error) when (IsNativeToolCallingUnsupported(error))
            {
                trace.Add(new AgentTraceStep
                {
                    Iteration = 0,
                    Type = "mode_fallback",
                    Summary = $"Native tool calling is unavailable for the selected model, falling back to ReAct mode. {error.Message}"
                });
            }
        }

        if (runResult is null)
        {
            try
            {
                runResult = await ExecuteWithReactLoopAsync(
                    context,
                    provider,
                    providerName,
                    providerConfig,
                    preset,
                    message,
                    enabledTools,
                    trace,
                    workingData,
                    maxIterations,
                    timeoutSource.Token);
            }
            catch (OperationCanceledException) when (!context.CancellationToken.IsCancellationRequested)
            {
                throw new LlmRequestTimeoutException(timeoutSeconds);
            }
        }

        var finalAnswer = string.IsNullOrWhiteSpace(runResult.FinalAnswer)
            ? "Agent completed tool execution, but the model did not return a final answer."
            : runResult.FinalAnswer;

        var output = new Dictionary<string, object?>(workingData, StringComparer.OrdinalIgnoreCase)
        {
            ["agentReply"] = finalAnswer,
            ["agentProvider"] = providerName,
            ["agentModel"] = providerConfig.Model ?? providerConfig.Name,
            ["agentExecutionMode"] = executionMode,
            ["agentTrace"] = trace
        };

        return NodeExecutionResult.Continue(
            output,
            recordedInput: new Dictionary<string, object?>
            {
                ["message"] = message,
                ["instructions"] = context.GetString("instruction") ?? string.Empty,
                ["tools"] = enabledTools.Select(tool => new
                {
                    tool.Key,
                    tool.DisplayName,
                    tool.Tool.ToolType,
                    tool.ArgumentNames
                }).ToList(),
                ["maxIterations"] = maxIterations,
                ["timeoutSeconds"] = timeoutSeconds
            },
            recordedOutput: new Dictionary<string, object?>
            {
                ["reply"] = finalAnswer,
                ["executionMode"] = executionMode,
                ["trace"] = trace,
                ["toolCalls"] = trace.Count(step => step.Type == "tool_call")
            });
    }

    private async Task<AgentRunResult> ExecuteWithNativeToolCallingAsync(
        NodeExecutionContext context,
        ILlmChatProvider provider,
        string providerName,
        LlmProviderConfig providerConfig,
        LlmProviderPreset preset,
        string message,
        IReadOnlyCollection<AgentResolvedTool> enabledTools,
        IList<AgentTraceStep> trace,
        Dictionary<string, object?> workingData,
        int maxIterations,
        CancellationToken cancellationToken)
    {
        var transcript = CreateTranscript(message);

        for (var iteration = 1; iteration <= maxIterations; iteration += 1)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await context.EmitAsync("agent.iteration.started", new
            {
                iteration,
                maxIterations,
                mode = "native-tools"
            });

            var response = await provider.ChatAsync(
                CreateChatRequest(
                    context,
                    providerName,
                    providerConfig,
                    preset,
                    BuildNativeMessages(context, transcript, enabledTools, iteration, maxIterations),
                    tools: BuildNativeToolDefinitions(enabledTools),
                    toolChoice: "auto"),
                cancellationToken);

            if (response.ToolCalls.Count == 0)
            {
                var finalAnswer = response.Text.Trim();
                trace.Add(new AgentTraceStep
                {
                    Iteration = iteration,
                    Type = "final",
                    Summary = "Model returned the final answer in native tool mode.",
                    Payload = finalAnswer
                });

                return new AgentRunResult(finalAnswer);
            }

            transcript.Add(new LlmChatMessage
            {
                Role = "assistant",
                Content = string.Empty,
                ToolCalls = response.ToolCalls
            });

            foreach (var toolCall in response.ToolCalls)
            {
                var selectedTool = enabledTools.FirstOrDefault(tool =>
                    string.Equals(tool.Key, toolCall.Function.Name, StringComparison.OrdinalIgnoreCase));
                var toolArguments = ParseToolArguments(toolCall.Function.Arguments);

                if (selectedTool is null)
                {
                    var errorMessage = $"Tool '{toolCall.Function.Name}' is not declared. Choose one of the configured tools.";
                    transcript.Add(new LlmChatMessage
                    {
                        Role = "tool",
                        ToolCallId = toolCall.Id,
                        Name = toolCall.Function.Name,
                        Content = errorMessage
                    });
                    trace.Add(new AgentTraceStep
                    {
                        Iteration = iteration,
                        Type = "tool_error",
                        Tool = toolCall.Function.Name,
                        Summary = errorMessage
                    });
                    continue;
                }

                await context.EmitAsync("agent.tool.started", new
                {
                    iteration,
                    tool = selectedTool.Key,
                    selectedTool.DisplayName,
                    arguments = toolArguments,
                    mode = "native-tools"
                });

                try
                {
                    var toolResult = await ExecuteToolAsync(context, selectedTool, workingData, toolArguments, cancellationToken);
                    MergeOutput(workingData, toolResult.Data);

                    var resultSummary = BuildToolResultSummary(toolResult.RecordedOutput ?? toolResult.Data);
                    transcript.Add(new LlmChatMessage
                    {
                        Role = "tool",
                        ToolCallId = toolCall.Id,
                        Name = selectedTool.Key,
                        Content = resultSummary
                    });
                    trace.Add(new AgentTraceStep
                    {
                        Iteration = iteration,
                        Type = "tool_call",
                        Tool = selectedTool.Key,
                        Summary = $"Called tool in native mode: {selectedTool.DisplayName}",
                        Arguments = toolArguments,
                        Result = resultSummary
                    });

                    await context.EmitAsync("agent.tool.completed", new
                    {
                        iteration,
                        tool = selectedTool.Key,
                        selectedTool.DisplayName,
                        result = toolResult.RecordedOutput ?? toolResult.Data,
                        mode = "native-tools"
                    });
                }
                catch (Exception error)
                {
                    var errorMessage = $"Tool {selectedTool.DisplayName} failed: {error.Message}";
                    transcript.Add(new LlmChatMessage
                    {
                        Role = "tool",
                        ToolCallId = toolCall.Id,
                        Name = selectedTool.Key,
                        Content = errorMessage
                    });
                    trace.Add(new AgentTraceStep
                    {
                        Iteration = iteration,
                        Type = "tool_error",
                        Tool = selectedTool.Key,
                        Summary = errorMessage,
                        Arguments = toolArguments
                    });

                    await context.EmitAsync("agent.tool.failed", new
                    {
                        iteration,
                        tool = selectedTool.Key,
                        selectedTool.DisplayName,
                        error = error.Message,
                        mode = "native-tools"
                    });
                }
            }
        }

        return new AgentRunResult("Agent reached the maximum tool rounds without a final answer.");
    }

    private async Task<AgentRunResult> ExecuteWithReactLoopAsync(
        NodeExecutionContext context,
        ILlmChatProvider provider,
        string providerName,
        LlmProviderConfig providerConfig,
        LlmProviderPreset preset,
        string message,
        IReadOnlyCollection<AgentResolvedTool> enabledTools,
        IList<AgentTraceStep> trace,
        Dictionary<string, object?> workingData,
        int maxIterations,
        CancellationToken cancellationToken)
    {
        var transcript = CreateTranscript(message);

        AgentDecision? lastDecision = null;
        string? finalAnswer = null;

        for (var iteration = 1; iteration <= maxIterations; iteration += 1)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await context.EmitAsync("agent.iteration.started", new
            {
                iteration,
                maxIterations,
                mode = "react"
            });

            var request = CreateChatRequest(
                context,
                providerName,
                providerConfig,
                preset,
                BuildMessages(context, transcript, enabledTools, iteration, maxIterations));

            var response = await provider.ChatAsync(request, cancellationToken);
            lastDecision = TryParseDecision(response.Text);
            if (lastDecision is null)
            {
                finalAnswer = response.Text.Trim();
                trace.Add(new AgentTraceStep
                {
                    Iteration = iteration,
                    Type = "final",
                    Summary = "Model did not return structured JSON in ReAct mode, treated as the final answer.",
                    Payload = finalAnswer
                });
                break;
            }

            transcript.Add(new LlmChatMessage
            {
                Role = "assistant",
                Content = response.Text
            });

            if (string.Equals(lastDecision.Type, "final", StringComparison.OrdinalIgnoreCase))
            {
                finalAnswer = string.IsNullOrWhiteSpace(lastDecision.Answer)
                    ? response.Text.Trim()
                    : lastDecision.Answer.Trim();
                trace.Add(new AgentTraceStep
                {
                    Iteration = iteration,
                    Type = "final",
                    Summary = "Model returned the final answer in ReAct mode.",
                    Payload = finalAnswer
                });
                break;
            }

            if (!string.Equals(lastDecision.Type, "tool_call", StringComparison.OrdinalIgnoreCase))
            {
                finalAnswer = response.Text.Trim();
                trace.Add(new AgentTraceStep
                {
                    Iteration = iteration,
                    Type = "final",
                    Summary = "Model returned an unknown decision type, treated as the final answer.",
                    Payload = finalAnswer
                });
                break;
            }

            var selectedTool = enabledTools.FirstOrDefault(tool =>
                string.Equals(tool.Key, lastDecision.Tool, StringComparison.OrdinalIgnoreCase));
            if (selectedTool is null)
            {
                var missingToolName = string.IsNullOrWhiteSpace(lastDecision.Tool) ? "unknown" : lastDecision.Tool;
                var toolNotFoundMessage = $"Tool '{missingToolName}' is not declared. Choose one of the configured tools.";
                transcript.Add(new LlmChatMessage
                {
                    Role = "system",
                    Content = $"Observation: {toolNotFoundMessage}"
                });
                trace.Add(new AgentTraceStep
                {
                    Iteration = iteration,
                    Type = "tool_error",
                    Tool = lastDecision.Tool,
                    Summary = toolNotFoundMessage
                });
                continue;
            }

            var toolArguments = lastDecision.Arguments ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            await context.EmitAsync("agent.tool.started", new
            {
                iteration,
                tool = selectedTool.Key,
                selectedTool.DisplayName,
                arguments = toolArguments,
                mode = "react"
            });

            try
            {
                var toolResult = await ExecuteToolAsync(context, selectedTool, workingData, toolArguments, cancellationToken);
                MergeOutput(workingData, toolResult.Data);

                var resultSummary = BuildToolResultSummary(toolResult.RecordedOutput ?? toolResult.Data);
                transcript.Add(new LlmChatMessage
                {
                    Role = "system",
                    Content = $"Observation from tool {selectedTool.DisplayName}:\n{resultSummary}"
                });
                trace.Add(new AgentTraceStep
                {
                    Iteration = iteration,
                    Type = "tool_call",
                    Tool = selectedTool.Key,
                    Summary = $"Called tool in ReAct mode: {selectedTool.DisplayName}",
                    Arguments = toolArguments,
                    Result = resultSummary
                });

                await context.EmitAsync("agent.tool.completed", new
                {
                    iteration,
                    tool = selectedTool.Key,
                    selectedTool.DisplayName,
                    result = toolResult.RecordedOutput ?? toolResult.Data,
                    mode = "react"
                });
            }
            catch (Exception error)
            {
                var errorMessage = $"Tool {selectedTool.DisplayName} failed: {error.Message}";
                transcript.Add(new LlmChatMessage
                {
                    Role = "system",
                    Content = $"Observation: {errorMessage}"
                });
                trace.Add(new AgentTraceStep
                {
                    Iteration = iteration,
                    Type = "tool_error",
                    Tool = selectedTool.Key,
                    Summary = errorMessage,
                    Arguments = toolArguments
                });

                await context.EmitAsync("agent.tool.failed", new
                {
                    iteration,
                    tool = selectedTool.Key,
                    selectedTool.DisplayName,
                    error = error.Message,
                    mode = "react"
                });
            }
        }

        finalAnswer ??= lastDecision?.Answer?.Trim();
        return new AgentRunResult(finalAnswer ?? "Agent completed tool execution, but the model did not return a final answer.");
    }

    private async Task<NodeExecutionResult> ExecuteToolAsync(
        NodeExecutionContext agentContext,
        AgentResolvedTool tool,
        IReadOnlyDictionary<string, object?> currentInput,
        IReadOnlyDictionary<string, string> arguments,
        CancellationToken cancellationToken)
    {
        var variables = new Dictionary<string, object?>(agentContext.Variables, StringComparer.OrdinalIgnoreCase);
        foreach (var argument in arguments)
        {
            variables[argument.Key] = argument.Value;
            variables[$"arg.{argument.Key}"] = argument.Value;
        }

        var workflow = new WorkflowDefinition
        {
            Id = agentContext.Workflow.Id,
            Name = agentContext.Workflow.Name,
            Nodes = [],
            Edges = []
        };

        var nodeDefinition = new WorkflowNodeDefinition
        {
            Id = $"{agentContext.Node.Id}:{tool.Key}",
            Type = ResolveWorkflowNodeType(tool.Tool.ToolType),
            Name = tool.DisplayName,
            Settings = SerializeSettings(BuildToolSettings(tool.Tool))
        };

        var toolContext = new NodeExecutionContext(
            workflow,
            nodeDefinition,
            currentInput,
            variables,
            cancellationToken,
            agentContext.ExecutionId);

        return tool.Tool.ToolType.ToLowerInvariant() switch
        {
            "http" => await _httpRequestNode.ExecuteAsync(toolContext),
            "web-crawler" => await _webCrawlerNode.ExecuteAsync(toolContext),
            "database" => await _databaseNode.ExecuteAsync(toolContext),
            "current-time" => await _currentTimeNode.ExecuteAsync(toolContext),
            _ => throw new InvalidOperationException($"Unsupported Agent tool type: {tool.Tool.ToolType}")
        };
    }

    private static List<LlmChatMessage> CreateTranscript(string message)
        => [
            new()
            {
                Role = "user",
                Content = message
            }
        ];

    private static LlmChatRequest CreateChatRequest(
        NodeExecutionContext context,
        string providerName,
        LlmProviderConfig providerConfig,
        LlmProviderPreset preset,
        IReadOnlyCollection<LlmChatMessage> messages,
        IReadOnlyCollection<LlmToolDefinition>? tools = null,
        string? toolChoice = null)
        => new()
        {
            Provider = providerName,
            Model = providerConfig.Model ?? providerConfig.Name,
            Endpoint = providerConfig.Endpoint ?? preset.DefaultEndpoint,
            ApiKey = ResolveApiKey(providerConfig, preset),
            Temperature = ResolveTemperature(context, providerConfig),
            Stream = false,
            Messages = messages,
            Tools = tools ?? [],
            ToolChoice = toolChoice
        };

    private static object BuildToolSettings(AgentToolSetting tool)
        => tool.ToolType.ToLowerInvariant() switch
        {
            "http" => new
            {
                method = tool.Http?.Method ?? "GET",
                url = tool.Http?.Url ?? string.Empty,
                body = tool.Http?.Body ?? string.Empty,
                queryParameters = ParseJsonList<HttpQueryParameterDefinition>(tool.Http?.QueryParametersJson),
                headers = ParseJsonList<HttpHeaderDefinition>(tool.Http?.HeadersJson),
                timeoutSeconds = tool.Http?.TimeoutSeconds ?? 30,
                retryCount = tool.Http?.RetryCount ?? 0
            },
            "web-crawler" => new
            {
                url = tool.WebCrawler?.Url ?? string.Empty,
                userAgent = tool.WebCrawler?.UserAgent ?? string.Empty,
                generateSummary = tool.WebCrawler?.GenerateSummary ?? true,
                timeoutSeconds = tool.WebCrawler?.TimeoutSeconds ?? 30,
                retryCount = tool.WebCrawler?.RetryCount ?? 0,
                maxContentLength = tool.WebCrawler?.MaxContentLength ?? 100000
            },
            "database" => new
            {
                provider = tool.Database?.Provider ?? "sqlserver",
                host = tool.Database?.Host ?? string.Empty,
                port = tool.Database?.Port ?? 1433,
                database = tool.Database?.Database ?? string.Empty,
                username = tool.Database?.Username ?? string.Empty,
                password = tool.Database?.Password ?? string.Empty,
                useSsl = tool.Database?.UseSsl ?? false,
                mode = tool.Database?.Mode ?? "query",
                sql = tool.Database?.Sql ?? string.Empty,
                parameters = ParseJsonList<DatabaseParameterDefinition>(tool.Database?.ParametersJson),
                timeoutSeconds = tool.Database?.TimeoutSeconds ?? 30
            },
            "current-time" => new
            {
                mode = tool.CurrentTime?.Mode ?? "local",
                timeZone = tool.CurrentTime?.TimeZone ?? string.Empty,
                format = tool.CurrentTime?.Format ?? "yyyy-MM-dd HH:mm:ss zzz"
            },
            _ => throw new InvalidOperationException($"Unsupported Agent tool type: {tool.ToolType}")
        };

    private static Dictionary<string, JsonElement> SerializeSettings(object value)
    {
        var element = JsonSerializer.SerializeToElement(value, JsonOptions);
        var result = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
        foreach (var property in element.EnumerateObject())
        {
            result[property.Name] = property.Value.Clone();
        }
        return result;
    }

    private static List<T> ParseJsonList<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<T>>(json, JsonOptions) ?? [];
        }
        catch (JsonException error)
        {
            throw new InvalidOperationException($"JSON array format in tool configuration is invalid: {error.Message}");
        }
    }

    private async Task<LlmProviderConfig> ResolveProviderConfigAsync(NodeExecutionContext context)
    {
        var configId = context.GetString("providerConfigId");
        if (string.IsNullOrWhiteSpace(configId))
        {
            throw new InvalidOperationException("Agent node requires a model configuration.");
        }

        var config = await _configStore.GetAsync(configId, context.CancellationToken)
            ?? throw new InvalidOperationException($"LLM provider config '{configId}' was not found.");

        if (!config.Enabled)
        {
            throw new InvalidOperationException($"LLM provider config '{configId}' is disabled.");
        }

        if (!string.Equals(config.ModelType, "llm", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"LLM provider config '{configId}' is not an LLM model.");
        }

        return config;
    }

    private static List<LlmChatMessage> BuildMessages(
        NodeExecutionContext context,
        IReadOnlyCollection<LlmChatMessage> transcript,
        IReadOnlyCollection<AgentResolvedTool> tools,
        int iteration,
        int maxIterations)
    {
        var messages = new List<LlmChatMessage>();
        var instruction = context.GetString("instruction");
        if (!string.IsNullOrWhiteSpace(instruction))
        {
            messages.Add(new LlmChatMessage
            {
                Role = "system",
                Content = TemplateRenderer.Render(instruction, context.Input, context.Variables)
            });
        }

        messages.Add(new LlmChatMessage
        {
            Role = "system",
            Content = BuildOrchestrationInstruction(tools, iteration, maxIterations)
        });

        messages.AddRange(transcript);
        return messages;
    }

    private static List<LlmChatMessage> BuildNativeMessages(
        NodeExecutionContext context,
        IReadOnlyCollection<LlmChatMessage> transcript,
        IReadOnlyCollection<AgentResolvedTool> tools,
        int iteration,
        int maxIterations)
    {
        var messages = new List<LlmChatMessage>();
        var instruction = context.GetString("instruction");
        if (!string.IsNullOrWhiteSpace(instruction))
        {
            messages.Add(new LlmChatMessage
            {
                Role = "system",
                Content = TemplateRenderer.Render(instruction, context.Input, context.Variables)
            });
        }

        messages.Add(new LlmChatMessage
        {
            Role = "system",
            Content = BuildNativeInstruction(tools, iteration, maxIterations)
        });

        messages.AddRange(transcript);
        return messages;
    }

    private static string BuildNativeInstruction(
        IReadOnlyCollection<AgentResolvedTool> tools,
        int iteration,
        int maxIterations)
    {
        var builder = new StringBuilder();
        builder.AppendLine("You are an Agent that can call real tools using native function calling.");
        builder.AppendLine($"Current tool round: {iteration}/{maxIterations}.");
        builder.AppendLine("Use a tool only when it helps answer the user correctly.");
        builder.AppendLine("Do not invent tool results.");
        builder.AppendLine("After you have enough information, answer directly in natural language.");
        builder.AppendLine("Respect each tool's purpose, scope, and guardrails.");
        builder.AppendLine();
        builder.AppendLine("Available tools:");

        foreach (var tool in tools)
        {
            builder.AppendLine($"- {tool.Key}: {BuildToolDescription(tool)}");
        }

        return builder.ToString().Trim();
    }

    private static string BuildOrchestrationInstruction(
        IReadOnlyCollection<AgentResolvedTool> tools,
        int iteration,
        int maxIterations)
    {
        var builder = new StringBuilder();
        builder.AppendLine("You are an Agent that can call real tools.");
        builder.AppendLine("This model is running in ReAct fallback mode.");
        builder.AppendLine($"Current decision round: {iteration}/{maxIterations}.");
        builder.AppendLine("Internally follow a Thought -> Action -> Observation loop, but never reveal the hidden thought.");
        builder.AppendLine("You must output exactly one JSON object and nothing else.");
        builder.AppendLine("Allowed JSON formats:");
        builder.AppendLine("{\"type\":\"final\",\"answer\":\"final answer\"}");
        builder.AppendLine("{\"type\":\"tool_call\",\"tool\":\"tool_key\",\"arguments\":{\"arg_name\":\"arg_value\"}}");
        builder.AppendLine("When you need a tool, choose only from the declared tools below.");
        builder.AppendLine("If the question can already be answered, return final.");
        builder.AppendLine("Do not fabricate tool results.");
        builder.AppendLine();
        builder.AppendLine("Available tools:");

        foreach (var tool in tools)
        {
            builder.AppendLine($"- Key: {tool.Key}");
            builder.AppendLine($"  Name: {tool.DisplayName}");
            builder.AppendLine($"  Type: {tool.Tool.ToolType}");
            if (!string.IsNullOrWhiteSpace(tool.Tool.Purpose))
            {
                builder.AppendLine($"  Purpose: {tool.Tool.Purpose.Trim()}");
            }

            if (!string.IsNullOrWhiteSpace(tool.Tool.Resource))
            {
                builder.AppendLine($"  Resource: {tool.Tool.Resource.Trim()}");
            }

            if (!string.IsNullOrWhiteSpace(tool.Tool.Guardrails))
            {
                builder.AppendLine($"  Guardrails: {tool.Tool.Guardrails.Trim()}");
            }

            builder.AppendLine($"  Arguments: {(tool.ArgumentNames.Count == 0 ? "none" : string.Join(", ", tool.ArgumentNames))}");
        }

        return builder.ToString().Trim();
    }

    private static IReadOnlyCollection<LlmToolDefinition> BuildNativeToolDefinitions(IReadOnlyCollection<AgentResolvedTool> tools)
        => tools.Select(tool => new LlmToolDefinition
        {
            Function = new LlmToolFunctionDefinition
            {
                Name = tool.Key,
                Description = BuildToolDescription(tool),
                Parameters = BuildToolParameters(tool)
            }
        }).ToArray();

    private static IReadOnlyDictionary<string, object?> BuildToolParameters(AgentResolvedTool tool)
    {
        var properties = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var argumentName in tool.ArgumentNames)
        {
            properties[argumentName] = new Dictionary<string, object?>
            {
                ["type"] = "string",
                ["description"] = $"Value for argument '{argumentName}'."
            };
        }

        return new Dictionary<string, object?>
        {
            ["type"] = "object",
            ["properties"] = properties,
            ["required"] = Array.Empty<string>(),
            ["additionalProperties"] = true
        };
    }

    private static string BuildToolDescription(AgentResolvedTool tool)
    {
        var segments = new List<string>
        {
            $"Name: {tool.DisplayName}",
            $"Type: {tool.Tool.ToolType}"
        };

        if (!string.IsNullOrWhiteSpace(tool.Tool.Purpose))
        {
            segments.Add($"Purpose: {tool.Tool.Purpose.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(tool.Tool.Resource))
        {
            segments.Add($"Resource scope: {tool.Tool.Resource.Trim()}");
        }

        if (!string.IsNullOrWhiteSpace(tool.Tool.Guardrails))
        {
            segments.Add($"Guardrails: {tool.Tool.Guardrails.Trim()}");
        }

        if (tool.ArgumentNames.Count > 0)
        {
            segments.Add($"Arguments: {string.Join(", ", tool.ArgumentNames)}");
        }
        else
        {
            segments.Add("Arguments: none");
        }

        return string.Join(" | ", segments);
    }

    private static List<AgentResolvedTool> BuildEnabledTools(IReadOnlyCollection<AgentToolSetting> tools)
    {
        var enabled = tools
            .Where(tool => !string.IsNullOrWhiteSpace(tool.ToolType))
            .ToList();
        var result = new List<AgentResolvedTool>();
        for (var index = 0; index < enabled.Count; index += 1)
        {
            var tool = enabled[index];
            var key = $"tool_{index + 1}";
            var displayName = string.IsNullOrWhiteSpace(tool.Name)
                ? ResolveToolLabel(tool.ToolType)
                : tool.Name.Trim();
            result.Add(new AgentResolvedTool(
                key,
                displayName,
                tool,
                DetectArgumentNames(tool)));
        }
        return result;
    }

    private static List<string> DetectArgumentNames(AgentToolSetting tool)
    {
        var values = new List<string?>
        {
            tool.Resource,
            tool.CurrentTime?.TimeZone,
            tool.CurrentTime?.Format,
            tool.Http?.Url,
            tool.Http?.Body,
            tool.Http?.HeadersJson,
            tool.Http?.QueryParametersJson,
            tool.WebCrawler?.Url,
            tool.WebCrawler?.UserAgent,
            tool.Database?.Host,
            tool.Database?.Database,
            tool.Database?.Username,
            tool.Database?.Password,
            tool.Database?.Sql,
            tool.Database?.ParametersJson
        };

        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var value in values.Where(value => !string.IsNullOrWhiteSpace(value)))
        {
            foreach (Match match in TokenRegex().Matches(value!))
            {
                var token = match.Groups["key"].Value.Trim();
                if (token.StartsWith("var.", StringComparison.OrdinalIgnoreCase))
                {
                    token = token["var.".Length..];
                }
                if (token.StartsWith("input.", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                if (token.Length > 0)
                {
                    names.Add(token);
                }
            }
        }

        return names.OrderBy(name => name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static AgentDecision? TryParseDecision(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var json = ExtractJson(text);
        if (json is null)
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<AgentDecision>(json, JsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static Dictionary<string, string> ParseToolArguments(string? argumentsJson)
    {
        if (string.IsNullOrWhiteSpace(argumentsJson))
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        try
        {
            using var document = JsonDocument.Parse(argumentsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var property in document.RootElement.EnumerateObject())
            {
                result[property.Name] = property.Value.ValueKind == JsonValueKind.String
                    ? property.Value.GetString() ?? string.Empty
                    : property.Value.ToString();
            }

            return result;
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }
    }

    private static string? ExtractJson(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.StartsWith("{") && trimmed.EndsWith("}"))
        {
            return trimmed;
        }

        var codeBlockMatch = JsonCodeBlockRegex().Match(trimmed);
        if (codeBlockMatch.Success)
        {
            return codeBlockMatch.Groups["json"].Value.Trim();
        }

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        return start >= 0 && end > start
            ? trimmed[start..(end + 1)]
            : null;
    }

    private static string BuildToolResultSummary(IReadOnlyDictionary<string, object?> result)
    {
        var json = JsonSerializer.Serialize(result, JsonOptions);
        return json.Length <= 6000 ? json : $"{json[..6000]}...(truncated)";
    }

    private static void MergeOutput(IDictionary<string, object?> target, IReadOnlyDictionary<string, object?> source)
    {
        foreach (var item in source)
        {
            target[item.Key] = item.Value;
        }
    }

    private static string ResolveWorkflowNodeType(string toolType)
        => toolType.ToLowerInvariant() switch
        {
            "http" => "integration.http-request",
            "web-crawler" => "integration.web-crawler",
            "database" => "integration.database",
            "current-time" => "utility.current-time",
            _ => throw new InvalidOperationException($"Unsupported Agent tool type: {toolType}")
        };

    private static string ResolveToolLabel(string toolType)
        => toolType.ToLowerInvariant() switch
        {
            "http" => "HTTP API",
            "database" => "Database",
            "web-crawler" => "Web Crawler",
            "current-time" => "Time",
            _ => "External Tool"
        };

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

    private static double ResolveTemperature(NodeExecutionContext context, LlmProviderConfig providerConfig)
    {
        var value = context.GetSetting("temperature");
        if (value is null)
        {
            return providerConfig.Temperature ?? 0.7;
        }

        if (value.Value.ValueKind == JsonValueKind.Number && value.Value.TryGetDouble(out var temperature))
        {
            return temperature;
        }

        return context.GetInt32("temperature") is { } intValue ? intValue / 100.0 : 0.7;
    }

    private static bool IsNativeToolCallingUnsupported(Exception error)
    {
        var message = error.Message;
        if (string.IsNullOrWhiteSpace(message))
        {
            return false;
        }

        return message.Contains("tool", StringComparison.OrdinalIgnoreCase)
               && (message.Contains("unsupported", StringComparison.OrdinalIgnoreCase)
                   || message.Contains("not support", StringComparison.OrdinalIgnoreCase)
                   || message.Contains("unknown", StringComparison.OrdinalIgnoreCase)
                   || message.Contains("invalid", StringComparison.OrdinalIgnoreCase)
                   || message.Contains("unrecognized", StringComparison.OrdinalIgnoreCase))
            || message.Contains("function calling", StringComparison.OrdinalIgnoreCase)
            || message.Contains("tool_choice", StringComparison.OrdinalIgnoreCase)
            || message.Contains("tools", StringComparison.OrdinalIgnoreCase) && message.Contains("extra inputs", StringComparison.OrdinalIgnoreCase);
    }

    [GeneratedRegex("\\{\\{(?<key>[^}]+)\\}\\}")]
    private static partial Regex TokenRegex();

    [GeneratedRegex("```(?:json)?\\s*(?<json>\\{[\\s\\S]*\\})\\s*```", RegexOptions.IgnoreCase)]
    private static partial Regex JsonCodeBlockRegex();
}

public sealed class AgentToolSetting
{
    public string ToolType { get; set; } = "";

    public bool Enabled { get; set; }

    public string? Name { get; set; }

    public string? Purpose { get; set; }

    public string? Resource { get; set; }

    public string? Guardrails { get; set; }

    public AgentCurrentTimeToolConfig? CurrentTime { get; set; }

    public AgentHttpToolConfig? Http { get; set; }

    public AgentWebCrawlerToolConfig? WebCrawler { get; set; }

    public AgentDatabaseToolConfig? Database { get; set; }
}

public sealed class AgentCurrentTimeToolConfig
{
    public string Mode { get; set; } = "local";

    public string TimeZone { get; set; } = "";

    public string Format { get; set; } = "yyyy-MM-dd HH:mm:ss zzz";
}

public sealed class AgentHttpToolConfig
{
    public string Method { get; set; } = "GET";

    public string Url { get; set; } = "";

    public string Body { get; set; } = "";

    public string QueryParametersJson { get; set; } = "[]";

    public string HeadersJson { get; set; } = "[]";

    public int TimeoutSeconds { get; set; } = 30;

    public int RetryCount { get; set; }
}

public sealed class AgentWebCrawlerToolConfig
{
    public string Url { get; set; } = "";

    public string UserAgent { get; set; } = "";

    public bool GenerateSummary { get; set; } = true;

    public int TimeoutSeconds { get; set; } = 30;

    public int RetryCount { get; set; }

    public int MaxContentLength { get; set; } = 100000;
}

public sealed class AgentDatabaseToolConfig
{
    public string Provider { get; set; } = "sqlserver";

    public string Host { get; set; } = "";

    public int Port { get; set; } = 1433;

    public string Database { get; set; } = "";

    public string Username { get; set; } = "";

    public string Password { get; set; } = "";

    public bool UseSsl { get; set; }

    public string Mode { get; set; } = "query";

    public string Sql { get; set; } = "";

    public string ParametersJson { get; set; } = "[]";

    public int TimeoutSeconds { get; set; } = 30;
}

public sealed class AgentDecision
{
    public string Type { get; set; } = "final";

    public string? Tool { get; set; }

    public string? Answer { get; set; }

    public Dictionary<string, string>? Arguments { get; set; }
}

public sealed class AgentTraceStep
{
    public int Iteration { get; set; }

    public string Type { get; set; } = "";

    public string? Tool { get; set; }

    public string Summary { get; set; } = "";

    public object? Payload { get; set; }

    public IReadOnlyDictionary<string, string>? Arguments { get; set; }

    public object? Result { get; set; }
}

public sealed record AgentResolvedTool(
    string Key,
    string DisplayName,
    AgentToolSetting Tool,
    IReadOnlyList<string> ArgumentNames);

public sealed record AgentRunResult(string FinalAnswer);
