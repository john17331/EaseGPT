using System.Net;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

public sealed partial class WebCrawlerNode : IWorkflowNode
{
    private const int MaxRedirects = 5;
    private const int MaxResponseBytes = 4 * 1024 * 1024;
    private const string DefaultUserAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/100.0.1000.0 Safari/537.36";

    private readonly HttpClient _httpClient;
    private readonly ILogger<WebCrawlerNode> _logger;

    public WebCrawlerNode(IHttpClientFactory clients, ILogger<WebCrawlerNode> logger)
    {
        _httpClient = clients.CreateClient(WorkflowHttpClients.WebCrawler);
        _logger = logger;
    }

    public string Type => "integration.web-crawler";

    public string DisplayName => "网页爬虫";

    public string Description => "抓取网页并提取标题、描述、正文、摘要和页面链接。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var urlTemplate = context.GetString("url")
            ?? throw new InvalidOperationException("网页爬虫必须配置网页链接。");
        var renderedUrl = TemplateRenderer.Render(urlTemplate, context.Input, context.Variables).Trim();
        var userAgent = TemplateRenderer.Render(
            context.GetString("userAgent") ?? DefaultUserAgent,
            context.Input,
            context.Variables).Trim();
        var generateSummary = context.GetBoolean("generateSummary") ?? true;
        var timeoutSeconds = Math.Clamp(context.GetInt32("timeoutSeconds") ?? 30, 1, 300);
        var retryCount = Math.Clamp(context.GetInt32("retryCount") ?? 0, 0, 5);
        var maxContentLength = Math.Clamp(context.GetInt32("maxContentLength") ?? 100_000, 1_000, 500_000);

