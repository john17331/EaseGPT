const workflowId = getRouteWorkflowId();
const isPortalRun = location.pathname.split("/").filter(Boolean)[0] === "ai";

const state = {
    workflow: null,
    providerConfigs: [],
    selectedFiles: [],
    liveNodes: new Map(),
    isExecuting: false,
    executionId: null,
    stopRequested: false,
    layout: "side"
};

const workflowRunShell = document.getElementById("workflowRunShell");
const workflowIcon = document.getElementById("workflowIcon");
const workflowName = document.getElementById("workflowName");
const workflowDescription = document.getElementById("workflowDescription");
const manualInputSection = document.getElementById("manualInputSection");
const manualInputFields = document.getElementById("manualInputFields");
const defaultInputSection = document.getElementById("defaultInputSection");
const questionInput = document.getElementById("questionInput");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const attachmentButton = document.getElementById("attachmentButton");
const defaultComposerAction = document.getElementById("defaultComposerAction");
const defaultInputStatus = document.getElementById("defaultInputStatus");
const executeButton = document.getElementById("executeButton");
const workflowRunResultPanel = document.getElementById("workflowRunResultPanel");
const resultBackdrop = document.getElementById("resultBackdrop");
const resultPanel = document.getElementById("resultPanel");
const workflowRunBrand = document.getElementById("workflowRunBrand");
const workflowRunBrandMessage = document.getElementById("workflowRunBrandMessage");
const resultList = document.getElementById("resultList");
const resultTitle = document.getElementById("resultTitle");
const executionSummary = document.getElementById("executionSummary");
const layoutMenuButton = document.getElementById("layoutMenuButton");
const layoutMenu = document.getElementById("layoutMenu");

fileInput.addEventListener("change", onFilesChanged);
attachmentButton.addEventListener("click", () => fileInput.click());
executeButton.addEventListener("click", executeWorkflow);
resultBackdrop.addEventListener("click", clearResults);
resultList.addEventListener("click", handleResultAction);
layoutMenuButton.addEventListener("click", toggleLayoutMenu);
layoutMenu.addEventListener("click", handleLayoutSelection);
document.addEventListener("click", closeLayoutMenuFromOutside);
document.addEventListener("keydown", handlePageKeydown);

initializeRunMode();
initializeLayout();
loadWorkflow();

function initializeRunMode() {
    if (!isPortalRun) return;
    document.title = "EaseGPT 工作流运行";
    executeButton.textContent = "运行";
    resultTitle.textContent = "运行结果";
    executionSummary.hidden = true;
    workflowRunBrandMessage.textContent = "你的 AI，准备好了。「运行」，即可开始体验。";
}

function initializeLayout() {
    const savedLayout = localStorage.getItem("workflow-run-layout");
    applyLayout(["side", "top", "center"].includes(savedLayout) ? savedLayout : "side", false);
}

function toggleLayoutMenu(event) {
    event.stopPropagation();
    const willOpen = layoutMenu.hidden;
    layoutMenu.hidden = !willOpen;
    layoutMenuButton.setAttribute("aria-expanded", String(willOpen));
}

function handleLayoutSelection(event) {
    const option = event.target.closest("[data-layout-value]");
    if (!option) return;
    applyLayout(option.dataset.layoutValue);
    closeLayoutMenu();
}

function applyLayout(layout, persist = true) {
    state.layout = layout;
    workflowRunShell.dataset.layout = layout;
    for (const option of layoutMenu.querySelectorAll("[data-layout-value]")) {
        option.setAttribute("aria-checked", String(option.dataset.layoutValue === layout));
    }
    workflowRunResultPanel.classList.toggle(
        "is-visible",
        layout === "center" && !resultPanel.hidden
    );
    if (persist) localStorage.setItem("workflow-run-layout", layout);
}

function closeLayoutMenuFromOutside(event) {
    if (!event.target.closest(".workflow-layout-control")) closeLayoutMenu();
}

function handlePageKeydown(event) {
    if (event.key !== "Escape") return;
    if (!layoutMenu.hidden) {
        closeLayoutMenu();
        layoutMenuButton.focus();
        return;
    }
    if (state.layout === "center" && workflowRunResultPanel.classList.contains("is-visible")) {
        clearResults();
    }
}

function closeLayoutMenu() {
    layoutMenu.hidden = true;
    layoutMenuButton.setAttribute("aria-expanded", "false");
}

