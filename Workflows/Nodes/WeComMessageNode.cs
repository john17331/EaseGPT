using System.Net.Http.Json;
using System.Text.Json;
using EaseGPT.Workflows.Execution;

namespace EaseGPT.Workflows.Nodes;

/// <summary>
/// Sends a text message through a WeCom group robot webhook.
/// </summary>
public sealed class WeComMessageNode : IWorkflowNode
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<WeComMessageNode> _logger;

    public WeComMessageNode(IHttpClientFactory clients, ILogger<WeComMessageNode> logger)
    {
        _httpClient = clients.CreateClient(WorkflowHttpClients.WeCom);
        _logger = logger;
    }

    public string Type => "integration.wecom-message";

    public string DisplayName => "企业微信群消息推送";

    public string Description => "通过企业微信群机器人 Webhook 发送文本消息。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var webhookUrl = context.GetString("webhookUrl")
            ?? throw new InvalidOperationException("企业微信消息节点必须配置 Webhook 地址。");
        var contentTemplate = context.GetString("content") ?? "{{question}}";
        var content = TemplateRenderer.Render(contentTemplate, context.Input, context.Variables);
        var mentionedList = SplitMentions(TemplateRenderer.Render(
            context.GetString("mentionedList") ?? string.Empty,
            context.Input,
            context.Variables));
        var mentionedMobileList = SplitMentions(TemplateRenderer.Render(
            context.GetString("mentionedMobileList") ?? string.Empty,
            context.Input,
            context.Variables));

        _logger.LogInformation("Sending WeCom group robot message");
        using var response = await _httpClient.PostAsJsonAsync(webhookUrl, new
        {
            msgtype = "text",
            text = new
            {
                content,
                mentioned_list = mentionedList,
                mentioned_mobile_list = mentionedMobileList
            }
        }, context.CancellationToken);
        var responseText = await response.Content.ReadAsStringAsync(context.CancellationToken);
        response.EnsureSuccessStatusCode();

        using var responseJson = JsonDocument.Parse(responseText);
        var root = responseJson.RootElement;
        var errorCode = root.TryGetProperty("errcode", out var errorCodeValue)
            && errorCodeValue.TryGetInt32(out var parsedErrorCode)
                ? parsedErrorCode
                : -1;
        if (errorCode != 0)
        {
            var errorMessage = root.TryGetProperty("errmsg", out var errorMessageValue)
                ? errorMessageValue.GetString()
                : responseText;
            throw new InvalidOperationException($"企业微信消息发送失败：{errorMessage}（{errorCode}）");
        }

        var output = new Dictionary<string, object?>(context.Input)
        {
            ["wecomMessageSent"] = true,
            ["wecomResponse"] = responseText
        };
        return NodeExecutionResult.Continue(output);
    }

    private static string[] SplitMentions(string value)
        => value.Split([',', '，', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
