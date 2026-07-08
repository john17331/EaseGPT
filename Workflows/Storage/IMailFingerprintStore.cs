namespace EaseGPT.Workflows.Storage;

public interface IMailFingerprintStore
{
    Task<bool> ExistsAsync(string scopeKey, string fingerprint, CancellationToken cancellationToken);

    Task RememberAsync(
        string scopeKey,
        string fingerprint,
        string? messageId,
        string? subject,
        DateTimeOffset seenAt,
        CancellationToken cancellationToken);
}
