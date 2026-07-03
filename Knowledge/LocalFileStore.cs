using System.Security.Cryptography;
using Microsoft.Extensions.Options;

namespace EaseGPT.Knowledge;

public sealed class LocalFileStore
{
    private readonly string _root;

    public LocalFileStore(IOptions<RagOptions> options, IWebHostEnvironment environment)
    {
        var configuredPath = options.Value.StoragePath;
        _root = Path.GetFullPath(Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(environment.ContentRootPath, configuredPath));
        Directory.CreateDirectory(_root);
    }

    public async Task<(string Path, string Sha256, long Size)> SaveAsync(string knowledgeBaseId, string documentId, IFormFile file, CancellationToken ct)
    {
        var safeName = Path.GetFileName(file.FileName);
        var directory = Path.Combine(_root, knowledgeBaseId, documentId);
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, safeName);
        await using var source = file.OpenReadStream();
        await using var target = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true);
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        var buffer = new byte[81920];
        long size = 0;
        int read;
        while ((read = await source.ReadAsync(buffer, ct)) > 0)
        {
            await target.WriteAsync(buffer.AsMemory(0, read), ct);
            hash.AppendData(buffer, 0, read);
            size += read;
        }
        return (path, Convert.ToHexString(hash.GetHashAndReset()).ToLowerInvariant(), size);
    }

    public void Delete(KnowledgeDocument document)
    {
        if (File.Exists(document.StoragePath)) File.Delete(document.StoragePath);
        var directory = Path.GetDirectoryName(document.StoragePath);
        if (directory is not null && Directory.Exists(directory) && !Directory.EnumerateFileSystemEntries(directory).Any()) Directory.Delete(directory);
    }
}
