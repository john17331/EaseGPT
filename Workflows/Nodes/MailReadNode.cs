using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.RegularExpressions;
using EaseGPT.Workflows.Execution;
using EaseGPT.Workflows.Storage;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Pop3;
using MailKit.Search;
using MailKit.Security;
using MimeKit;

namespace EaseGPT.Workflows.Nodes;

public sealed partial class MailReadNode : IWorkflowNode
{
    private static readonly JsonSerializerOptions CompactJsonOptions = new()
    {
        WriteIndented = false,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IMailFingerprintStore _fingerprintStore;

    public MailReadNode(IMailFingerprintStore fingerprintStore)
    {
        _fingerprintStore = fingerprintStore;
    }

    public string Type => "integration.mail-read";

    public string DisplayName => "邮件读取";

    public string Description => "通过 IMAP 或 POP3 收取邮件，解析正文、HTML 和附件。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var protocol = (context.GetString("protocol") ?? "imap").Trim().ToLowerInvariant();
        var hostTemplate = context.GetString("host") ?? throw new InvalidOperationException("邮件服务器地址不能为空。");
        var host = TemplateRenderer.Render(hostTemplate, context.Input, context.Variables).Trim();
        var security = (context.GetString("security") ?? "ssl").Trim().ToLowerInvariant();
        var port = context.GetInt32("port") ?? GetDefaultPort(protocol, security);
        var usernameTemplate = context.GetString("username") ?? throw new InvalidOperationException("邮箱账号不能为空。");
        var username = TemplateRenderer.Render(usernameTemplate, context.Input, context.Variables).Trim();
        var passwordTemplate = context.GetString("password") ?? string.Empty;
        var password = TemplateRenderer.Render(passwordTemplate, context.Input, context.Variables);
        var folderTemplate = context.GetString("folder") ?? "INBOX";
        var folder = TemplateRenderer.Render(folderTemplate, context.Input, context.Variables).Trim();
        var unreadOnly = context.GetBoolean("unreadOnly") ?? false;
        var markAsRead = context.GetBoolean("markAsRead") ?? false;
        var ignoreKnownMessages = context.GetBoolean("ignoreKnownMessages") ?? true;
        var includeAttachments = context.GetBoolean("includeAttachments") ?? true;
        var popDeleteAfterRead = protocol == "pop3" && (context.GetBoolean("popDeleteAfterRead") ?? false);
        var maxMessages = Math.Clamp(context.GetInt32("maxMessages") ?? 10, 1, 100);
        var maxAttachmentBytes = Math.Clamp(context.GetInt32("maxAttachmentBytes") ?? 5 * 1024 * 1024, 1024, 25 * 1024 * 1024);
        var timeoutSeconds = Math.Clamp(context.GetInt32("timeoutSeconds") ?? 60, 5, 300);

        if (string.IsNullOrWhiteSpace(host))
        {
            throw new InvalidOperationException("邮件服务器地址不能为空。");
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            throw new InvalidOperationException("邮箱账号不能为空。");
        }

        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
        timeoutSource.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

        var scopeKey = BuildScopeKey(protocol, host, username, folder);
        var messages = protocol switch
        {
            "imap" => await ReadImapMessagesAsync(
                scopeKey,
                host,
                port,
                security,
                username,
                password,
                folder,
                unreadOnly,
                markAsRead,
                ignoreKnownMessages,
                includeAttachments,
                maxMessages,
                maxAttachmentBytes,
                timeoutSource.Token),
            "pop3" => await ReadPop3MessagesAsync(
                scopeKey,
                host,
                port,
                security,
                username,
                password,
                ignoreKnownMessages,
                includeAttachments,
                popDeleteAfterRead,
                maxMessages,
                maxAttachmentBytes,
                timeoutSource.Token),
            _ => throw new InvalidOperationException($"不支持的邮件协议：{protocol}")
        };

        var processedMessages = messages
            .Where(message => !(message.TryGetValue("__skipped", out var skipped) && skipped is true))
            .ToList();
        var skippedCount = messages.Count - processedMessages.Count;
        var latestProcessed = processedMessages.FirstOrDefault();

        var output = new Dictionary<string, object?>(context.Input)
        {
            ["mailProtocol"] = protocol,
            ["mailFolder"] = protocol == "imap" ? folder : "INBOX",
            ["mailCount"] = processedMessages.Count,
            ["mailFetchedCount"] = messages.Count,
            ["mailSkippedCount"] = skippedCount,
            ["mailItems"] = JsonSerializer.Serialize(processedMessages, CompactJsonOptions),
            ["mailMessages"] = FormatMailMessages(processedMessages),
            ["latestMailItem"] = latestProcessed,
            ["latestMail"] = FormatMailMessage(latestProcessed),
            ["latestMailText"] = latestProcessed?["textBody"],
            ["latestMailHtml"] = latestProcessed?["htmlBody"],
            ["latestMailAttachments"] = FormatAttachments(latestProcessed?["attachments"])
        };

        return NodeExecutionResult.Continue(output);
    }

