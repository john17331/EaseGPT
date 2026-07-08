using EaseGPT.ConversationAgents;
using EaseGPT.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace EaseGPT.Controllers;

[ApiController]
[Route("api/conversation-agents")]
public sealed class ConversationAgentsController : ControllerBase
{
    private readonly IConversationAgentStore _store;
    private readonly ConversationAgentPreviewService _previewService;
    private readonly IConversationAgentExecutionLog _executionLog;

    public ConversationAgentsController(
        IConversationAgentStore store,
        ConversationAgentPreviewService previewService,
        IConversationAgentExecutionLog executionLog)
    {
        _store = store;
        _previewService = previewService;
        _executionLog = executionLog;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<ConversationAgentDefinition>>> List(CancellationToken cancellationToken)
        => Ok(await _store.ListAsync(cancellationToken));

    [HttpGet("{id}")]
    public async Task<ActionResult<ConversationAgentDefinition>> Get(string id, CancellationToken cancellationToken)
    {
        var agent = await _store.GetAsync(id, cancellationToken);
        return agent is null ? NotFound() : Ok(agent);
    }

    [HttpPost]
    public async Task<ActionResult<ConversationAgentDefinition>> Create(
        CreateConversationAgentDto request,
        CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest("Agent name is required.");
        }

        string id;
        do
        {
            id = $"agent-{Guid.NewGuid():N}"[..18];
        }
        while (await _store.GetAsync(id, cancellationToken) is not null);

        var agent = new ConversationAgentDefinition
        {
            Id = id,
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? null : request.Icon.Trim()
        };

        await _store.SaveAsync(agent, cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = agent.Id }, agent);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ConversationAgentDefinition>> Save(
        string id,
        ConversationAgentDefinition agent,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(id, agent.Id, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Route id must match agent id.");
        }

        await _store.SaveAsync(agent, cancellationToken);
        return Ok(agent);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        if (await _store.GetAsync(id, cancellationToken) is null)
        {
            return NotFound();
        }

        await _store.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpGet("{id}/executions")]
    public async Task<ActionResult<IReadOnlyCollection<ConversationAgentExecutionRecord>>> ListExecutions(
        string id,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? keyword,
        CancellationToken cancellationToken)
    {
        if (await _store.GetAsync(id, cancellationToken) is null)
        {
            return NotFound();
        }

        return Ok(await _executionLog.ListAsync(id, from, to, keyword, cancellationToken));
    }

    [HttpPost("{id}/preview")]
    public async Task<ActionResult<ConversationAgentPreviewResponse>> Preview(
        string id,
        ConversationAgentPreviewRequest request,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(id, request.Agent.Id, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest("Route id must match agent id.");
        }

        try
        {
            return Ok(await _previewService.PreviewAsync(
                request.Agent,
                request.Message,
                request.History,
                cancellationToken));
        }
        catch (ArgumentException error)
        {
            return BadRequest(error.Message);
        }
        catch (InvalidOperationException error)
        {
            return BadRequest(error.Message);
        }
        catch (KeyNotFoundException error)
        {
            return NotFound(error.Message);
        }
    }

    [HttpPost("{id}/preview/stream")]
    public async Task PreviewStream(
        string id,
        ConversationAgentPreviewRequest request,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(id, request.Agent.Id, StringComparison.OrdinalIgnoreCase))
        {
            Response.StatusCode = StatusCodes.Status400BadRequest;
            await Response.WriteAsync("Route id must match agent id.", cancellationToken);
            return;
        }

        Response.PrepareServerSentEvents();

        try
        {
            await _previewService.PreviewStreamAsync(
                request.Agent,
                request.Message,
                request.History,
                streamEvent => WriteStreamEventAsync(streamEvent, cancellationToken),
                cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
        }
        catch (ArgumentException error)
        {
            await WriteStreamEventAsync(CreateErrorEvent(error.Message), cancellationToken);
        }
        catch (InvalidOperationException error)
        {
            await WriteStreamEventAsync(CreateErrorEvent(error.Message), cancellationToken);
        }
        catch (KeyNotFoundException error)
        {
            await WriteStreamEventAsync(CreateErrorEvent(error.Message), cancellationToken);
        }
    }

    private async Task WriteStreamEventAsync(ConversationAgentPreviewStreamEvent streamEvent, CancellationToken cancellationToken)
        => await Response.WriteServerSentEventAsync(
            streamEvent.Type,
            streamEvent,
            cancellationToken);

    private static ConversationAgentPreviewStreamEvent CreateErrorEvent(string message)
        => new(
            "preview.error",
            0,
            Array.Empty<ConversationAgentPreviewStep>(),
            null,
            message,
            null);
}
