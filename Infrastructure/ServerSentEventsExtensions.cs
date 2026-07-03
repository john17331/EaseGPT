using System.Text.Json;

namespace EaseGPT.Infrastructure;

public static class ServerSentEventsExtensions
{
    public static void PrepareServerSentEvents(this HttpResponse response)
    {
        response.ContentType = "text/event-stream; charset=utf-8";
        response.Headers.CacheControl = "no-cache";
        response.Headers.Connection = "keep-alive";
    }

    public static async Task WriteServerSentEventAsync<T>(
        this HttpResponse response,
        string eventType,
        T data,
        CancellationToken cancellationToken)
    {
        await response.WriteAsync($"event: {eventType}\n", cancellationToken);
        await response.WriteAsync(
            $"data: {JsonSerializer.Serialize(data, JsonSerializerOptions.Web)}\n\n",
            cancellationToken);
        await response.Body.FlushAsync(cancellationToken);
    }
}