async function loadWorkflow() {
    if (!workflowId) {
        setStatus("工作流编号缺失");
        executeButton.disabled = true;
        return;
    }

    executeButton.disabled = true;
    setStatus("正在加载工作流...");

    try {
        const [workflowResponse, providerConfigResponse] = await Promise.all([
            fetch(`/api/workflows/${encodeURIComponent(workflowId)}`, { cache: "no-store" }),
            fetch("/api/llm-provider-configs", { cache: "no-store" })
        ]);
        if (!workflowResponse.ok) throw new Error(await workflowResponse.text());

        state.workflow = await workflowResponse.json();
        state.providerConfigs = providerConfigResponse.ok ? await providerConfigResponse.json() : [];
        renderWorkflowInfo();
        renderManualInputFields();
        renderFileList();
        setStatus("准备就绪");
        executeButton.disabled = false;
    } catch (error) {
        workflowName.textContent = "工作流加载失败";
        workflowDescription.textContent = error.message;
        setStatus(`加载失败：${error.message}`);
        executeButton.disabled = true;
    }
}

function renderWorkflowInfo() {
    const workflow = state.workflow;
    workflowName.textContent = workflow?.name || "未命名工作流";
    workflowDescription.textContent = workflow?.description || "暂无工作流描述";
    const icon = workflow?.icon || "/assets/easegpt.svg";
    workflowIcon.innerHTML = isImageIcon(icon)
        ? `<img src="${escapeAttribute(icon)}" alt="">`
        : escapeHtml((workflow?.name || "W").slice(0, 1).toUpperCase());
    workflowIcon.classList.toggle("has-image", isImageIcon(icon));
}

function getManualTriggerNode() {
    const nodes = state.workflow?.nodes ?? [];
    return nodes.find(node => node.type === "trigger.manual")
        ?? nodes.find(node => node.type?.startsWith("trigger."))
        ?? null;
}

function getManualInputFieldDefinitions() {
    const trigger = getManualTriggerNode();
    const fields = trigger?.type === "trigger.manual" ? trigger.settings?.fields : null;
    return normalizeManualInputFields(fields);
}

function normalizeManualInputFields(fields) {
    if (!Array.isArray(fields)) return [];
    return fields
        .map(field => ({
            name: String(field.name ?? "").trim(),
            label: String(field.label || field.name || "").trim(),
            description: String(field.description ?? "").trim(),
            type: String(field.type ?? "text").trim(),
            customType: String(field.customType ?? "").trim(),
            required: Boolean(field.required),
            dateOnly: Boolean(field.dateOnly),
            defaultValue: field.defaultValue ?? "",
            options: Array.isArray(field.options) ? field.options.map(option => String(option)).filter(Boolean) : []
        }))
        .filter(field => field.name);
}

function renderManualInputFields() {
    const fields = getManualInputFieldDefinitions();
    const usesChatInput = fields.length === 0;
    manualInputFields.innerHTML = "";
    manualInputSection.hidden = usesChatInput;
    manualInputFields.hidden = usesChatInput;
    defaultInputSection.hidden = !usesChatInput;
    workflowRunShell.dataset.inputMode = usesChatInput ? "chat" : "form";
    (usesChatInput ? defaultComposerAction : document.querySelector(".workflow-run-fields"))
        .appendChild(executeButton);
    executeButton.textContent = executeButtonIdleLabel();
    if (usesChatInput) {
        defaultInputStatus.textContent = "准备就绪";
        return;
    }

    for (const field of fields) {
        manualInputFields.appendChild(renderManualInputField(field));
    }
}

function renderManualInputField(field) {
    const wrapper = document.createElement("label");
    wrapper.className = "field manual-input-field";
    wrapper.dataset.fieldName = field.name;
    wrapper.dataset.fieldType = field.type;
    const tooltip = field.description ? ` title="${escapeAttribute(field.description)}"` : "";
    wrapper.innerHTML = `
        <span${tooltip}>${escapeHtml(field.label || field.name)}${field.required ? " *" : ""}</span>
    `;
    wrapper.appendChild(createManualInputControl(field));
    return wrapper;
}

