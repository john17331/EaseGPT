using LiteDB;

namespace EaseGPT.Workflows.Storage;

public sealed class LiteDbMailFingerprintStore : IMailFingerprintStore
{
    private readonly ILiteCollection<MailFingerprintDocument> _fingerprints;

    public LiteDbMailFingerprintStore(LiteDbContext context)
    {
        _fingerprints = context.Database.GetCollection<MailFingerprintDocument>("mail_fingerprints");
        _fingerprints.EnsureIndex(item => item.Id, unique: true);
        _fingerprints.EnsureIndex(item => item.ScopeKey);
        _fingerprints.EnsureIndex(item => item.LastSeenAt);
    }

    public Task<bool> ExistsAsync(string scopeKey, string fingerprint, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(_fingerprints.Exists(item => item.Id == BuildId(scopeKey, fingerprint)));
    }

    public Task RememberAsync(
        string scopeKey,
        string fingerprint,
        string? messageId,
        string? subject,
        DateTimeOffset seenAt,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var id = BuildId(scopeKey, fingerprint);
        var existing = _fingerprints.FindById(id);

        _fingerprints.Upsert(new MailFingerprintDocument
        {
            Id = id,
            ScopeKey = scopeKey,
            Fingerprint = fingerprint,
            MessageId = messageId ?? string.Empty,
            Subject = subject ?? string.Empty,
            FirstSeenAt = existing?.FirstSeenAt ?? seenAt,
            LastSeenAt = seenAt
        });

        return Task.CompletedTask;
    }

    private static string BuildId(string scopeKey, string fingerprint)
        => $"{scopeKey}::{fingerprint}";
}

public sealed class MailFingerprintDocument
{
    [BsonId]
    public required string Id { get; init; }

    public required string ScopeKey { get; init; }

    public required string Fingerprint { get; init; }

    public string MessageId { get; init; } = string.Empty;

    public string Subject { get; init; } = string.Empty;

    public DateTimeOffset FirstSeenAt { get; init; }

    public DateTimeOffset LastSeenAt { get; init; }
}
