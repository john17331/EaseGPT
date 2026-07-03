using EaseGPT.Workflows.Nodes.Llm;
using LiteDB;

namespace EaseGPT.Workflows.Storage;

public sealed class LiteDbLlmProviderDefinitionStore : ILlmProviderDefinitionStore
{
    private readonly ILiteCollection<LlmProviderDefinition> _providers;

    public LiteDbLlmProviderDefinitionStore(LiteDbContext context)
    {
        _providers = context.Database.GetCollection<LlmProviderDefinition>("llm_providers");
        _providers.EnsureIndex(provider => provider.Id, unique: true);
        SeedDefaults();
    }

    public Task<IReadOnlyCollection<LlmProviderDefinition>> ListAsync(CancellationToken cancellationToken)
    {
        var providers = _providers.FindAll().OrderBy(provider => provider.Name).ToList();
        return Task.FromResult<IReadOnlyCollection<LlmProviderDefinition>>(providers);
    }

    public Task<LlmProviderDefinition?> GetAsync(string id, CancellationToken cancellationToken)
        => Task.FromResult<LlmProviderDefinition?>(_providers.FindById(id));

    public Task SaveAsync(LlmProviderDefinition provider, CancellationToken cancellationToken)
    {
        provider.UpdatedAt = DateTimeOffset.UtcNow;
        _providers.Upsert(provider);
        return Task.CompletedTask;
    }

    private void SeedDefaults()
    {
        InsertDefault(new LlmProviderDefinition
        {
            Id = "openai",
            Name = "OpenAI",
            Description = "OpenAI 提供的 GPT 系列模型。",
            ApiAddress = "https://api.openai.com/v1",
            Enabled = true
        });
        InsertDefault(new LlmProviderDefinition
        {
            Id = "deepseek",
            Name = "DeepSeek",
            Description = "DeepSeek 提供的模型服务。",
            ApiAddress = "https://api.deepseek.com/v1",
            Enabled = true
        });
        InsertDefault(new LlmProviderDefinition
        {
            Id = "qwen",
            Name = "通义千问",
            Description = "阿里云百炼提供的通义千问系列模型。",
            ApiAddress = "https://dashscope.aliyuncs.com/compatible-mode/v1",
            Enabled = true
        });
        InsertDefault(new LlmProviderDefinition
        {
            Id = "doubao",
            Name = "豆包",
            Description = "火山方舟提供的豆包系列模型。",
            ApiAddress = "https://ark.cn-beijing.volces.com/api/v3",
            Enabled = true
        });
        InsertDefault(new LlmProviderDefinition
        {
            Id = "ollama",
            Name = "Ollama",
            Description = "连接本机或局域网中的 OpenAI 兼容 Ollama 服务。",
            ApiAddress = "http://localhost:11434/v1",
            Enabled = true
        });
    }

    private void InsertDefault(LlmProviderDefinition provider)
    {
        if (_providers.FindById(provider.Id) is null)
        {
            _providers.Insert(provider);
        }
    }
}