function createManualInputControl(field) {
    if (field.type === "radio") return createOptionGroup(field, "radio");
    if (field.type === "checkbox") return createOptionGroup(field, "checkbox");

    if (field.type === "single-checkbox") {
        const label = document.createElement("label");
        label.className = "manual-option";
        label.innerHTML = `
            <input data-manual-input="${escapeHtml(field.name)}" type="checkbox"${parseBoolean(field.defaultValue) ? " checked" : ""}>
            <span>${escapeHtml(field.label || field.name)}</span>
        `;
        return label;
    }

    if (field.type === "select") {
        const select = document.createElement("select");
        select.dataset.manualInput = field.name;
        for (const optionText of field.options) {
            const option = document.createElement("option");
            option.value = optionText;
            option.textContent = optionText;
            select.appendChild(option);
        }
        if (field.defaultValue) select.value = field.defaultValue;
        return select;
    }

    if (field.type === "switch") {
        const label = document.createElement("label");
        label.className = "manual-switch";
        label.innerHTML = `<input data-manual-input="${escapeHtml(field.name)}" type="checkbox"${parseBoolean(field.defaultValue) ? " checked" : ""}><span></span>`;
        return label;
    }

    if (field.type === "paragraph") {
        const textarea = document.createElement("textarea");
        textarea.dataset.manualInput = field.name;
        textarea.rows = 5;
        textarea.value = field.defaultValue ?? "";
        return textarea;
    }

    if (field.type === "daterange") {
        const group = document.createElement("div");
        group.className = "manual-date-range";
        const inputType = field.dateOnly ? "date" : "datetime-local";
        group.innerHTML = `
            <input data-manual-input="${escapeHtml(field.name)}" data-range-part="start" type="${inputType}">
            <input data-manual-input="${escapeHtml(field.name)}" data-range-part="end" type="${inputType}">
        `;
        return group;
    }

    if (field.type === "file") {
        const input = document.createElement("input");
        input.dataset.manualInput = field.name;
        input.type = "file";
        input.multiple = true;
        return input;
    }

    if (field.type === "llm-model") {
        const select = document.createElement("select");
        select.dataset.manualInput = field.name;
        for (const config of state.providerConfigs.filter(item => item.enabled !== false)) {
            const option = document.createElement("option");
            option.value = config.id;
            option.textContent = config.name;
            select.appendChild(option);
        }
        if (field.defaultValue) select.value = field.defaultValue;
        return select;
    }

    const input = document.createElement("input");
    input.dataset.manualInput = field.name;
    input.value = field.defaultValue ?? "";
    input.type = getTextLikeInputType(field);
    return input;
}

function getTextLikeInputType(field) {
    if (field.type === "password") return "password";
    if (field.type === "number") return "number";
    if (field.type === "datetime") return field.dateOnly ? "date" : "datetime-local";
    return "text";
}

function createOptionGroup(field, inputType) {
    const group = document.createElement("div");
    group.className = "manual-option-group";
    const defaults = new Set(String(field.defaultValue ?? "").split(",").map(item => item.trim()).filter(Boolean));
    for (const option of field.options) {
        const label = document.createElement("label");
        label.className = "manual-option";
        label.innerHTML = `
            <input data-manual-input="${escapeHtml(field.name)}" type="${inputType}" name="manual-${escapeHtml(field.name)}" value="${escapeHtml(option)}"${defaults.has(option) ? " checked" : ""}>
            <span>${escapeHtml(option)}</span>
        `;
        group.appendChild(label);
    }
    return group;
}

function onFilesChanged() {
    const selectedKeys = new Set(state.selectedFiles.map(getFileIdentity));
    for (const file of Array.from(fileInput.files ?? [])) {
        const identity = getFileIdentity(file);
        if (selectedKeys.has(identity)) continue;
        selectedKeys.add(identity);
        state.selectedFiles.push(file);
    }
    fileInput.value = "";
    renderFileList();
}

function getFileIdentity(file) {
    return [file.name, file.size, file.type, file.lastModified].join(":");
}

function renderFileList() {
    fileList.innerHTML = "";
    fileList.hidden = state.selectedFiles.length === 0;
    for (const file of state.selectedFiles) {
        const item = document.createElement("span");
        item.className = "workflow-file-chip";
        item.textContent = `${file.name} · ${formatBytes(file.size)}`;
        fileList.appendChild(item);
    }
}

