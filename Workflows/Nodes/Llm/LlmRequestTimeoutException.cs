namespace EaseGPT.Workflows.Nodes.Llm;

public sealed class LlmRequestTimeoutException : TimeoutException
{
    public LlmRequestTimeoutException(int timeoutSeconds)
        : base($"LLM request timed out after {timeoutSeconds} seconds.")
    {
        TimeoutSeconds = timeoutSeconds;
    }

    public int TimeoutSeconds { get; }
}
