using EaseGPT.ConversationAgents;
using EaseGPT.Infrastructure;
using EaseGPT.Knowledge;
using EaseGPT.Workflows;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseDefaultServiceProvider(options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;
});

builder.Services.AddControllers();
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