    private async Task<List<Dictionary<string, object?>>> ReadImapMessagesAsync(
        string scopeKey,
        string host,
        int port,
        string security,
        string username,
        string password,
        string folder,
        bool unreadOnly,
        bool markAsRead,
        bool ignoreKnownMessages,
        bool includeAttachments,
        int maxMessages,
        int maxAttachmentBytes,
        CancellationToken cancellationToken)
    {
        using var client = new ImapClient();
        await client.ConnectAsync(host, port, ResolveSecureSocketOptions(security), cancellationToken);
        await client.AuthenticateAsync(username, password, cancellationToken);

        var mailFolder = await client.GetFolderAsync(folder, cancellationToken);
        await mailFolder.OpenAsync(markAsRead ? FolderAccess.ReadWrite : FolderAccess.ReadOnly, cancellationToken);

        var query = unreadOnly ? SearchQuery.NotSeen : SearchQuery.All;
        var ids = await mailFolder.SearchAsync(query, cancellationToken);
        var selectedIds = ids.Count > maxMessages
            ? ids.Skip(ids.Count - maxMessages).Reverse().ToList()
            : ids.Reverse().ToList();

        var result = new List<Dictionary<string, object?>>();
        foreach (var id in selectedIds)
        {
            var message = await mailFolder.GetMessageAsync(id, cancellationToken);
            var fingerprint = BuildFingerprint(message);
            var known = await _fingerprintStore.ExistsAsync(scopeKey, fingerprint, cancellationToken);

            if (known && ignoreKnownMessages)
            {
                result.Add(BuildSkippedMailMessage(message, fingerprint));
            }
            else
            {
                result.Add(await BuildMailMessageAsync(message, fingerprint, includeAttachments, maxAttachmentBytes, cancellationToken));
            }

            await _fingerprintStore.RememberAsync(
                scopeKey,
                fingerprint,
                message.MessageId,
                message.Subject,
                DateTimeOffset.UtcNow,
                cancellationToken);

            if (markAsRead)
            {
                await mailFolder.AddFlagsAsync(id, MessageFlags.Seen, true, cancellationToken);
            }
        }

        await client.DisconnectAsync(true, cancellationToken);
        return result;
    }

    private async Task<List<Dictionary<string, object?>>> ReadPop3MessagesAsync(
        string scopeKey,
        string host,
        int port,
        string security,
        string username,
        string password,
        bool ignoreKnownMessages,
        bool includeAttachments,
        bool popDeleteAfterRead,
        int maxMessages,
        int maxAttachmentBytes,
        CancellationToken cancellationToken)
    {
        using var client = new Pop3Client();
        await client.ConnectAsync(host, port, ResolveSecureSocketOptions(security), cancellationToken);
        await client.AuthenticateAsync(username, password, cancellationToken);

        var result = new List<Dictionary<string, object?>>();
        var startIndex = Math.Max(0, client.Count - maxMessages);
        for (var index = client.Count - 1; index >= startIndex; index -= 1)
        {
            var message = await client.GetMessageAsync(index, cancellationToken);
            var fingerprint = BuildFingerprint(message);
            var known = await _fingerprintStore.ExistsAsync(scopeKey, fingerprint, cancellationToken);

            if (known && ignoreKnownMessages)
            {
                result.Add(BuildSkippedMailMessage(message, fingerprint));
            }
            else
            {
                result.Add(await BuildMailMessageAsync(message, fingerprint, includeAttachments, maxAttachmentBytes, cancellationToken));
            }

            await _fingerprintStore.RememberAsync(
                scopeKey,
                fingerprint,
                message.MessageId,
                message.Subject,
                DateTimeOffset.UtcNow,
                cancellationToken);

            if (popDeleteAfterRead)
            {
                client.DeleteMessage(index);
            }
        }

        await client.DisconnectAsync(true, cancellationToken);
        return result;
    }

