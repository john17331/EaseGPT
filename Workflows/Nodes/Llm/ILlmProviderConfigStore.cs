namespace EaseGPT.Workflows.Nodes.Llm;

public interface ILlmProviderConfigStore
{
    Task<IReadOnlyCollection<LlmProviderConfig>> ListAsync(CancellationToken cancellationToken);

    Task<LlmProviderConfig?> GetAsync(string id, CancellationToken cancellationToken);

    Task SaveAsync(LlmProviderConfig config, CancellationToken cancellationToken);

    Task DeleteAsync(string id, CancellationToken cancellationToken);
}
