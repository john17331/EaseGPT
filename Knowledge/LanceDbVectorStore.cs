using Apache.Arrow;
using Apache.Arrow.Types;
using lancedb;
using Microsoft.Extensions.Options;

namespace EaseGPT.Knowledge;

public sealed class LanceDbVectorStore : IKnowledgeVectorStore, IAsyncDisposable
{
    private const string TablePrefix = "knowledge_chunks_";
    private readonly string _path;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private Connection? _connection;

    public LanceDbVectorStore(IOptions<RagOptions> options, IWebHostEnvironment environment)
    {
        var configuredPath = options.Value.LanceDbPath;
        _path = Path.GetFullPath(Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(environment.ContentRootPath, configuredPath));
        Directory.CreateDirectory(_path);
    }

    public async Task UpsertAsync(IReadOnlyList<KnowledgeChunk> chunks, IReadOnlyList<float[]> vectors, CancellationToken ct)
    {
        if (chunks.Count == 0) return;
        if (chunks.Count != vectors.Count) throw new ArgumentException("分段与向量数量不一致。");

        var vectorLength = vectors[0].Length;
        if (vectors.Any(item => item.Length != vectorLength))
        {
            throw new InvalidOperationException("向量维度不一致。");
        }

        await _gate.WaitAsync(ct);
        try
        {
            var connection = await GetConnectionAsync();
            var tableName = ResolveTableName(chunks[0].KnowledgeBaseId, vectorLength);
            var names = await connection.TableNames();
            var batch = BuildBatch(chunks, vectors, vectorLength);
            using var table = names.Contains(tableName, StringComparer.Ordinal)
                ? await connection.OpenTable(tableName)
                : await connection.CreateTable(tableName, batch);
            if (names.Contains(tableName, StringComparer.Ordinal))
            {
                await table.Delete($"document_id = '{Escape(chunks[0].DocumentId)}'");
                await table.Add(batch);
            }
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task DeleteDocumentAsync(string documentId, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var connection = await GetConnectionAsync();
            foreach (var tableName in await connection.TableNames())
            {
                if (!tableName.StartsWith(TablePrefix, StringComparison.Ordinal)) continue;
                using var table = await connection.OpenTable(tableName);
                await table.Delete($"document_id = '{Escape(documentId)}'");
            }
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IReadOnlyList<(string ChunkId, double Score)>> SearchAsync(string knowledgeBaseId, float[] vector, int limit, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var connection = await GetConnectionAsync();
            var tableName = ResolveTableName(knowledgeBaseId, vector.Length);
            if (!(await connection.TableNames()).Contains(tableName, StringComparer.Ordinal)) return [];

            using var table = await connection.OpenTable(tableName);
            using var query = table.Query().NearestTo(vector.Select(x => (double)x).ToArray())
                .DistanceType(DistanceType.Cosine)
                .Where($"knowledge_base_id = '{Escape(knowledgeBaseId)}'")
                .Select(new[] { "chunk_id" })
                .Limit(Math.Clamp(limit, 1, 100));
            var rows = await query.ToList();
            return rows.Select(row =>
                {
                    var distance = row.TryGetValue("_distance", out var value) ? Convert.ToDouble(value) : 1d;
                    return (Convert.ToString(row["chunk_id"]) ?? string.Empty, Math.Clamp(1d - distance, 0d, 1d));
                })
                .Where(x => x.Item1.Length > 0)
                .GroupBy(x => x.Item1, StringComparer.Ordinal)
                .Select(group => (group.Key, group.Max(item => item.Item2)))
                .OrderByDescending(item => item.Item2)
                .Take(Math.Clamp(limit, 1, 100))
                .ToList();
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<Connection> GetConnectionAsync()
    {
        if (_connection is not null) return _connection;
        _connection = new Connection();
        await _connection.Connect(_path);
        return _connection;
    }

    private static string ResolveTableName(string knowledgeBaseId, int vectorLength)
        => $"{TablePrefix}{Slugify(knowledgeBaseId)}_{vectorLength}";

    private static string Slugify(string value)
    {
        var builder = new System.Text.StringBuilder(value.Length);
        foreach (var character in value.ToLowerInvariant())
        {
            builder.Append(char.IsLetterOrDigit(character) ? character : '_');
        }
        return builder.ToString().Trim('_');
    }

    private static RecordBatch BuildBatch(IReadOnlyList<KnowledgeChunk> chunks, IReadOnlyList<float[]> vectors, int vectorLength)
    {
        var chunkIds = new StringArray.Builder();
        var baseIds = new StringArray.Builder();
        var documentIds = new StringArray.Builder();
        var fileNames = new StringArray.Builder();
        var indices = new Int32Array.Builder();
        var texts = new StringArray.Builder();
        var itemField = new Field("item", FloatType.Default, false);
        var vectorBuilder = new FixedSizeListArray.Builder(itemField, vectorLength);
        var values = (FloatArray.Builder)vectorBuilder.ValueBuilder;

        for (var i = 0; i < chunks.Count; i++)
        {
            chunkIds.Append(chunks[i].Id);
            baseIds.Append(chunks[i].KnowledgeBaseId);
            documentIds.Append(chunks[i].DocumentId);
            fileNames.Append(chunks[i].FileName);
            indices.Append(chunks[i].Index);
            texts.Append(chunks[i].Text);
            vectorBuilder.Append();
            foreach (var value in vectors[i]) values.Append(value);
        }

        var vectorType = new FixedSizeListType(itemField, vectorLength);
        var schema = new Schema.Builder()
            .Field(new Field("chunk_id", StringType.Default, false))
            .Field(new Field("knowledge_base_id", StringType.Default, false))
            .Field(new Field("document_id", StringType.Default, false))
            .Field(new Field("file_name", StringType.Default, false))
            .Field(new Field("chunk_index", Int32Type.Default, false))
            .Field(new Field("text", StringType.Default, false))
            .Field(new Field("vector", vectorType, false))
            .Build();

        return new RecordBatch(
            schema,
            [chunkIds.Build(), baseIds.Build(), documentIds.Build(), fileNames.Build(), indices.Build(), texts.Build(), vectorBuilder.Build()],
            chunks.Count);
    }

    private static string Escape(string value) => value.Replace("'", "''", StringComparison.Ordinal);

    public ValueTask DisposeAsync()
    {
        _connection?.Dispose();
        _gate.Dispose();
        return ValueTask.CompletedTask;
    }
}