        var attempt = 0;
        while (true)
        {
            attempt++;
            try
            {
                using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
                timeoutSource.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
                var page = await FetchPageAsync(renderedUrl, userAgent, timeoutSource.Token);
                var content = ExtractReadableText(page.Html, maxContentLength);
                var title = ExtractTitle(page.Html);
                var description = ExtractMetaDescription(page.Html);
                var summary = generateSummary ? CreateSummary(description, content) : string.Empty;
                var links = ExtractLinks(page.Html, page.FinalUri);

                var output = new Dictionary<string, object?>(context.Input)
                {
                    ["webUrl"] = page.FinalUri.AbsoluteUri,
                    ["webTitle"] = title,
                    ["webDescription"] = description,
                    ["webContent"] = content,
                    ["webSummary"] = summary,
                    ["webLinks"] = links,
                    ["webStatusCode"] = (int)page.StatusCode,
                    ["webContentType"] = page.ContentType,
                    ["webRequestAttempts"] = attempt
                };

                return NodeExecutionResult.Continue(
                    output,
                    recordedInput: new Dictionary<string, object?>
                    {
                        ["url"] = renderedUrl,
                        ["userAgent"] = userAgent,
                        ["generateSummary"] = generateSummary
                    },
                    recordedOutput: new Dictionary<string, object?>
                    {
                        ["url"] = page.FinalUri.AbsoluteUri,
                        ["title"] = title,
                        ["contentLength"] = content.Length,
                        ["linkCount"] = links.Count,
                        ["statusCode"] = (int)page.StatusCode,
                        ["attempts"] = attempt
                    });
            }
            catch (OperationCanceledException) when (
                !context.CancellationToken.IsCancellationRequested && attempt <= retryCount)
            {
                await DelayBeforeRetryAsync(attempt, context.CancellationToken);
            }
            catch (HttpRequestException exception) when (
                attempt <= retryCount && ShouldRetry(exception.StatusCode))
            {
                await DelayBeforeRetryAsync(attempt, context.CancellationToken);
            }
            catch (OperationCanceledException) when (!context.CancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException($"网页抓取在 {timeoutSeconds} 秒后超时，共尝试 {attempt} 次。");
            }
        }
    }

    private async Task<CrawledPage> FetchPageAsync(
        string url,
        string userAgent,
        CancellationToken cancellationToken)
    {
        var currentUri = ParseHttpUri(url);
        for (var redirect = 0; redirect <= MaxRedirects; redirect++)
        {
            await EnsurePublicAddressAsync(currentUri, cancellationToken);
            using var request = new HttpRequestMessage(HttpMethod.Get, currentUri);
            request.Headers.UserAgent.ParseAdd(string.IsNullOrWhiteSpace(userAgent) ? DefaultUserAgent : userAgent);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/html"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/plain", 0.8));

            _logger.LogInformation("Crawling {Url}, redirect {Redirect}/{MaxRedirects}", currentUri, redirect, MaxRedirects);
            using var response = await _httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (IsRedirect(response.StatusCode))
            {
                if (redirect == MaxRedirects)
                {
                    throw new HttpRequestException($"网页重定向次数超过 {MaxRedirects} 次。");
                }

                var location = response.Headers.Location
                    ?? throw new HttpRequestException("网页返回重定向状态，但没有提供 Location。");
                currentUri = location.IsAbsoluteUri ? location : new Uri(currentUri, location);
                continue;
            }

            if (!response.IsSuccessStatusCode)
            {
                throw new HttpRequestException(
                    $"网页抓取失败，HTTP 状态码 {(int)response.StatusCode} {response.ReasonPhrase}。",
                    null,
                    response.StatusCode);
            }

            var mediaType = response.Content.Headers.ContentType?.MediaType ?? string.Empty;
            if (!mediaType.StartsWith("text/", StringComparison.OrdinalIgnoreCase)
                && !mediaType.Equals("application/xhtml+xml", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"网页爬虫不支持内容类型：{mediaType}");
            }

            var html = await ReadLimitedContentAsync(response.Content, cancellationToken);
            return new CrawledPage(
                currentUri,
                response.StatusCode,
                response.Content.Headers.ContentType?.ToString() ?? mediaType,
                html);
        }

        throw new HttpRequestException("网页抓取失败。");
    }

    private static async Task<string> ReadLimitedContentAsync(
        HttpContent content,
        CancellationToken cancellationToken)
    {
        await using var stream = await content.ReadAsStreamAsync(cancellationToken);
        using var buffer = new MemoryStream();
        var chunk = new byte[16 * 1024];
        while (buffer.Length <= MaxResponseBytes)
        {
            var read = await stream.ReadAsync(chunk, cancellationToken);
            if (read == 0) break;
            if (buffer.Length + read > MaxResponseBytes)
            {
                throw new InvalidOperationException($"网页响应超过 {MaxResponseBytes / 1024 / 1024} MB 限制。");
            }

            await buffer.WriteAsync(chunk.AsMemory(0, read), cancellationToken);
        }

        var bytes = buffer.ToArray();
        var encoding = ResolveEncoding(content.Headers.ContentType?.CharSet, bytes);
        return encoding.GetString(bytes);
    }

    private static Encoding ResolveEncoding(string? charset, byte[] bytes)
    {
        var normalizedCharset = charset?.Trim(' ', '"', '\'');
        if (!string.IsNullOrWhiteSpace(normalizedCharset))
        {
            try
            {
                return Encoding.GetEncoding(normalizedCharset);
            }
            catch (ArgumentException)
            {
                // Fall back to the document declaration and then UTF-8.
            }
        }

        var prefix = Encoding.ASCII.GetString(bytes, 0, Math.Min(bytes.Length, 4096));
        var match = CharsetRegex().Match(prefix);
        if (match.Success)
        {
            try
            {
                return Encoding.GetEncoding(match.Groups["charset"].Value);
            }
            catch (ArgumentException)
            {
                // UTF-8 is the safest fallback for modern web pages.
            }
        }

        return Encoding.UTF8;
    }

    private static Uri ParseHttpUri(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https"))
        {
            throw new InvalidOperationException("网页链接必须是有效的 HTTP 或 HTTPS 地址。");
        }

        return uri;
    }

    private static async Task EnsurePublicAddressAsync(Uri uri, CancellationToken cancellationToken)
    {
        if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || uri.Host.EndsWith(".localhost", StringComparison.OrdinalIgnoreCase)
            || uri.Host.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("网页爬虫不允许访问本机或内网地址。");
        }

        IPAddress[] addresses;
        if (IPAddress.TryParse(uri.Host, out var literalAddress))
        {
            addresses = [literalAddress];
        }
        else
        {
            try
            {
                addresses = await Dns.GetHostAddressesAsync(uri.Host, cancellationToken);
            }
            catch (SocketException exception)
            {
                throw new HttpRequestException($"无法解析网页域名：{uri.Host}", exception);
            }
        }

        if (addresses.Length == 0 || addresses.Any(IsPrivateAddress))
        {
            throw new InvalidOperationException("网页爬虫不允许访问本机或内网地址。");
        }
    }

    private static bool IsPrivateAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (IPAddress.IsLoopback(address)
            || address.Equals(IPAddress.Any)
            || address.Equals(IPAddress.IPv6Any)
            || address.Equals(IPAddress.IPv6None)
            || address.IsIPv6LinkLocal
            || address.IsIPv6SiteLocal
            || address.IsIPv6Multicast)
        {
            return true;
        }

        var bytes = address.GetAddressBytes();
        if (address.AddressFamily == AddressFamily.InterNetworkV6)
        {
            return (bytes[0] & 0xFE) == 0xFC;
        }

        return bytes[0] is 0 or 10 or 127
            || bytes[0] >= 224
            || bytes[0] == 169 && bytes[1] == 254
            || bytes[0] == 172 && bytes[1] is >= 16 and <= 31
            || bytes[0] == 192 && bytes[1] == 168
            || bytes[0] == 100 && bytes[1] is >= 64 and <= 127
            || bytes[0] == 198 && bytes[1] is 18 or 19;
    }

    private static string ExtractTitle(string html)
    {
        var match = TitleRegex().Match(html);
        return match.Success ? NormalizeInlineText(WebUtility.HtmlDecode(StripTags(match.Groups["value"].Value))) : string.Empty;
    }

    private static string ExtractMetaDescription(string html)
    {
        foreach (Match tagMatch in MetaTagRegex().Matches(html))
        {
            var tag = tagMatch.Value;
            var nameMatch = MetaNameRegex().Match(tag);
            if (!nameMatch.Success
                || !nameMatch.Groups["value"].Value.Equals("description", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var contentMatch = MetaContentRegex().Match(tag);
            if (contentMatch.Success)
            {
                return NormalizeInlineText(WebUtility.HtmlDecode(contentMatch.Groups["value"].Value));
            }
        }

        return string.Empty;
    }

    private static string ExtractReadableText(string html, int maxLength)
    {
        var text = RemoveInvisibleContentRegex().Replace(html, string.Empty);
        text = HtmlCommentRegex().Replace(text, string.Empty);
        text = BlockBreakRegex().Replace(text, "\n");
        text = StripTags(text);
        text = WebUtility.HtmlDecode(text);

        var lines = text
            .Split('\n')
            .Select(NormalizeInlineText)
            .Where(line => line.Length > 0);
        var content = string.Join('\n', lines);
        return content.Length <= maxLength ? content : content[..maxLength];
    }

    private static List<string> ExtractLinks(string html, Uri baseUri)
    {
        var links = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (Match match in HrefRegex().Matches(html))
        {
            var value = WebUtility.HtmlDecode(match.Groups["value"].Value).Trim();
            if (!Uri.TryCreate(baseUri, value, out var link)
                || link.Scheme is not ("http" or "https"))
            {
                continue;
            }

            var builder = new UriBuilder(link) { Fragment = string.Empty };
            links.Add(builder.Uri.AbsoluteUri);
            if (links.Count >= 200) break;
        }

        return links.ToList();
    }

    private static string CreateSummary(string description, string content)
    {
        if (!string.IsNullOrWhiteSpace(description)) return description;
        if (content.Length <= 300) return content;

        var boundary = content.LastIndexOfAny(['。', '！', '？', '.', '!', '?'], 299);
        return boundary >= 80 ? content[..(boundary + 1)] : $"{content[..300]}...";
    }

    private static string StripTags(string value) => HtmlTagRegex().Replace(value, string.Empty);

    private static string NormalizeInlineText(string value)
        => WhitespaceRegex().Replace(value, " ").Trim();

    private static bool IsRedirect(HttpStatusCode statusCode)
        => statusCode is HttpStatusCode.MovedPermanently
            or HttpStatusCode.Found
            or HttpStatusCode.SeeOther
            or HttpStatusCode.TemporaryRedirect
            or HttpStatusCode.PermanentRedirect;

    private static bool ShouldRetry(HttpStatusCode? statusCode)
        => statusCode is null
            or HttpStatusCode.RequestTimeout
            or HttpStatusCode.TooManyRequests
            || (int)statusCode >= 500;

    private static Task DelayBeforeRetryAsync(int attempt, CancellationToken cancellationToken)
        => Task.Delay(TimeSpan.FromMilliseconds(Math.Min(2000, 250 * Math.Pow(2, attempt - 1))), cancellationToken);

    private sealed record CrawledPage(
        Uri FinalUri,
        HttpStatusCode StatusCode,
        string ContentType,
        string Html);

    [GeneratedRegex(@"charset\s*=\s*['""]?(?<charset>[-\w]+)", RegexOptions.IgnoreCase)]
    private static partial Regex CharsetRegex();

    [GeneratedRegex(@"<title\b[^>]*>(?<value>[\s\S]*?)</title>", RegexOptions.IgnoreCase)]
    private static partial Regex TitleRegex();

    [GeneratedRegex(@"<meta\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex MetaTagRegex();

    [GeneratedRegex(@"\b(?:name|property)\s*=\s*(['""])(?<value>.*?)\1", RegexOptions.IgnoreCase)]
    private static partial Regex MetaNameRegex();

    [GeneratedRegex(@"\bcontent\s*=\s*(['""])(?<value>.*?)\1", RegexOptions.IgnoreCase)]
    private static partial Regex MetaContentRegex();

    [GeneratedRegex(@"<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?</\1\s*>", RegexOptions.IgnoreCase)]
    private static partial Regex RemoveInvisibleContentRegex();

    [GeneratedRegex(@"<!--[\s\S]*?-->")]
    private static partial Regex HtmlCommentRegex();

    [GeneratedRegex(@"<(br|/p|/div|/section|/article|/header|/footer|/main|/aside|/nav|/h[1-6]|/li|/tr)\b[^>]*>", RegexOptions.IgnoreCase)]
    private static partial Regex BlockBreakRegex();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();

    [GeneratedRegex(@"\bhref\s*=\s*(['""])(?<value>.*?)\1", RegexOptions.IgnoreCase)]
    private static partial Regex HrefRegex();
}
