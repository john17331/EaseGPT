using EaseGPT.Workflows.Execution;
using EaseGPT.Workflows.Nodes;
using EaseGPT.Workflows.Nodes.Llm;
using EaseGPT.Workflows.Scheduling;
using EaseGPT.Workflows.Storage;

namespace EaseGPT.Workflows;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWorkflowEngine(this IServiceCollection services)
    {
        services.AddHttpClient(WorkflowHttpClients.ExternalRequest, client =>
            client.Timeout = Timeout.InfiniteTimeSpan);
        services.AddHttpClient(WorkflowHttpClients.Llm, client =>
            client.Timeout = Timeout.InfiniteTimeSpan);
        services.AddHttpClient(WorkflowHttpClients.WeCom);
        services.AddHttpClient(WorkflowHttpClients.WebCrawler)
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
            {
                AllowAutoRedirect = false,
                AutomaticDecompression = System.Net.DecompressionMethods.All
            });

        services.AddSingleton<LiteDbContext>();
        services.AddSingleton<IWorkflowStore, LiteDbWorkflowStore>();
        services.AddSingleton<IWorkflowExecutionLog, LiteDbWorkflowExecutionLog>();
        services.AddSingleton<ILlmProviderConfigStore, LiteDbLlmProviderConfigStore>();
        services.AddSingleton<ILlmProviderDefinitionStore, LiteDbLlmProviderDefinitionStore>();
        services.AddSingleton<ILlmModelMetadataResolver, LlmModelMetadataResolver>();
        services.AddSingleton<IWorkflowExecutionControl, WorkflowExecutionControl>();
        services.AddSingleton<IWorkflowExecutor, WorkflowExecutor>();
        services.AddSingleton<IWorkflowSchedulerClock, SystemWorkflowSchedulerClock>();

        services.AddSingleton<ILlmChatProvider, OpenAiCompatibleLlmProvider>();
        services.AddSingleton<LlmChatProviderRegistry>();

        services.AddSingleton<IWorkflowNode, ManualTriggerNode>();
        services.AddSingleton<IWorkflowNode, ScheduleTriggerNode>();
        services.AddSingleton<IWorkflowNode, HttpRequestNode>();
        services.AddSingleton<IWorkflowNode, DatabaseNode>();
        services.AddSingleton<IWorkflowNode, WeComMessageNode>();
        services.AddSingleton<IWorkflowNode, WebCrawlerNode>();
        services.AddSingleton<IWorkflowNode, LlmChatNode>();
        services.AddSingleton<IWorkflowNode, KnowledgeRetrievalNode>();
        services.AddSingleton<IWorkflowNode, QuestionClassifierNode>();
        services.AddSingleton<IWorkflowNode, TemplateNode>();
        services.AddSingleton<IWorkflowNodeRegistry, WorkflowNodeRegistry>();

        services.AddHostedService<ScheduledWorkflowHostedService>();
        return services;
    }
}

internal static class WorkflowHttpClients
{
    public const string ExternalRequest = "workflow-external-request";
    public const string Llm = "workflow-llm";
    public const string WeCom = "workflow-wecom";
    public const string WebCrawler = "workflow-web-crawler";
}
