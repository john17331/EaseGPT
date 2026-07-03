namespace EaseGPT.Infrastructure;

public static class WebApplicationExtensions
{
    public static WebApplication MapEaseGptPages(this WebApplication app)
    {
        app.MapStaticPage("/ai/{workflowId}", "workflow-run.html");
        app.MapStaticPage("/workflow-run/{workflowId}", "workflow-run.html");
        app.MapStaticPage("/designer/{workflowId}", "designer.html");
        app.MapStaticPage("/agent-designer/{agentId}", "agent-designer.html");
        app.MapStaticPage("/ai-agent/{agentId}", "agent-run.html");
        app.MapStaticPage("/knowledge", "knowledge.html");
        app.MapStaticPage("/workspace", "workflow-run.html");
        app.MapStaticPage("/studio", "studio.html");
        return app;
    }

    private static void MapStaticPage(this WebApplication app, string route, string fileName)
    {
        app.MapGet(route, (IWebHostEnvironment environment) =>
        {
            var webRoot = environment.WebRootPath ?? Path.Combine(environment.ContentRootPath, "wwwroot");
            return Results.File(Path.Combine(webRoot, fileName), "text/html; charset=utf-8");
        });
    }
}
