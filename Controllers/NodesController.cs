using EaseGPT.Workflows.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace EaseGPT.Controllers;

[ApiController]
[Route("api/nodes")]
public sealed class NodesController : ControllerBase
{
    private readonly IWorkflowNodeRegistry _nodeRegistry;

    public NodesController(IWorkflowNodeRegistry nodeRegistry)
    {
        _nodeRegistry = nodeRegistry;
    }

    [HttpGet]
    public ActionResult<IReadOnlyCollection<WorkflowNodeDescriptor>> List()
        => Ok(_nodeRegistry.List());
}

