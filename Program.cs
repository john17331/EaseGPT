using EaseGPT.ConversationAgents;
using EaseGPT.Infrastructure;
using EaseGPT.Knowledge;
using EaseGPT.Workflows;
using System.Text.Encodings.Web;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

builder.Host.UseDefaultServiceProvider(options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;
});

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddWorkflowEngine();
builder.Services.AddConversationAgents();
builder.Services.AddRagKnowledgeBase(builder.Configuration);
builder.Services.AddSwaggerGen();

var app = builder.Build();

// 开发环境Swagger
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();
app.MapEaseGptPages();

app.Run();
