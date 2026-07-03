namespace EaseGPT.Workflows.Nodes.Llm;

public interface ILlmChatProvider
{
    string Name { get; }

    Task<LlmChatResponse> ChatAsync(LlmChatRequest request, CancellationToken cancellationToken);

    Task<LlmChatResponse> ChatStreamAsync(
        LlmChatRequest request,
        Func<LlmChatStreamDelta, ValueTask> onDeltaAsync,
        CancellationToken cancellationToken);
}
