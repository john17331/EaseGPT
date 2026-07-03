using System.Data.Common;
using System.Globalization;
using EaseGPT.Workflows.Execution;
using Microsoft.Data.SqlClient;
using MySqlConnector;
using Npgsql;

namespace EaseGPT.Workflows.Nodes;

public sealed class DatabaseNode : IWorkflowNode
{
    public string Type => "integration.database";

    public string DisplayName => "Database";

    public string Description => "连接 SQL Server、MySQL 或 PostgreSQL，并执行参数化 SQL。";

    public async Task<NodeExecutionResult> ExecuteAsync(NodeExecutionContext context)
    {
        var provider = context.GetString("provider") ?? "sqlserver";
        var host = context.GetString("host") ?? throw new InvalidOperationException("Database 节点必须配置数据库地址。");
        var port = context.GetInt32("port") ?? GetDefaultPort(provider);
        var database = context.GetString("database") ?? throw new InvalidOperationException("Database 节点必须配置数据库名称。");
        var username = context.GetString("username") ?? throw new InvalidOperationException("Database 节点必须配置用户名。");
        var password = context.GetString("password") ?? string.Empty;
        var useSsl = context.GetBoolean("useSsl") ?? false;
        var timeoutSeconds = Math.Clamp(context.GetInt32("timeoutSeconds") ?? 30, 1, 300);
        var mode = context.GetString("mode") ?? "query";
        var sqlTemplate = context.GetString("sql") ?? throw new InvalidOperationException("Database 节点必须配置 SQL。");
        var sql = TemplateRenderer.Render(sqlTemplate, context.Input, context.Variables);
        var parameters = context.GetSetting<List<DatabaseParameterDefinition>>("parameters") ?? [];

        await using var connection = CreateConnection(provider, host, port, database, username, password, useSsl);
        using var timeoutSource = CancellationTokenSource.CreateLinkedTokenSource(context.CancellationToken);
        timeoutSource.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
        await connection.OpenAsync(timeoutSource.Token);

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = timeoutSeconds;
        AddParameters(command, parameters, context);

        var output = new Dictionary<string, object?>(context.Input);
        if (mode.Equals("execute", StringComparison.OrdinalIgnoreCase))
        {
            output["affectedRows"] = await command.ExecuteNonQueryAsync(timeoutSource.Token);
        }
        else
        {
            output["databaseRows"] = await ReadRowsAsync(command, timeoutSource.Token);
        }

        return NodeExecutionResult.Continue(output);
    }

    private static DbConnection CreateConnection(
        string provider,
        string host,
        int port,
        string database,
        string username,
        string password,
        bool useSsl)
        => provider.ToLowerInvariant() switch
        {
            "mysql" => new MySqlConnection(new MySqlConnectionStringBuilder
            {
                Server = host,
                Port = (uint)port,
                Database = database,
                UserID = username,
                Password = password,
                SslMode = useSsl ? MySqlSslMode.Required : MySqlSslMode.Disabled
            }.ConnectionString),
            "postgresql" => new NpgsqlConnection(new NpgsqlConnectionStringBuilder
            {
                Host = host,
                Port = port,
                Database = database,
                Username = username,
                Password = password,
                SslMode = useSsl ? SslMode.Require : SslMode.Disable
            }.ConnectionString),
            "sqlserver" => new SqlConnection(new SqlConnectionStringBuilder
            {
                DataSource = $"{host},{port}",
                InitialCatalog = database,
                UserID = username,
                Password = password,
                Encrypt = useSsl,
                TrustServerCertificate = !useSsl
            }.ConnectionString),
            _ => throw new InvalidOperationException($"不支持数据库类型 '{provider}'。")
        };

    private static int GetDefaultPort(string provider)
        => provider.ToLowerInvariant() switch
        {
            "mysql" => 3306,
            "postgresql" => 5432,
            _ => 1433
        };

    private static void AddParameters(
        DbCommand command,
        IReadOnlyCollection<DatabaseParameterDefinition> parameters,
        NodeExecutionContext context)
    {
        foreach (var definition in parameters.Where(item => !string.IsNullOrWhiteSpace(item.Name)))
        {
            var parameter = command.CreateParameter();
            parameter.ParameterName = definition.Name.StartsWith('@') ? definition.Name : $"@{definition.Name}";
            var renderedValue = TemplateRenderer.Render(definition.Value, context.Input, context.Variables);
            parameter.Value = ConvertParameterValue(renderedValue, definition.Type);
            command.Parameters.Add(parameter);
        }
    }

    private static object ConvertParameterValue(string value, string type)
        => type.ToLowerInvariant() switch
        {
            "integer" => long.Parse(value, CultureInfo.InvariantCulture),
            "number" => decimal.Parse(value, CultureInfo.InvariantCulture),
            "boolean" => bool.Parse(value),
            "datetime" => DateTime.Parse(value, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind),
            "null" => DBNull.Value,
            _ => value
        };

    private static async Task<List<Dictionary<string, object?>>> ReadRowsAsync(
        DbCommand command,
        CancellationToken cancellationToken)
    {
        var rows = new List<Dictionary<string, object?>>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var index = 0; index < reader.FieldCount; index++)
            {
                row[reader.GetName(index)] = await reader.IsDBNullAsync(index, cancellationToken)
                    ? null
                    : reader.GetValue(index);
            }
            rows.Add(row);
        }
        return rows;
    }
}

public sealed class DatabaseParameterDefinition
{
    public string Name { get; init; } = string.Empty;

    public string Value { get; init; } = string.Empty;

    public string Type { get; init; } = "string";
}
