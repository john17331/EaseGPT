namespace EaseGPT.Workflows.Nodes.Llm;

public interface ILlmProviderDefinitionStore
{
    Task<IReadOnlyCollection<LlmProviderDefinition>> ListAsync(CancellationToken cancellationToken);

    Task<LlmProviderDefinition?> GetAsync(string id, CancellationToken cancellationToken);

    Task SaveAsync(LlmProviderDefinition provider, CancellationToken cancellationToken);
}