async function executeWorkflow() {
    if (state.isExecuting) {
        await stopExecution();
        return;
    }

    if (!state.workflow) {
        setStatus("请先等待工作流加载完成");
        return;
    }

    state.isExecuting = true;
    state.executionId = null;
    state.stopRequested = false;
    executeButton.disabled = false;
    executeButton.textContent = "停止";
    if (workflowRunShell.dataset.inputMode === "chat") defaultInputStatus.textContent = "正在执行...";
    showResultPanel();
    setStatus("正在读取文件并启动流式执行...");
    startLiveView();

    try {
        const payload = await buildExecutionPayload();
        const response = await fetch(`/api/workflows/${encodeURIComponent(state.workflow.id)}/execute/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok || !response.body) throw new Error(await response.text());
        await EaseGptSse.consume(response.body, handleStreamEvent);
    } catch (error) {
        setStatus("");
        renderError(error);
    } finally {
        state.isExecuting = false;
        state.executionId = null;
        state.stopRequested = false;
        executeButton.disabled = false;
        executeButton.textContent = executeButtonIdleLabel();
        if (workflowRunShell.dataset.inputMode === "chat") defaultInputStatus.textContent = "准备就绪";
    }
}

async function stopExecution() {
    if (!state.executionId || state.stopRequested) {
        setStatus(state.executionId ? "正在终止工作流..." : "工作流正在启动，请稍候再停止");
        return;
    }

    state.stopRequested = true;
    executeButton.disabled = true;
    executeButton.textContent = "终止中...";
    if (workflowRunShell.dataset.inputMode === "chat") defaultInputStatus.textContent = "正在终止...";
    setStatus("正在终止工作流...");

    try {
        const response = await fetch(`/api/workflows/executions/${encodeURIComponent(state.executionId)}/cancel`, {
            method: "POST"
        });
        if (!response.ok && response.status !== 404) throw new Error(await response.text());
    } catch (error) {
        state.stopRequested = false;
        executeButton.disabled = false;
        executeButton.textContent = "停止";
        setStatus(`终止失败：${error.message}`);
    }
}

async function buildExecutionPayload() {
    const hasManualFields = getManualInputFieldDefinitions().length > 0;
    const input = hasManualFields
        ? await collectManualInputValues()
        : { question: questionInput.value.trim() };

    const files = hasManualFields ? [] : await readFiles(state.selectedFiles);

    if (files.length > 0) input.files = files;

    return {
        triggerNodeId: getManualTriggerNode()?.id ?? null,
        input
    };
}

async function collectManualInputValues() {
    const values = {};
    for (const field of getManualInputFieldDefinitions()) {
        const controls = Array.from(manualInputFields.querySelectorAll(`[data-manual-input="${cssEscape(field.name)}"]`));
        const value = await readManualInputValue(field, controls);
        if (field.required && isEmptyManualInput(value)) {
            throw new Error(`请填写必填输入：${field.label || field.name}`);
        }
        values[field.name] = value;
    }
    return values;
}

async function readManualInputValue(field, controls) {
    if (field.type === "checkbox") return controls.filter(input => input.checked).map(input => input.value);
    if (field.type === "radio") return controls.find(input => input.checked)?.value ?? "";
    if (field.type === "switch" || field.type === "single-checkbox") return Boolean(controls[0]?.checked);
    if (field.type === "daterange") {
        return {
            start: controls.find(input => input.dataset.rangePart === "start")?.value ?? "",
            end: controls.find(input => input.dataset.rangePart === "end")?.value ?? ""
        };
    }
    if (field.type === "file") return readFiles(Array.from(controls[0]?.files ?? []));
    if (field.type === "number") {
        const value = controls[0]?.value ?? "";
        return value === "" ? null : Number(value);
    }
    return controls[0]?.value ?? "";
}

function startLiveView() {
    state.liveNodes.clear();
    resultList.innerHTML = "";
    if (isPortalRun) {
        executionSummary.textContent = "正在运行";
        return;
    }
    executionSummary.textContent = `${state.workflow.id} · 正在执行`;

    for (const node of state.workflow.nodes ?? []) {
        const details = document.createElement("details");
        details.className = "node-result";
        details.open = false;
        details.dataset.nodeId = node.id;
        details.innerHTML = `
            <summary>
                <span class="node-title">
                    <strong>${escapeHtml(node.name)}</strong>
                    <span>${escapeHtml(node.id)} · ${escapeHtml(node.type)} · 等待执行</span>
                </span>
                <span class="badge pending">等待</span>
            </summary>
            ${jsonGridHtml({}, {})}
        `;
        resultList.appendChild(details);
        state.liveNodes.set(node.id, details);
    }
}

function handleStreamEvent(streamEvent) {
    switch (streamEvent.type) {
        case "workflow.started":
            state.executionId = streamEvent.executionId;
            executionSummary.textContent = isPortalRun
                ? "正在运行"
                : `${streamEvent.workflowId} · 运行中 · ${streamEvent.executionId}`;
            setStatus("工作流已开始执行");
            break;
        case "node.started":
            if (!isPortalRun) updateLiveNode(streamEvent, "Running");
            setStatus(`正在执行节点：${streamEvent.nodeName}`);
            break;
        case "node.completed":
            if (!isPortalRun) updateLiveNode(streamEvent, "Succeeded");
            setStatus(`节点完成：${streamEvent.nodeName}`);
            break;
        case "node.failed":
            if (!isPortalRun) updateLiveNode(streamEvent, "Failed");
            setStatus(`节点失败：${streamEvent.nodeName}`);
            break;
        case "node.cancelled":
            if (!isPortalRun) updateLiveNode(streamEvent, "Cancelled");
            setStatus(`节点已终止：${streamEvent.nodeName}`);
            break;
        case "node.timed-out":
            if (!isPortalRun) updateLiveNode(streamEvent, "TimedOut");
            setStatus(`节点已超时：${streamEvent.nodeName}`);
            break;
        case "workflow.completed":
            renderCompletedExecution(streamEvent.data);
            setStatus("工作流执行完成");
            break;
        case "workflow.failed":
            renderCompletedExecution(streamEvent.data);
            setStatus(`工作流执行失败：${streamEvent.data?.error ?? ""}`);
            break;
        case "workflow.cancelled":
            renderCompletedExecution(streamEvent.data);
            setStatus("工作流已终止");
            break;
        case "workflow.timed-out":
            renderCompletedExecution(streamEvent.data);
            setStatus(`工作流执行超时：${streamEvent.data?.error ?? ""}`);
            break;
        default:
            break;
    }
}

function updateLiveNode(streamEvent, status) {
    const node = streamEvent.data ?? {};
    const details = state.liveNodes.get(streamEvent.nodeId);
    if (!details) return;

    details.open = status !== "Pending";
    const badge = details.querySelector(".badge");
    const preBlocks = details.querySelectorAll("pre");
    const subtitle = details.querySelector(".node-title span");

    badge.textContent = statusTextFor(status);
    badge.className = `badge ${status.toLowerCase()}`;
    subtitle.textContent = `${streamEvent.nodeId} · ${streamEvent.nodeType} · 输出端口 ${node.outputPort ?? "-"}`;
    if (node.presentation) {
        const grid = details.querySelector(".json-grid");
        if (grid) grid.outerHTML = jsonGridHtml(node.input ?? {}, node.output ?? {}, node.error, node.presentation);
        return;
    }
    if (preBlocks[0]) preBlocks[0].textContent = JSON.stringify(node.input ?? {}, null, 2);
    if (preBlocks[1]) preBlocks[1].textContent = JSON.stringify(node.output ?? {}, null, 2);
}

function renderCompletedExecution(execution) {
    if (isPortalRun) {
        renderFinalExecution(execution);
        return;
    }
    renderExecution(execution);
}

function renderFinalExecution(execution) {
    showResultPanel();
    resultList.innerHTML = "";
    const status = String(execution?.status ?? "").toLowerCase();
    if (status !== "succeeded") {
        const fallbackMessages = {
            failed: "工作流执行失败",
            cancelled: "工作流已终止",
            timedout: "工作流执行超时"
        };
        const failedNode = [...(execution?.nodeExecutions ?? [])].reverse()
            .find(node => node.error);
        renderError(new Error(execution?.error || failedNode?.error || fallbackMessages[status] || "工作流执行失败"));
        return;
    }

    const nodeExecutions = execution?.nodeExecutions ?? [];
    const finalNode = nodeExecutions.at(-1);
    const output = finalNode?.output ?? {};
    resultList.innerHTML = finalOutputHtml(output, finalNode?.presentation);
}

function finalOutputHtml(output, presentation) {
    if (presentation?.type === "table"
        && Array.isArray(presentation.columns)
        && Array.isArray(presentation.rows)
        && presentation.columns.length > 0) {
        return finalTableHtml(presentation);
    }

    const values = output && typeof output === "object" ? Object.values(output) : [];
    if (values.length === 1 && typeof values[0] === "string") {
        return `<article class="final-output-result">${escapeHtml(values[0])}</article>`;
    }
    if (values.length === 0) {
        return '<article class="final-output-result is-empty">工作流执行完成，但没有返回结果。</article>';
    }
    return `<article class="final-output-result"><pre>${escapeHtml(JSON.stringify(output, null, 2))}</pre></article>`;
}

function finalTableHtml(presentation) {
    const columns = presentation.columns;
    const rows = presentation.rows;
    return `
        <article class="final-output-result final-table-result">
            <div class="table-output-scroll">
                <table class="table-output">
                    <thead>
                        <tr>${columns.map(column => `<th>${escapeHtml(column.title ?? column.key ?? "")}</th>`).join("")}</tr>
                    </thead>
                    <tbody>
                        ${rows.length
                            ? rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(formatTableCell(row?.[column.key]))}</td>`).join("")}</tr>`).join("")
                            : `<tr><td class="table-output-empty" colspan="${columns.length}">暂无数据</td></tr>`}
                    </tbody>
                </table>
            </div>
        </article>
    `;
}

function renderExecution(execution) {
    showResultPanel();
    resultList.innerHTML = "";
    executionSummary.textContent = `${execution.workflowId} · ${statusTextFor(execution.status)} · ${execution.id}`;

    for (const node of execution.nodeExecutions ?? []) {
        const details = document.createElement("details");
        details.className = "node-result";
        details.open = node.status !== "Succeeded" || node.presentation?.type === "table";
        details.innerHTML = `
            <summary>
                <span class="node-title">
                    <strong>${escapeHtml(node.nodeName)}</strong>
                    <span>${escapeHtml(node.nodeId)} · ${escapeHtml(node.nodeType)} · 输出端口 ${escapeHtml(node.outputPort ?? "-")}</span>
                </span>
                <span class="badge ${String(node.status).toLowerCase()}">${escapeHtml(statusTextFor(node.status))}</span>
            </summary>
            ${jsonGridHtml(node.input ?? {}, node.output ?? {}, node.error, node.presentation)}
        `;
        resultList.appendChild(details);
    }
}

function jsonGridHtml(input, output, error, presentation) {
    return `
        <div class="json-grid">
            <div class="json-block">
                <div class="json-block-header"><h3>输入</h3>${copyButtonHtml("输入")}</div>
                <pre>${escapeHtml(JSON.stringify(input, null, 2))}</pre>
            </div>
            ${outputBlockHtml(output, presentation)}
            ${error ? `<div class="json-block is-error"><div class="json-block-header"><h3>错误</h3>${copyButtonHtml("错误")}</div><pre>${escapeHtml(error)}</pre></div>` : ""}
        </div>
    `;
}

function outputBlockHtml(output, presentation) {
    if (presentation?.type !== "table"
        || !Array.isArray(presentation.columns)
        || !Array.isArray(presentation.rows)
        || presentation.columns.length === 0) {
        return `
            <div class="json-block">
                <div class="json-block-header"><h3>输出</h3>${copyButtonHtml("输出")}</div>
                <pre>${escapeHtml(JSON.stringify(output, null, 2))}</pre>
            </div>
        `;
    }

    const columns = presentation.columns;
    const rows = presentation.rows;
    return `
        <div class="json-block table-output-block">
            <div class="json-block-header"><h3>表格输出</h3>${copyButtonHtml("输出")}</div>
            <div class="table-output-scroll">
                <table class="table-output">
                    <thead>
                        <tr>${columns.map(column => `<th>${escapeHtml(column.title ?? column.key ?? "")}</th>`).join("")}</tr>
                    </thead>
                    <tbody>
                        ${rows.length
                            ? rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(formatTableCell(row?.[column.key]))}</td>`).join("")}</tr>`).join("")
                            : `<tr><td class="table-output-empty" colspan="${columns.length}">暂无数据</td></tr>`}
                    </tbody>
                </table>
            </div>
            <pre hidden>${escapeHtml(JSON.stringify(output, null, 2))}</pre>
        </div>
    `;
}

function formatTableCell(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function copyButtonHtml(label) {
    return `<button class="copy-json-button" type="button" data-copy-label="${label}" aria-label="复制${label}" title="复制${label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2M7 7h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/></svg></button>`;
}

