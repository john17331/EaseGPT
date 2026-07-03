using LiteDB;

namespace EaseGPT.Workflows.Storage;

/// <summary>
/// LiteDB 数据库上下文。数据库文件路径可通过 appsettings.json 的 LiteDb:DatabasePath 配置。
/// </summary>
public sealed class LiteDbContext : IDisposable
{
    public LiteDbContext(
        IConfiguration configuration,
        IWebHostEnvironment environment,
        ILogger<LiteDbContext> logger)
    {
        var configuredPath = configuration["LiteDb:DatabasePath"] ?? "Data/easegpt.db";
        var databasePath = Path.IsPathRooted(configuredPath)
            ? configuredPath
            : Path.Combine(environment.ContentRootPath, configuredPath);

        var directory = Path.GetDirectoryName(databasePath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        DatabasePath = Path.GetFullPath(databasePath);
        logger.LogInformation("Using LiteDB database at {DatabasePath}", DatabasePath);
        Database = new LiteDatabase(DatabasePath);
    }

    public string DatabasePath { get; }

    public LiteDatabase Database { get; }

    public void Dispose()
    {
        Database.Dispose();
    }
}
