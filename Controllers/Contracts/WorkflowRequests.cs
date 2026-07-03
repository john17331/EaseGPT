namespace EaseGPT.Controllers;

public sealed class ExecuteWorkflowDto
{
    public string? TriggerNodeId { get; set; }

    public Dictionary<string, object?>? Input { get; set; }
}

public sealed class UpdateWorkflowMetadataDto
{
    public required string Name { get; init; }

    public string? Description { get; init; }

    public string? Icon { get; init; }
}

public sealed class CreateWorkflowDto
{
    public required string Name { get; init; }

    public string? Description { get; init; }

    public string? Icon { get; init; }
}
