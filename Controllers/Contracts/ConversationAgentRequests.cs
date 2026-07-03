namespace EaseGPT.Controllers;

public sealed class CreateConversationAgentDto
{
    public required string Name { get; init; }

    public string? Description { get; init; }

    public string? Icon { get; init; }
}
