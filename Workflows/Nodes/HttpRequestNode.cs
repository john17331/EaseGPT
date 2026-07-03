using System.Net;
using System.Net.Http.Headers;
using System.Text;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed class HttpRequestNode : IWorkflowNode
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<HttpRequestNode> _logger;

    public HttpRequestNode(IHttpClientFactory clients, ILogger<HttpRequestNode> logger)
    {
        _httpClient = clients.CreateClient(WorkflowHttpClients.ExternalRequest);
        _logger = logger;
    }

    public string Type => "integration.http-request";

    public string DisplayName => "HTTP 请求";

    public string Description => "调用外部 HTTP 接口，支持自定义请求头、超时和失败重试。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var urlTemplate = context.GetString("url") ?? throw new InvalidOperationException("HTTP 请求必须配置 URL。");
        var method = new HttpMethod(context.GetString("method") ?? "GET");
        var url = TemplateRenderer.Render(urlTemplate, context.Input, context.Variables);
        var bodyTemplate = context.GetString("body");
        var body = string.IsNullOrWhiteSpace(bodyTemplate) ? null : RenderNullable(bodyTemplate, context);
        var queryParameters = context.GetSetting<List<HttpQueryParameterDefinition>>("queryParameters") ?? [];
        url = AppendQueryParameters(url, queryParameters, context);
        var headers = context.GetSetting<List<HttpHeaderDefinition>>("headers") ?? [];
        var timeoutSeconds = Math.Clamp(context.GetInt32("timeoutSeconds") ?? 30, 1, 300);
        var retryCount = Math.Clamp(context.GetInt32("retryCount") ?? 0, 0, 5);
        var attempt = 0;

        while (true)
        {
            attempt++;
            try
            {
                using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
                timeoutSource.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
                using var request = BuildRequest(method, url, body, headers, context);

                _logger.LogInformation(
                    "Calling {Method} {Url}, attempt {Attempt}/{TotalAttempts}",
                    method,
                    url,
                    attempt,
                    retryCount + 1);

                using var response = await _httpClient.SendAsync(request, timeoutSource.Token);
                var content = await response.Content.ReadAsStringAsync(timeoutSource.Token);

                if (ShouldRetry(response.StatusCode) && attempt <= retryCount)
                {
                    await DelayBeforeRetryAsync(attempt, context.CancellationToken);
                    continue;
                }

                var output = new Dictionary<string, object?>(context.Input)
                {
                    ["statusCode"] = (int)response.StatusCode,
                    ["responseBody"] = content,
                    ["requestAttempts"] = attempt
                };

                return NodeExecutionResult.Continue(output);
            }
            catch (OperationCanceledException) when (!context.CancellationToken.IsCancellationRequested && attempt <= retryCount)
            {
                await DelayBeforeRetryAsync(attempt, context.CancellationToken);
            }
            catch (HttpRequestException) when (attempt <= retryCount)
            {
                await DelayBeforeRetryAsync(attempt, context.CancellationToken);
            }
            catch (OperationCanceledException) when (!context.CancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException($"HTTP request timed out after {timeoutSeconds} seconds and {attempt} attempt(s).");
            }
        }
    }

    private static HttpRequestMessage BuildRequest(
        HttpMethod method,
        string url,
        string? body,
        IReadOnlyCollection<HttpHeaderDefinition> headers,
        NodeExecutionContext context)
    {
        var request = new HttpRequestMessage(method, url);
        var renderedHeaders = headers
            .Where(header => !string.IsNullOrWhiteSpace(header.Name))
            .Select(header => new HttpHeaderDefinition
            {
                Name = TemplateRenderer.Render(header.Name, context.Input, context.Variables).Trim(),
                Value = TemplateRenderer.Render(header.Value, context.Input, context.Variables)
            })
            .ToList();
        var contentType = renderedHeaders.FirstOrDefault(header =>
            header.Name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase))?.Value;

        if (body is not null)
        {
            request.Content = new StringContent(body, Encoding.UTF8);
            request.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(
                string.IsNullOrWhiteSpace(contentType) ? "application/json" : contentType);
        }

        foreach (var header in renderedHeaders.Where(header =>
                     !header.Name.Equals("Content-Type", StringComparison.OrdinalIgnoreCase)))
        {
            if (!request.Headers.TryAddWithoutValidation(header.Name, header.Value))
            {
                request.Content?.Headers.TryAddWithoutValidation(header.Name, header.Value);
            }
        }

        return request;
    }

    private static string? RenderNullable(string? value, NodeExecutionContext context)
        => value is null ? null : TemplateRenderer.Render(value, context.Input, context.Variables);

    private static string AppendQueryParameters(
        string url,
        IReadOnlyCollection<HttpQueryParameterDefinition> parameters,
        NodeExecutionContext context)
    {
        var renderedParameters = parameters
            .Where(parameter => !string.IsNullOrWhiteSpace(parameter.Name))
            .Select(parameter =>
            {
                var name = TemplateRenderer.Render(parameter.Name, context.Input, context.Variables).Trim();
                var value = TemplateRenderer.Render(parameter.Value, context.Input, context.Variables);
                return $"{Uri.EscapeDataString(name)}={Uri.EscapeDataString(value)}";
            })
            .ToList();

        if (renderedParameters.Count == 0)
        {
            return url;
        }

        var fragmentIndex = url.IndexOf('#');
        var fragment = fragmentIndex >= 0 ? url[fragmentIndex..] : string.Empty;
        var baseUrl = fragmentIndex >= 0 ? url[..fragmentIndex] : url;
        var separator = baseUrl.Contains('?')
            ? baseUrl.EndsWith('?') || baseUrl.EndsWith('&') ? string.Empty : "&"
            : "?";

        return $"{baseUrl}{separator}{string.Join("&", renderedParameters)}{fragment}";
    }

    private static bool ShouldRetry(HttpStatusCode statusCode)
        => statusCode is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests
           || (int)statusCode >= 500;

    private static Task DelayBeforeRetryAsync(int attempt, CancellationToken cancellationToken)
        => Task.Delay(TimeSpan.FromMilliseconds(Math.Min(2000, 250 * Math.Pow(2, attempt - 1))), cancellationToken);
}

public sealed class HttpHeaderDefinition
{
    public string Name { get; init; } = string.Empty;

    public string Value { get; init; } = string.Empty;
}

public sealed class HttpQueryParameterDefinition
{
    public string Name { get; init; } = string.Empty;

    public string Value { get; init; } = string.Empty;
}