    private static async Task<Dictionary<string, object?>> BuildMailMessageAsync(
        MimeMessage message,
        string fingerprint,
        bool includeAttachments,
        int maxAttachmentBytes,
        CancellationToken cancellationToken)
    {
        var subject = NormalizeText(message.Subject);
        var htmlBody = NormalizeText(message.HtmlBody);
        var textBody = SelectPreferredTextBody(message, htmlBody);
        var attachments = new List<Dictionary<string, object?>>();

        foreach (var attachment in message.Attachments)
        {
            attachments.Add(await BuildAttachmentAsync(attachment, includeAttachments, maxAttachmentBytes, cancellationToken));
        }

        return new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["fingerprint"] = fingerprint,
            ["messageId"] = message.MessageId ?? string.Empty,
            ["subject"] = subject,
            ["from"] = string.Join(", ", message.From.Select(item => item.ToString())),
            ["to"] = string.Join(", ", message.To.Select(item => item.ToString())),
            ["cc"] = string.Join(", ", message.Cc.Select(item => item.ToString())),
            ["date"] = message.Date == DateTimeOffset.MinValue ? null : message.Date,
            ["textBody"] = textBody,
            ["htmlBody"] = htmlBody,
            ["body"] = !string.IsNullOrWhiteSpace(textBody) ? textBody : htmlBody,
            ["attachments"] = attachments,
            ["attachmentCount"] = attachments.Count,
            ["isKnownMessage"] = false
        };
    }

    private static Dictionary<string, object?> BuildSkippedMailMessage(MimeMessage message, string fingerprint)
        => new(StringComparer.OrdinalIgnoreCase)
        {
            ["fingerprint"] = fingerprint,
            ["messageId"] = message.MessageId ?? string.Empty,
            ["subject"] = NormalizeText(message.Subject),
            ["from"] = string.Join(", ", message.From.Select(item => item.ToString())),
            ["to"] = string.Join(", ", message.To.Select(item => item.ToString())),
            ["cc"] = string.Join(", ", message.Cc.Select(item => item.ToString())),
            ["date"] = message.Date == DateTimeOffset.MinValue ? null : message.Date,
            ["attachments"] = new List<Dictionary<string, object?>>(),
            ["attachmentCount"] = 0,
            ["isKnownMessage"] = true,
            ["__skipped"] = true
        };

    private static async Task<Dictionary<string, object?>> BuildAttachmentAsync(
        MimeEntity attachment,
        bool includeAttachments,
        int maxAttachmentBytes,
        CancellationToken cancellationToken)
    {
        var fileName = attachment.ContentDisposition?.FileName
                       ?? attachment.ContentType.Name
                       ?? "attachment";
        var contentType = attachment.ContentType.MimeType;

        if (attachment is MessagePart messagePart)
        {
            await using var stream = new MemoryStream();
            if (messagePart.Message is not null)
            {
                await messagePart.Message.WriteToAsync(stream, cancellationToken);
            }
            return BuildAttachmentPayload(
                fileName,
                contentType,
                stream.ToArray(),
                includeAttachments,
                maxAttachmentBytes,
                attachment.ContentId,
                attachment.IsAttachment);
        }

        if (attachment is MimePart mimePart)
        {
            await using var stream = new MemoryStream();
            if (mimePart.Content is not null)
            {
                await mimePart.Content.DecodeToAsync(stream, cancellationToken);
            }
            return BuildAttachmentPayload(
                fileName,
                contentType,
                stream.ToArray(),
                includeAttachments,
                maxAttachmentBytes,
                attachment.ContentId,
                attachment.IsAttachment);
        }

        return new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["fileName"] = fileName,
            ["contentType"] = contentType,
            ["size"] = 0,
            ["base64"] = null,
            ["omitted"] = true,
            ["contentId"] = attachment.ContentId,
            ["isAttachment"] = attachment.IsAttachment
        };
    }

    private static Dictionary<string, object?> BuildAttachmentPayload(
        string fileName,
        string contentType,
        byte[] content,
        bool includeAttachments,
        int maxAttachmentBytes,
        string? contentId,
        bool isAttachment)
    {
        var payload = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["fileName"] = fileName,
            ["contentType"] = contentType,
            ["size"] = content.Length,
            ["contentId"] = contentId,
            ["isAttachment"] = isAttachment
        };

        if (!includeAttachments)
        {
            payload["base64"] = null;
            payload["omitted"] = true;
            return payload;
        }

        if (content.Length > maxAttachmentBytes)
        {
            payload["base64"] = null;
            payload["omitted"] = true;
            payload["omitReason"] = $"Attachment exceeds {maxAttachmentBytes} bytes.";
            return payload;
        }

        payload["base64"] = Convert.ToBase64String(content);
        payload["omitted"] = false;
        return payload;
    }

    private static SecureSocketOptions ResolveSecureSocketOptions(string security)
        => security switch
        {
            "none" => SecureSocketOptions.None,
            "starttls" => SecureSocketOptions.StartTls,
            _ => SecureSocketOptions.SslOnConnect
        };

    private static int GetDefaultPort(string protocol, string security)
        => (protocol, security) switch
        {
            ("imap", "none") => 143,
            ("imap", "starttls") => 143,
            ("imap", _) => 993,
            ("pop3", "none") => 110,
            ("pop3", "starttls") => 110,
            ("pop3", _) => 995,
            _ => 993
        };

    private static string BuildScopeKey(string protocol, string host, string username, string folder)
        => string.Join("|", [
            protocol.Trim().ToLowerInvariant(),
            host.Trim().ToLowerInvariant(),
            username.Trim().ToLowerInvariant(),
            (protocol == "imap" ? folder : "INBOX").Trim().ToLowerInvariant()
        ]);

    private static string BuildFingerprint(MimeMessage message)
    {
        if (!string.IsNullOrWhiteSpace(message.MessageId))
        {
            return $"mid:{message.MessageId.Trim().ToLowerInvariant()}";
        }

        var payload = string.Join("\n", [
            NormalizeText(string.Join(", ", message.From.Select(item => item.ToString()))),
            NormalizeText(message.Subject),
            message.Date == DateTimeOffset.MinValue ? string.Empty : message.Date.ToUniversalTime().ToString("O"),
            NormalizeText(message.TextBody),
            NormalizeText(message.HtmlBody)
        ]);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
        return $"sha256:{Convert.ToHexString(hash).ToLowerInvariant()}";
    }

    private static string FormatMailMessages(IReadOnlyList<Dictionary<string, object?>> messages)
        => messages.Count == 0
            ? string.Empty
            : string.Join("\n\n==========\n\n", messages.Select(FormatMailMessage));

    private static string FormatMailMessage(IReadOnlyDictionary<string, object?>? message)
    {
        if (message is null)
        {
            return string.Empty;
        }

        var lines = new List<string>();
        AppendLine(lines, "主题", GetString(message, "subject"), "（无主题）");
        AppendLine(lines, "发件人", GetString(message, "from"));
        AppendLine(lines, "收件人", GetString(message, "to"));
        AppendLine(lines, "抄送", GetString(message, "cc"));
        AppendLine(lines, "时间", GetString(message, "date"));

        var attachmentsText = FormatAttachments(message.TryGetValue("attachments", out var attachments) ? attachments : null);
        AppendLine(lines, "附件", attachmentsText, "无");

        var body = GetString(message, "body");
        if (!string.IsNullOrWhiteSpace(body))
        {
            lines.Add(string.Empty);
            lines.Add(body);
        }

        return string.Join("\n", lines);
    }

    private static string FormatAttachments(object? attachments)
    {
        if (attachments is not IEnumerable<Dictionary<string, object?>> items)
        {
            return string.Empty;
        }

        var names = items
            .Select(item => GetString(item, "fileName"))
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .ToList();

        return names.Count == 0 ? string.Empty : string.Join("，", names);
    }

    private static string GetString(IReadOnlyDictionary<string, object?> values, string key)
        => values.TryGetValue(key, out var value)
            ? NormalizeText(value?.ToString())
            : string.Empty;

    private static void AppendLine(List<string> lines, string label, string? value, string? fallback = null)
    {
        var resolved = string.IsNullOrWhiteSpace(value) ? fallback : value;
        if (!string.IsNullOrWhiteSpace(resolved))
        {
            lines.Add($"{label}：{resolved}");
        }
    }

    private static string SelectPreferredTextBody(MimeMessage message, string htmlBody)
    {
        var textBody = NormalizeText(message.TextBody);
        var htmlAsText = ConvertHtmlToText(htmlBody);

        if (string.IsNullOrWhiteSpace(textBody))
        {
            return htmlAsText;
        }

        if (!LooksLikeMojibake(textBody))
        {
            return textBody;
        }

        if (!string.IsNullOrWhiteSpace(htmlAsText) && !LooksLikeMojibake(htmlAsText))
        {
            return htmlAsText;
        }

        return textBody;
    }

    private static string NormalizeText(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Replace("\r\n", "\n").Replace('\r', '\n').Trim();

    private static bool LooksLikeMojibake(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var suspiciousTokenCount = MojibakeTokenRegex().Matches(value).Count;
        if (suspiciousTokenCount == 0)
        {
            return false;
        }

        return suspiciousTokenCount >= 3 || suspiciousTokenCount * 24 >= value.Length;
    }

    private static string ConvertHtmlToText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var withoutTags = HtmlTagRegex().Replace(html, " ");
        var decoded = WebUtility.HtmlDecode(withoutTags);
        return Regex.Replace(decoded, @"\s{2,}", " ").Trim();
    }

    [GeneratedRegex("<[^>]+>", RegexOptions.Compiled)]
    private static partial Regex HtmlTagRegex();

    [GeneratedRegex("(Ã.|Â.|Ð.|Ñ.|鍙|鈥|锟|�)", RegexOptions.Compiled)]
    private static partial Regex MojibakeTokenRegex();
}
