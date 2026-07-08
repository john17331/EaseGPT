using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace EaseGPT.Workflows.Nodes.Llm;

/// <summary>
/// OpenAI-compatible chat provider. Qwen compatible mode, Doubao Ark, OpenAI, and many private gateways can use this adapter.
/// </summary>
public sealed partial class OpenAiCompatibleLlmProvider : ILlmChatProvider
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OpenAiCompatibleLlmProvider> _logger;

    public OpenAiCompatibleLlmProvider(
        IHttpClientFactory clients,
        ILogger<OpenAiCompatibleLlmProvider> logger)
    {
        _httpClient = clients.CreateClient(WorkflowHttpClients.Llm);
        _logger = logger;
    }

    public string Name => "openai-compatible";

    public async Task<LlmChatResponse> ChatAsync(LlmChatRequest request, CancellationToken cancellationToken)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, request.Endpoint);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ApiKey);
        httpRequest.Content = JsonContent.Create(BuildRequestPayload(request, stream: false));

        _logger.LogInformation("Calling LLM provider {Provider}, model {Model}", request.Provider, request.Model);
        using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);
        var rawResponse = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"LLM request failed with status {(int)response.StatusCode}: {rawResponse}");
        }

        return new LlmChatResponse
        {
            Text = ExtractAssistantText(rawResponse),
            ReasoningContent = ExtractReasoningContent(rawResponse),
            ToolCalls = ExtractToolCalls(rawResponse),
            RawResponse = rawResponse,
            Provider = request.Provider,
            Model = request.Model
        };
    }

    public async Task<LlmChatResponse> ChatStreamAsync(
        LlmChatRequest request,
        Func<LlmChatStreamDelta, ValueTask> onDeltaAsync,
        CancellationToken cancellationToken)
    {
        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, request.Endpoint);
        httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ApiKey);
        httpRequest.Content = JsonContent.Create(BuildRequestPayload(request, stream: true));

        _logger.LogInformation("Streaming LLM provider {Provider}, model {Model}", request.Provider, request.Model);
        using var response = await _httpClient.SendAsync(
            httpRequest,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);
        var text = new StringBuilder();
        var reasoning = new StringBuilder();
        var raw = new StringBuilder();
        var nonSseRaw = new StringBuilder();

        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            if (!line.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                nonSseRaw.AppendLine(line);
                continue;
            }

            var data = line["data:".Length..].Trim();
            if (data == "[DONE]")
            {
                break;
            }

            raw.AppendLine(data);
            var delta = ExtractStreamDelta(data);
            if (delta.Text is not null)
            {
                text.Append(delta.Text);
            }

            if (delta.ReasoningContent is not null)
            {
                reasoning.Append(delta.ReasoningContent);
            }

            if (!string.IsNullOrEmpty(delta.Text) || !string.IsNullOrEmpty(delta.ReasoningContent))
            {
                await onDeltaAsync(delta);
            }
        }

        if (text.Length == 0 && nonSseRaw.Length > 0 && TryExtractFullResponse(nonSseRaw.ToString()) is { } fallback)
        {
            if (!string.IsNullOrWhiteSpace(fallback.Text))
            {
                await onDeltaAsync(new LlmChatStreamDelta { Text = fallback.Text });
            }

            return new LlmChatResponse
            {
                Text = fallback.Text,
                ReasoningContent = fallback.ReasoningContent,
                ToolCalls = fallback.ToolCalls,
                RawResponse = fallback.RawResponse,
                Provider = request.Provider,
                Model = request.Model
            };
        }

        return new LlmChatResponse
        {
            Text = text.ToString(),
            ReasoningContent = reasoning.Length == 0 ? null : reasoning.ToString(),
            RawResponse = raw.ToString(),
            Provider = request.Provider,
            Model = request.Model
        };
    }

    private static LlmChatResponse? TryExtractFullResponse(string rawResponse)
    {
        try
        {
            return new LlmChatResponse
            {
                Text = ExtractAssistantText(rawResponse),
                ReasoningContent = ExtractReasoningContent(rawResponse),
                ToolCalls = ExtractToolCalls(rawResponse),
                RawResponse = rawResponse,
                Provider = string.Empty,
                Model = string.Empty
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static Dictionary<string, object?> BuildRequestPayload(LlmChatRequest request, bool stream)
    {
        var payload = new Dictionary<string, object?>
        {
            ["model"] = request.Model,
            ["messages"] = BuildMessages(request),
            ["temperature"] = request.Temperature
        };

        if (stream)
        {
            payload["stream"] = true;
        }

        if (request.Tools.Count > 0)
        {
            payload["tools"] = request.Tools.Select(tool => new
            {
                type = tool.Type,
                function = new
                {
                    name = tool.Function.Name,
                    description = tool.Function.Description,
                    parameters = tool.Function.Parameters
                }
            }).ToArray();
        }

        if (!string.IsNullOrWhiteSpace(request.ToolChoice))
        {
            payload["tool_choice"] = request.ToolChoice;
        }

        return payload;
    }

    private static object[] BuildMessages(LlmChatRequest request)
    {
        var messages = request.Messages;
        var files = request.Files;

        if (files.Count == 0)
        {
            return messages.Select(BuildMessagePayload).ToArray();
        }

        var result = messages.Select(BuildMessagePayload).ToList();

        var fileContent = new List<object>();
        foreach (var file in files)
        {
            if (!string.IsNullOrWhiteSpace(file.Text))
            {
                fileContent.Add(new { type = "text", text = $"File: {file.Name}\n{file.Text}" });
                continue;
            }

            if (!string.IsNullOrWhiteSpace(file.Url) && file.MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                fileContent.Add(new { type = "image_url", image_url = new { url = file.Url, detail = ResolveImageDetail(file, request) } });
                continue;
            }

            if (!string.IsNullOrWhiteSpace(file.Base64) && file.MimeType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                fileContent.Add(new { type = "image_url", image_url = new { url = $"data:{file.MimeType};base64,{file.Base64}", detail = ResolveImageDetail(file, request) } });
                continue;
            }

            if (!string.IsNullOrWhiteSpace(file.Url))
            {
                fileContent.Add(new { type = "text", text = $"File: {file.Name}\nURL: {file.Url}" });
            }
        }

        if (fileContent.Count > 0)
        {
            result.Add(new
            {
                role = "user",
                content = fileContent
            });
        }

        return result.ToArray();
    }

    private static object BuildMessagePayload(LlmChatMessage message)
    {
        var payload = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["role"] = message.Role
        };

        if (!string.IsNullOrWhiteSpace(message.Name))
        {
            payload["name"] = message.Name;
        }

        if (!string.IsNullOrWhiteSpace(message.ToolCallId))
        {
            payload["tool_call_id"] = message.ToolCallId;
        }

        if (message.ToolCalls.Count > 0)
        {
            payload["tool_calls"] = message.ToolCalls.Select(toolCall => new
            {
                id = toolCall.Id,
                type = toolCall.Type,
                function = new
                {
                    name = toolCall.Function.Name,
                    arguments = toolCall.Function.Arguments
                }
            }).ToArray();
        }

        payload["content"] = message.Content;
        return payload;
    }

    private static string ResolveImageDetail(LlmChatFile file, LlmChatRequest request)
        => string.IsNullOrWhiteSpace(file.Detail) ? request.ImageDetail : file.Detail;

    private static string ExtractAssistantText(string rawResponse)
    {
        using var document = JsonDocument.Parse(rawResponse);
        var root = document.RootElement;

        if (root.TryGetProperty("choices", out var choices)
            && choices.ValueKind == JsonValueKind.Array
            && choices.GetArrayLength() > 0)
        {
            var firstChoice = choices[0];
            if (firstChoice.TryGetProperty("message", out var message)
                && message.TryGetProperty("content", out var content))
            {
                return NormalizeAssistantText(ExtractContentText(content));
            }

            if (firstChoice.TryGetProperty("text", out var text))
            {
                return NormalizeAssistantText(text.GetString() ?? string.Empty);
            }
        }

        return NormalizeAssistantText(rawResponse);
    }

    private static string? ExtractReasoningContent(string rawResponse)
    {
        using var document = JsonDocument.Parse(rawResponse);
        var root = document.RootElement;

        if (root.TryGetProperty("choices", out var choices)
            && choices.ValueKind == JsonValueKind.Array
            && choices.GetArrayLength() > 0)
        {
            var firstChoice = choices[0];
            if (firstChoice.TryGetProperty("message", out var message)
                && message.TryGetProperty("reasoning_content", out var reasoningContent))
            {
                return reasoningContent.ValueKind == JsonValueKind.String
                    ? reasoningContent.GetString()
                    : reasoningContent.ToString();
            }
        }

        return null;
    }

    private static IReadOnlyCollection<LlmToolCall> ExtractToolCalls(string rawResponse)
    {
        using var document = JsonDocument.Parse(rawResponse);
        var root = document.RootElement;

        if (!root.TryGetProperty("choices", out var choices)
            || choices.ValueKind != JsonValueKind.Array
            || choices.GetArrayLength() == 0)
        {
            return [];
        }

        var firstChoice = choices[0];
        if (!firstChoice.TryGetProperty("message", out var message))
        {
            return [];
        }

        if (!message.TryGetProperty("tool_calls", out var toolCalls)
            || toolCalls.ValueKind != JsonValueKind.Array)
        {
            return ExtractPseudoToolCalls(message);
        }

        var result = new List<LlmToolCall>();
        foreach (var toolCall in toolCalls.EnumerateArray())
        {
            if (!toolCall.TryGetProperty("function", out var function))
            {
                continue;
            }

            result.Add(new LlmToolCall
            {
                Id = TryGetString(toolCall, "id") ?? string.Empty,
                Type = TryGetString(toolCall, "type") ?? "function",
                Function = new LlmToolCallFunction
                {
                    Name = TryGetString(function, "name") ?? string.Empty,
                    Arguments = TryGetString(function, "arguments") ?? "{}"
                }
            });
        }

        return result;
    }

    private static IReadOnlyCollection<LlmToolCall> ExtractPseudoToolCalls(JsonElement message)
    {
        if (!message.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.String)
        {
            return [];
        }

        var text = content.GetString();
        if (string.IsNullOrWhiteSpace(text))
        {
            return [];
        }

        var matches = CompatiblePseudoToolCallRegex().Matches(text);
        if (matches.Count == 0)
        {
            return [];
        }

        var result = new List<LlmToolCall>();
        var index = 0;
        foreach (Match match in matches)
        {
            var name = match.Groups["name"].Value.Trim();
            var arguments = match.Groups["args"].Value.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            result.Add(new LlmToolCall
            {
                Id = $"pseudo_call_{++index}",
                Type = "function",
                Function = new LlmToolCallFunction
                {
                    Name = name,
                    Arguments = string.IsNullOrWhiteSpace(arguments) ? "{}" : arguments
                }
            });
        }

        return result;
    }

    private static LlmChatStreamDelta ExtractStreamDelta(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        if (!root.TryGetProperty("choices", out var choices)
            || choices.ValueKind != JsonValueKind.Array
            || choices.GetArrayLength() == 0)
        {
            return new LlmChatStreamDelta();
        }

        var firstChoice = choices[0];
        if (!firstChoice.TryGetProperty("delta", out var delta))
        {
            return new LlmChatStreamDelta();
        }

        return new LlmChatStreamDelta
        {
            Text = TryGetString(delta, "content"),
            ReasoningContent = TryGetString(delta, "reasoning_content")
        };
    }

    private static string? TryGetString(JsonElement element, string propertyName)
        => element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static string ExtractContentText(JsonElement content)
    {
        if (content.ValueKind == JsonValueKind.String)
        {
            return content.GetString() ?? string.Empty;
        }

        if (content.ValueKind != JsonValueKind.Array)
        {
            return content.ToString();
        }

        var builder = new StringBuilder();
        foreach (var item in content.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String)
            {
                builder.AppendLine(item.GetString());
                continue;
            }

            if (item.ValueKind != JsonValueKind.Object)
            {
                builder.AppendLine(item.ToString());
                continue;
            }

            if (item.TryGetProperty("text", out var text))
            {
                builder.AppendLine(text.ValueKind == JsonValueKind.String ? text.GetString() : text.ToString());
            }
        }

        return builder.ToString().Trim();
    }

    private static string NormalizeAssistantText(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var normalized = text.Replace("\r\n", "\n");

        normalized = CompatiblePseudoToolCallRegex().Replace(normalized, string.Empty);
        normalized = IncipientInvokeBlockRegex().Replace(normalized, string.Empty);
        normalized = ToolCallMarkerRegex().Replace(normalized, string.Empty);
        normalized = IncipientLineRegex().Replace(normalized, string.Empty);
        normalized = BlankLineRegex().Replace(normalized, "\n\n");

        return normalized.Trim();
    }

    [GeneratedRegex(@"INCIPIENT\s*```json\s*\{[\s\S]*?\}\s*```", RegexOptions.IgnoreCase)]
    private static partial Regex IncipientInvokeBlockRegex();

    [GeneratedRegex(@"<\s*\|?\s*tool_call\s*\|?\s*tool_calls_end\s*\|?\s*>", RegexOptions.IgnoreCase)]
    private static partial Regex ToolCallMarkerRegex();

    [GeneratedRegex(@"(?<prefix>[\p{L}\p{P}\p{Zs}]*)function[-－—_ ]+(?<name>[A-Za-z0-9_.-]+)\s*```(?:json)?\s*(?<args>\{[\s\S]*?\})\s*```(?:\s*<[^>\n]*tool[^\n>]*call[^\n>]*end[^>\n]*>)?", RegexOptions.IgnoreCase)]
    private static partial Regex PseudoToolCallRegex();

    [GeneratedRegex(@"^\s*INCIPIENT\s*$\n?", RegexOptions.IgnoreCase | RegexOptions.Multiline)]
    private static partial Regex IncipientLineRegex();

    [GeneratedRegex(@"(?<prefix>[\p{L}\p{P}\p{Zs}]*)function[-_\u2013\u2014\u2015\u2212\uFE63\uFF0D\u2581 ]+(?<name>[A-Za-z0-9_.-]+)\s*```(?:json)?\s*(?<args>\{[\s\S]*?\})\s*```(?:\s*<[^>\n]*tool[^\n>]*call[^\n>]*end[^>\n]*>)?", RegexOptions.IgnoreCase)]
    private static partial Regex CompatiblePseudoToolCallRegex();

    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex BlankLineRegex();
}
