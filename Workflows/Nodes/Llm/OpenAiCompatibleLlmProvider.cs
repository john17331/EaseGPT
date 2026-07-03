using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace EaseGPT.Workflows.Nodes.Llm;

/// <summary>
/// OpenAI-compatible chat provider. Qwen compatible mode, Doubao Ark, OpenAI, and many private gateways can use this adapter.
/// </summary>
public sealed class OpenAiCompatibleLlmProvider : ILlmChatProvider
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
        httpRequest.Content = JsonContent.Create(new
        {
            model = request.Model,
            messages = BuildMessages(request),
            temperature = request.Temperature
        });

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
        httpRequest.Content = JsonContent.Create(new
        {
            model = request.Model,
            messages = BuildMessages(request),
            temperature = request.Temperature,
            stream = true
        });

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

    private static object[] BuildMessages(LlmChatRequest request)
    {
        var messages = request.Messages;
        var files = request.Files;

        if (files.Count == 0)
        {
            return messages.Select(message => new
            {
                role = message.Role,
                content = message.Content
            }).ToArray();
        }

        var result = messages.Select(message => new
        {
            role = message.Role,
            content = (object)message.Content
        }).Cast<object>().ToList();

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
                return content.ValueKind == JsonValueKind.String ? content.GetString() ?? string.Empty : content.ToString();
            }

            if (firstChoice.TryGetProperty("text", out var text))
            {
                return text.GetString() ?? string.Empty;
            }
        }

        return rawResponse;
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
}