async function readFiles(files) {
    const results = [];
    for (const file of files) {
        if (isTextFile(file)) {
            results.push({ name: file.name, mimeType: file.type || "text/plain", text: await readAsText(file) });
            continue;
        }

        if (file.type.startsWith("image/")) {
            results.push({ name: file.name, mimeType: file.type, base64: await readAsBase64(file), detail: "high" });
            continue;
        }

        results.push({ name: file.name, mimeType: file.type || "application/octet-stream", base64: await readAsBase64(file) });
    }
    return results;
}

function isTextFile(file) {
    return file.type.startsWith("text/")
        || file.type === "application/json"
        || /\.(txt|md|json|csv|log)$/i.test(file.name);
}

function readAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("读取文本文件失败"));
        reader.readAsText(file);
    });
}

function readAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const value = String(reader.result ?? "");
            resolve(value.includes(",") ? value.split(",")[1] : value);
        };
        reader.onerror = () => reject(reader.error ?? new Error("读取文件失败"));
        reader.readAsDataURL(file);
    });
}

function renderError(error) {
    showResultPanel();
    executionSummary.textContent = "执行失败";
    if (isPortalRun) {
        resultList.innerHTML = `<article class="final-output-result is-error">${escapeHtml(error.message)}</article>`;
        return;
    }
    resultList.innerHTML = `
        <article class="error-result">
            <div class="error-result-header"><h3>错误</h3>${copyButtonHtml("错误")}</div>
            <pre>${escapeHtml(error.message)}</pre>
        </article>
    `;
}

