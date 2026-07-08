namespace EaseGPT.Workflows.Nodes.Llm;

public sealed class LlmChatProviderRegistry
{
    private readonly IReadOnlyDictionary<string, ILlmChatProvider> _providers;
    private readonly IReadOnlyDictionary<string, LlmProviderPreset> _presets;

    public LlmChatProviderRegistry(IEnumerable<ILlmChatProvider> providers)
    {
        _providers = providers.ToDictionary(provider => provider.Name, StringComparer.OrdinalIgnoreCase);
        _presets = new[]
        {
            new LlmProviderPreset("openai", "openai-compatible", "https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY"),
            new LlmProviderPreset("qwen", "openai-compatible", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", "DASHSCOPE_API_KEY"),
            new LlmProviderPreset("doubao", "openai-compatible", "https://ark.cn-beijing.volces.com/api/v3/chat/completions", "ARK_API_KEY"),
            new LlmProviderPreset("hunyuan", "openai-compatible", "https://api.hunyuan.cloud.tencent.com/v1/chat/completions", "HUNYUAN_API_KEY"),
            new LlmProviderPreset("zhipu", "openai-compatible", "https://open.bigmodel.cn/api/paas/v4/chat/completions", "ZHIPUAI_API_KEY"),
            new LlmProviderPreset("gemini", "openai-compatible", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "GEMINI_API_KEY"),
            new LlmProviderPreset("vllm", "openai-compatible", "http://localhost:8000/v1/chat/completions", "VLLM_API_KEY"),
            new LlmProviderPreset("custom-openai-compatible", "openai-compatible", "https://api.openai.com/v1/chat/completions", "LLM_API_KEY")
        }.ToDictionary(preset => preset.Provider, StringComparer.OrdinalIgnoreCase);
    }

    public ILlmChatProvider GetProvider(LlmProviderPreset preset)
    {
        return _providers.TryGetValue(preset.Adapter, out var provider)
            ? provider
            : throw new InvalidOperationException($"LLM adapter '{preset.Adapter}' is not registered.");
    }

    public LlmProviderPreset GetPreset(string provider)
    {
        return _presets.TryGetValue(provider, out var preset)
            ? preset
            : _presets["custom-openai-compatible"];
    }
}
