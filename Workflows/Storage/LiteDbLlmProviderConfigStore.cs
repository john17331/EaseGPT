using EaseGPT.Workflows.Nodes.Llm;
using LiteDB;

namespace EaseGPT.Workflows.Storage;

public sealed class LiteDbLlmProviderConfigStore : ILlmProviderConfigStore
{
    private readonly ILiteCollection<LlmProviderConfig> _configs;

    public LiteDbLlmProviderConfigStore(LiteDbContext context)
    {
        _configs = context.Database.GetCollection<LlmProviderConfig>("llm_provider_configs");
        _configs.EnsureIndex(config => config.Id, unique: true);
    }

    public Task<IReadOnlyCollection<LlmProviderConfig>> ListAsync(CancellationToken cancellationToken)
    {
        var configs = _configs
            .FindAll()
            .OrderBy(config => config.Name)
            .ToList();

        return Task.FromResult<IReadOnlyCollection<LlmProviderConfig>>(configs);
    }

    public Task<LlmProviderConfig?> GetAsync(string id, CancellationToken cancellationToken)
    {
        LlmProviderConfig? config = _configs.FindById(id);
        return Task.FromResult<LlmProviderConfig?>(config);
    }

    public Task SaveAsync(LlmProviderConfig config, CancellationToken cancellationToken)
    {
        config.UpdatedAt = DateTimeOffset.UtcNow;
        _configs.Upsert(config);
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string id, CancellationToken cancellationToken)
    {
        _configs.Delete(id);
        return Task.CompletedTask;
    }
}