function clearResults() {
    executionSummary.textContent = "暂无执行结果";
    resultList.innerHTML = "";
    resultPanel.hidden = true;
    workflowRunBrand.hidden = false;
    workflowRunResultPanel.classList.remove("is-visible");
    state.liveNodes.clear();
}

function showResultPanel() {
    resultPanel.hidden = false;
    workflowRunBrand.hidden = true;
    workflowRunResultPanel.classList.toggle("is-visible", state.layout === "center");
}

async function handleResultAction(event) {
    const button = event.target.closest(".copy-json-button");
    if (!button) return;

    const text = button.closest(".json-block, .error-result")?.querySelector("pre")?.textContent ?? "";
    try {
        await copyText(text);
        setStatus(`${button.dataset.copyLabel ?? "内容"}已复制`);
    } catch (error) {
        setStatus(`复制失败：${error.message}`);
    }
}

async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // Fall back for browsers that expose Clipboard API but deny it on this page.
        }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("浏览器未允许访问剪贴板");
}

function getRouteWorkflowId() {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts[0] === "workflow-run" && parts[1]) return decodeURIComponent(parts[1]);
    if (parts[0] === "ai" && parts[1]) return decodeURIComponent(parts[1]);
    return new URLSearchParams(location.search).get("workflowId");
}

function executeButtonIdleLabel() {
    if (state.workflow && getManualInputFieldDefinitions().length === 0) return "发送";
    return isPortalRun ? "运行" : "运行测试";
}

function isEmptyManualInput(value) {
    if (Array.isArray(value)) return value.length === 0;
    if (value && typeof value === "object") return Object.values(value).every(isEmptyManualInput);
    return value === null || value === undefined || value === "";
}

function parseBoolean(value) {
    return value === true || String(value).toLowerCase() === "true" || String(value) === "1";
}

function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}

function statusTextFor(status) {
    const normalized = String(status ?? "").toLowerCase();
    if (normalized === "running") return "运行中";
    if (normalized === "succeeded") return "成功";
    if (normalized === "failed") return "失败";
    if (normalized === "skipped") return "已跳过";
    if (normalized === "cancelled") return "已终止";
    if (normalized === "timedout" || normalized === "timed-out") return "已超时";
    if (normalized === "pending") return "等待";
    return status ?? "-";
}

function setStatus() {
    // Status messages are intentionally kept out of the left form panel.
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImageIcon(value) {
    return typeof value === "string" && (/^data:image\//i.test(value) || /^\/[^"'<>]+\.(png|jpe?g|webp|gif|svg)$/i.test(value));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
