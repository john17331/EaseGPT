const agentId = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
const defaultAgentIcon = "/assets/agentchat.svg";
const initialLogRange = createDefaultLogRange();

const state = {
    agent: null,
    providers: [],
    knowledgeBases: [],
    currentView: "design",
    executions: [],
    modelOptions: {
        rerank: []
    },
    dirty: false,
    selectedKnowledgeBaseIds: [],
    previewHistory: [],
    previewAbortController: null,
    previewTimer: null,
    previewStartedAt: null,
    previewStatusMessageId: null,
    previewStepDetails: [],
    agentTools: [],
    agentToolDialogIndex: null,
    agentToolDraft: null,
    agentToolDraftOriginal: null,
    agentToolPickerOpen: false,
    logFilters: {
        from: initialLogRange.from,
        to: initialLogRange.to,
        keyword: ""
    },
    pickerSearch: {
        provider: "",
        knowledge: ""
    },
    openPicker: null
};

const agentToolCatalog = [
    {
        type: "current-time",
        label: "时间",
        description: "用于获取当前服务器时间、UTC 时间与时区信息。"
    },
    {
        type: "web-crawler",
        label: "网页抓取",
        description: "适合从公开网页获取说明、公告、文章或页面结构。"
    },
    {
        type: "http",
        label: "HTTP API",
        description: "适合对接外部接口、业务系统或服务编排入口。"
    },
    {
        type: "database",
        label: "数据库",
        description: "适合读取业务表、报表数据或内部结构化记录。"
    }
];

const agentToolNodeIcons = {
    "utility.current-time": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M12 3v2"/><path d="M21 12h-2"/>',
    "integration.http-request": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>',
    "integration.database": '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>'
};

function upgradeAgentToolDialogMarkup() {
    if (elements.agentHttpToolFields) {
        elements.agentHttpToolFields.innerHTML = `
            <label>
                请求方法
                <select id="agentHttpMethodInput">
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                </select>
            </label>
            <label>
                请求地址
                <input id="agentHttpUrlInput" type="url" placeholder="https://api.example.com/items/{{id}}">
            </label>
            <div class="classifier-heading">
                <strong>请求参数</strong>
                <button id="addAgentHttpQueryButton" class="icon-add-button" type="button" title="添加参数" aria-label="添加参数">+</button>
            </div>
            <div id="agentHttpQueryList" class="http-key-value-list"></div>
            <div class="classifier-heading">
                <strong>请求头</strong>
                <button id="addAgentHttpHeaderButton" class="icon-add-button" type="button" title="添加请求头" aria-label="添加请求头">+</button>
            </div>
            <div id="agentHttpHeaderList" class="http-key-value-list"></div>
            <label>
                请求体
                <textarea id="agentHttpBodyInput" rows="8" placeholder='例如：{"question":"{{question}}"}'></textarea>
            </label>
            <div class="http-number-grid">
                <label>
                    超时时间（秒）
                    <input id="agentHttpTimeoutInput" type="number" min="1" max="300" step="1">
                </label>
                <label>
                    重试次数
                    <input id="agentHttpRetryInput" type="number" min="0" max="5" step="1">
                </label>
            </div>
            <p class="field-hint">URL、请求头和请求体均支持使用 {{变量名}}。仅网络错误、超时、408、429 和 5xx 响应会重试。</p>
        `;
    }

    if (elements.agentWebCrawlerToolFields) {
        elements.agentWebCrawlerToolFields.innerHTML = `
            <label>
                网页链接
                <input id="agentWebUrlInput" type="text" placeholder="https://example.com/{{path}}">
            </label>
            <label>
                User Agent
                <textarea id="agentWebUserAgentInput" rows="3" placeholder="Mozilla/5.0 ..."></textarea>
            </label>
            <label class="toggle-field">
                <input id="agentWebSummaryInput" type="checkbox">
                <span>生成摘要</span>
            </label>
            <div class="agent-tool-config-grid">
                <label>
                    超时时间（秒）
                    <input id="agentWebTimeoutInput" type="number" min="1" max="300" step="1">
                </label>
                <label>
                    重试次数
                    <input id="agentWebRetryInput" type="number" min="0" max="5" step="1">
                </label>
                <label>
                    最大正文长度
                    <input id="agentWebMaxLengthInput" type="number" min="1000" max="500000" step="1000">
                </label>
            </div>
            <p class="field-hint">网页链接和 User Agent 支持 {{变量名}}。节点会提取标题、描述、正文、摘要和链接列表，不允许访问本机或内网地址。</p>
        `;
    }

    if (elements.agentDatabaseToolFields) {
        elements.agentDatabaseToolFields.innerHTML = `
            <label>
                数据库类型
                <select id="agentDatabaseProviderInput">
                    <option value="sqlserver">SQL Server</option>
                    <option value="mysql">MySQL</option>
                    <option value="postgresql">PostgreSQL</option>
                </select>
            </label>
            <div class="database-connection-grid">
                <label>
                    数据库地址
                    <input id="agentDatabaseHostInput" type="text" placeholder="127.0.0.1">
                </label>
                <label>
                    端口
                    <input id="agentDatabasePortInput" type="number" min="1" max="65535" step="1">
                </label>
            </div>
            <label>
                数据库名称
                <input id="agentDatabaseNameInput" type="text">
            </label>
            <label>
                用户名
                <input id="agentDatabaseUsernameInput" type="text" autocomplete="off">
            </label>
            <label>
                密码
                <input id="agentDatabasePasswordInput" type="password" autocomplete="new-password">
            </label>
            <label class="toggle-field">
                <input id="agentDatabaseSslInput" type="checkbox">
                <span>使用 SSL/TLS 连接</span>
            </label>
            <label>
                执行模式
                <select id="agentDatabaseModeInput">
                    <option value="query">查询数据</option>
                    <option value="execute">执行命令</option>
                </select>
            </label>
            <label>
                SQL
                <textarea id="agentDatabaseSqlInput" rows="10" placeholder="SELECT * FROM users WHERE id = @id"></textarea>
            </label>
            <div class="classifier-heading">
                <strong>SQL 参数</strong>
                <button id="addAgentDatabaseParameterButton" class="icon-add-button" type="button" title="添加 SQL 参数" aria-label="添加 SQL 参数">+</button>
            </div>
            <div id="agentDatabaseParameterList" class="database-parameter-list"></div>
            <label>
                超时时间（秒）
                <input id="agentDatabaseTimeoutInput" type="number" min="1" max="300" step="1">
            </label>
            <p class="field-hint">参数值支持 {{变量名}}。密码会随工作流配置保存到 LiteDB，请限制数据库账号权限。</p>
        `;
    }

    elements.agentHttpMethodInput = document.querySelector("#agentHttpMethodInput");
    elements.agentHttpTimeoutInput = document.querySelector("#agentHttpTimeoutInput");
    elements.agentHttpRetryInput = document.querySelector("#agentHttpRetryInput");
    elements.agentHttpUrlInput = document.querySelector("#agentHttpUrlInput");
    elements.addAgentHttpQueryButton = document.querySelector("#addAgentHttpQueryButton");
    elements.addAgentHttpHeaderButton = document.querySelector("#addAgentHttpHeaderButton");
    elements.agentHttpQueryList = document.querySelector("#agentHttpQueryList");
    elements.agentHttpHeaderList = document.querySelector("#agentHttpHeaderList");
    elements.agentHttpBodyInput = document.querySelector("#agentHttpBodyInput");
    elements.agentWebUrlInput = document.querySelector("#agentWebUrlInput");
    elements.agentWebUserAgentInput = document.querySelector("#agentWebUserAgentInput");
    elements.agentWebTimeoutInput = document.querySelector("#agentWebTimeoutInput");
    elements.agentWebRetryInput = document.querySelector("#agentWebRetryInput");
    elements.agentWebMaxLengthInput = document.querySelector("#agentWebMaxLengthInput");
    elements.agentWebSummaryInput = document.querySelector("#agentWebSummaryInput");
    elements.agentDatabaseProviderInput = document.querySelector("#agentDatabaseProviderInput");
    elements.agentDatabasePortInput = document.querySelector("#agentDatabasePortInput");
    elements.agentDatabaseTimeoutInput = document.querySelector("#agentDatabaseTimeoutInput");
    elements.agentDatabaseHostInput = document.querySelector("#agentDatabaseHostInput");
    elements.agentDatabaseNameInput = document.querySelector("#agentDatabaseNameInput");
    elements.agentDatabaseUsernameInput = document.querySelector("#agentDatabaseUsernameInput");
    elements.agentDatabasePasswordInput = document.querySelector("#agentDatabasePasswordInput");
    elements.agentDatabaseSslInput = document.querySelector("#agentDatabaseSslInput");
    elements.agentDatabaseModeInput = document.querySelector("#agentDatabaseModeInput");
    elements.agentDatabaseSqlInput = document.querySelector("#agentDatabaseSqlInput");
    elements.addAgentDatabaseParameterButton = document.querySelector("#addAgentDatabaseParameterButton");
    elements.agentDatabaseParameterList = document.querySelector("#agentDatabaseParameterList");
}

const elements = {
    agentIcon: document.querySelector("#agentIcon"),
    agentName: document.querySelector("#agentName"),
    agentDescription: document.querySelector("#agentDescription"),
    providerSelect: document.querySelector("#providerSelect"),
    providerPicker: document.querySelector("#providerPicker"),
    instructionsInput: document.querySelector("#instructionsInput"),
    maxIterationsInput: document.querySelector("#maxIterationsInput"),
    timeoutSecondsInput: document.querySelector("#timeoutSecondsInput"),
    addAgentToolButton: document.querySelector("#addAgentToolButton"),
    agentToolPicker: document.querySelector("#agentToolPicker"),
    agentToolList: document.querySelector("#agentToolList"),
    knowledgeSelect: document.querySelector("#knowledgeSelect"),
    knowledgePicker: document.querySelector("#knowledgePicker"),
    knowledgeRecallButton: document.querySelector("#knowledgeRecallButton"),
    knowledgeAddButton: document.querySelector("#knowledgeAddButton"),
    recallSettingsDialog: document.querySelector("#recallSettingsDialog"),
    recallSettingsForm: document.querySelector("#recallSettingsForm"),
    closeRecallSettingsButton: document.querySelector("#closeRecallSettingsButton"),
    cancelRecallSettingsButton: document.querySelector("#cancelRecallSettingsButton"),
    recallRerankSelect: document.querySelector("#recallRerankSelect"),
    recallRerankPicker: document.querySelector("#recallRerankPicker"),
    recallTopKInput: document.querySelector("#recallTopKInput"),
    recallTopKRange: document.querySelector("#recallTopKRange"),
    recallScoreThresholdEnabled: document.querySelector("#recallScoreThresholdEnabled"),
    recallScoreThresholdInput: document.querySelector("#recallScoreThresholdInput"),
    recallScoreThresholdRange: document.querySelector("#recallScoreThresholdRange"),
    agentToolDialog: document.querySelector("#agentToolDialog"),
    agentToolForm: document.querySelector("#agentToolForm"),
    agentToolDialogTitle: document.querySelector("#agentToolDialogTitle"),
    closeAgentToolDialogButton: document.querySelector("#closeAgentToolDialogButton"),
    cancelAgentToolButton: document.querySelector("#cancelAgentToolButton"),
    deleteAgentToolButton: document.querySelector("#deleteAgentToolButton"),
    agentToolTypeDisplay: document.querySelector("#agentToolTypeDisplay"),
    agentToolNameInput: document.querySelector("#agentToolNameInput"),
    agentToolPurposeInput: document.querySelector("#agentToolPurposeInput"),
    agentToolResourceInput: document.querySelector("#agentToolResourceInput"),
    agentToolGuardrailsInput: document.querySelector("#agentToolGuardrailsInput"),
    agentCurrentTimeToolFields: document.querySelector("#agentCurrentTimeToolFields"),
    agentCurrentTimeModeInput: document.querySelector("#agentCurrentTimeModeInput"),
    agentCurrentTimeTimeZoneField: document.querySelector("#agentCurrentTimeTimeZoneField"),
    agentCurrentTimeTimeZoneInput: document.querySelector("#agentCurrentTimeTimeZoneInput"),
    agentCurrentTimeFormatInput: document.querySelector("#agentCurrentTimeFormatInput"),
    agentHttpToolFields: document.querySelector("#agentHttpToolFields"),
    agentHttpMethodInput: document.querySelector("#agentHttpMethodInput"),
    agentHttpTimeoutInput: document.querySelector("#agentHttpTimeoutInput"),
    agentHttpRetryInput: document.querySelector("#agentHttpRetryInput"),
    agentHttpUrlInput: document.querySelector("#agentHttpUrlInput"),
    agentHttpQueryInput: document.querySelector("#agentHttpQueryInput"),
    agentHttpHeadersInput: document.querySelector("#agentHttpHeadersInput"),
    addAgentHttpQueryButton: document.querySelector("#addAgentHttpQueryButton"),
    addAgentHttpHeaderButton: document.querySelector("#addAgentHttpHeaderButton"),
    agentHttpQueryList: document.querySelector("#agentHttpQueryList"),
    agentHttpHeaderList: document.querySelector("#agentHttpHeaderList"),
    agentHttpBodyInput: document.querySelector("#agentHttpBodyInput"),
    agentWebCrawlerToolFields: document.querySelector("#agentWebCrawlerToolFields"),
    agentWebUrlInput: document.querySelector("#agentWebUrlInput"),
    agentWebUserAgentInput: document.querySelector("#agentWebUserAgentInput"),
    agentWebTimeoutInput: document.querySelector("#agentWebTimeoutInput"),
    agentWebRetryInput: document.querySelector("#agentWebRetryInput"),
    agentWebMaxLengthInput: document.querySelector("#agentWebMaxLengthInput"),
    agentWebSummaryInput: document.querySelector("#agentWebSummaryInput"),
    agentDatabaseToolFields: document.querySelector("#agentDatabaseToolFields"),
    agentDatabaseProviderInput: document.querySelector("#agentDatabaseProviderInput"),
    agentDatabasePortInput: document.querySelector("#agentDatabasePortInput"),
    agentDatabaseTimeoutInput: document.querySelector("#agentDatabaseTimeoutInput"),
    agentDatabaseHostInput: document.querySelector("#agentDatabaseHostInput"),
    agentDatabaseNameInput: document.querySelector("#agentDatabaseNameInput"),
    agentDatabaseUsernameInput: document.querySelector("#agentDatabaseUsernameInput"),
    agentDatabasePasswordInput: document.querySelector("#agentDatabasePasswordInput"),
    agentDatabaseSslInput: document.querySelector("#agentDatabaseSslInput"),
    agentDatabaseModeInput: document.querySelector("#agentDatabaseModeInput"),
    agentDatabaseSqlInput: document.querySelector("#agentDatabaseSqlInput"),
    agentDatabaseParamsInput: document.querySelector("#agentDatabaseParamsInput"),
    addAgentDatabaseParameterButton: document.querySelector("#addAgentDatabaseParameterButton"),
    agentDatabaseParameterList: document.querySelector("#agentDatabaseParameterList"),
    previewMessages: document.querySelector("#previewMessages"),
    suggestionList: document.querySelector("#suggestionList"),
    previewForm: document.querySelector("#previewForm"),
    previewInput: document.querySelector("#previewInput"),
    previewSubmitButton: document.querySelector("#previewForm button[type='submit']"),
    stopPreviewButton: document.querySelector("#stopPreviewButton"),
    logsViews: Array.from(document.querySelectorAll("[data-main-view]")),
    navButtons: Array.from(document.querySelectorAll("[data-nav-view]")),
    logsFilterForm: document.querySelector("#logsFilterForm"),
    logsStartInput: document.querySelector("#logsStartInput"),
    logsEndInput: document.querySelector("#logsEndInput"),
    logsKeywordInput: document.querySelector("#logsKeywordInput"),
    logsTableBody: document.querySelector("#logsTableBody"),
    logsEmpty: document.querySelector("#logsEmpty"),
    saveMenu: document.querySelector("#saveMenu"),
    saveMenuButton: document.querySelector("#saveMenuButton"),
    lastSavedText: document.querySelector("#lastSavedText"),
    restoreButton: document.querySelector("#restoreButton"),
    toast: document.querySelector("#toast")
};

upgradeAgentToolDialogMarkup();

elements.saveMenuButton?.addEventListener("click", event => {
    event.stopPropagation();
    elements.saveMenu.hidden = !elements.saveMenu.hidden;
    elements.saveMenuButton.setAttribute("aria-expanded", String(!elements.saveMenu.hidden));
});
document.querySelector("#saveUpdateButton")?.addEventListener("click", () => saveAgent(false));
document.querySelector("#runButton")?.addEventListener("click", runAgent);
document.querySelector("#resetPreviewButton")?.addEventListener("click", renderPreview);
elements.navButtons.forEach(button => button.addEventListener("click", () => switchView(button.dataset.navView)));
elements.restoreButton?.addEventListener("click", restoreSavedAgent);
elements.previewForm?.addEventListener("submit", submitPreview);
elements.stopPreviewButton?.addEventListener("click", stopPreviewExecution);
elements.logsFilterForm?.addEventListener("submit", submitLogFilters);
initializeLogFilterInputs();
elements.instructionsInput?.addEventListener("input", markDirty);
elements.providerSelect?.addEventListener("input", markDirty);
elements.maxIterationsInput?.addEventListener("input", markDirty);
elements.timeoutSecondsInput?.addEventListener("input", markDirty);
elements.addAgentToolButton?.addEventListener("click", toggleAgentToolPicker);
elements.agentToolPicker?.addEventListener("click", handleAgentToolPickerClick);
elements.agentToolList?.addEventListener("click", handleAgentToolListClick);
elements.knowledgeRecallButton?.addEventListener("click", openRecallSettingsDialog);
elements.closeRecallSettingsButton?.addEventListener("click", closeRecallSettingsDialog);
elements.cancelRecallSettingsButton?.addEventListener("click", closeRecallSettingsDialog);
elements.recallSettingsForm?.addEventListener("submit", saveRecallSettings);
elements.recallTopKInput?.addEventListener("input", syncRecallTopKFromInput);
elements.recallTopKRange?.addEventListener("input", syncRecallTopKFromRange);
elements.recallScoreThresholdEnabled?.addEventListener("change", syncRecallThresholdUi);
elements.recallScoreThresholdInput?.addEventListener("input", syncRecallThresholdFromInput);
elements.recallScoreThresholdRange?.addEventListener("input", syncRecallThresholdFromRange);
elements.agentToolForm?.addEventListener("submit", saveAgentToolDialog);
elements.closeAgentToolDialogButton?.addEventListener("click", closeAgentToolDialog);
elements.cancelAgentToolButton?.addEventListener("click", closeAgentToolDialog);
elements.deleteAgentToolButton?.addEventListener("click", deleteCurrentAgentTool);
elements.agentToolForm?.addEventListener("input", syncAgentToolDialogDraft);
elements.agentToolForm?.addEventListener("change", syncAgentToolDialogDraft);
elements.agentCurrentTimeModeInput?.addEventListener("change", updateAgentCurrentTimeFieldsVisibility);
elements.addAgentHttpQueryButton?.addEventListener("click", addAgentHttpQueryParameter);
elements.addAgentHttpHeaderButton?.addEventListener("click", addAgentHttpHeader);
elements.addAgentDatabaseParameterButton?.addEventListener("click", addAgentDatabaseParameter);
elements.agentDatabaseProviderInput?.addEventListener("change", updateAgentDatabaseDefaultPort);
elements.agentToolDialog?.addEventListener("cancel", event => {
    event.preventDefault();
    closeAgentToolDialog();
});
window.addEventListener("resize", () => {
    updateRangeProgress(elements.recallTopKRange);
    updateRangeProgress(elements.recallScoreThresholdRange);
    if (state.agentToolPickerOpen) {
        positionAgentToolPicker();
    }
});

document.addEventListener("click", event => {
    if (!event.target.closest("#saveMenuButton") && !event.target.closest("#saveMenu")) {
        elements.saveMenu.hidden = true;
        elements.saveMenuButton.setAttribute("aria-expanded", "false");
    }

    const trigger = event.target.closest("[data-picker-trigger]");
    if (trigger) {
        const kind = trigger.dataset.pickerTrigger;
        state.openPicker = state.openPicker === kind ? null : kind;
        if (state.openPicker) {
            state.pickerSearch[kind] = "";
        }
        renderFloatingPicker("provider");
        renderFloatingPicker("knowledge");
        renderFloatingPicker("recall-rerank");
        event.preventDefault();
        return;
    }

    const option = event.target.closest("[data-picker-option]");
    if (option) {
        const kind = option.dataset.pickerOption;
        if (kind === "provider") {
            elements.providerSelect.value = option.dataset.value;
            markDirty();
        } else if (kind === "recall-rerank") {
            elements.recallRerankSelect.value = option.dataset.value;
            renderFloatingPicker("recall-rerank");
        } else {
            addKnowledgeBase(option.dataset.value);
        }
        state.openPicker = null;
        state.pickerSearch[kind] = "";
        renderFloatingPicker("provider");
        renderFloatingPicker("knowledge");
        renderFloatingPicker("recall-rerank");
        event.preventDefault();
        return;
    }

    const removeKnowledgeButton = event.target.closest("[data-knowledge-remove]");
    if (removeKnowledgeButton) {
        removeKnowledgeBase(removeKnowledgeButton.dataset.knowledgeRemove);
        event.preventDefault();
        return;
    }

    if (!event.target.closest(".floating-model-picker")) {
        closeModelPickers();
    }

    if (state.agentToolPickerOpen
        && !event.target.closest(".agent-tool-picker-anchor")
        && !event.target.closest("#agentToolPicker")
        && !event.target.closest("#agentToolDialog")) {
        closeAgentToolPicker();
    }
});

document.addEventListener("input", event => {
    const search = event.target.closest("[data-picker-search]");
    if (!search) {
        return;
    }

    const kind = search.dataset.pickerSearch;
    state.pickerSearch[kind] = search.value;
    renderFloatingPicker(kind);
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        elements.saveMenu.hidden = true;
        elements.saveMenuButton.setAttribute("aria-expanded", "false");
        closeModelPickers();
    }
});

window.addEventListener("beforeunload", event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
});

initialize();

async function initialize() {
    try {
        const [agentResponse, providerResponse, knowledgeResponse, knowledgeConfigResponse] = await Promise.all([
            fetch(`/api/conversation-agents/${encodeURIComponent(agentId)}`, { cache: "no-store" }),
            fetch("/api/llm-provider-configs", { cache: "no-store" }),
            fetch("/api/knowledge-bases", { cache: "no-store" }),
            fetch("/api/knowledge-bases/config-options", { cache: "no-store" })
        ]);

        if (!agentResponse.ok) {
            throw new Error("对话 Agent 不存在。");
        }

        state.agent = await agentResponse.json();
        state.providers = providerResponse.ok ? await providerResponse.json() : [];
        state.knowledgeBases = knowledgeResponse.ok ? await knowledgeResponse.json() : [];
        state.modelOptions.rerank = normalizeRerankOptions(knowledgeConfigResponse.ok ? await knowledgeConfigResponse.json() : null);
        render();
    } catch (error) {
        showToast(error.message);
    }
}

function render() {
    const agent = state.agent;
    state.selectedKnowledgeBaseIds = normalizeKnowledgeBaseIds(agent.knowledgeBaseIds);
    state.agentTools = normalizeAgentTools(agent.tools);
    elements.agentIcon.innerHTML = `<img src="${escapeAttribute(agent.icon || defaultAgentIcon)}" alt="">`;
    elements.agentName.textContent = agent.name;
    elements.agentDescription.textContent = agent.description || "暂无 Agent 描述";

    renderProviderOptions();
    renderKnowledgeOptions();
    elements.instructionsInput.value = agent.instructions || "";
    if (elements.maxIterationsInput) {
        elements.maxIterationsInput.value = String(clampInteger(agent.maxIterations, 5, 1, 12));
    }
    if (elements.timeoutSecondsInput) {
        elements.timeoutSecondsInput.value = String(clampInteger(agent.timeoutSeconds, 180, 1, 600));
    }
    closeAgentToolPicker();
    resetAgentToolDialogState();
    if (elements.agentToolDialog?.open) {
        elements.agentToolDialog.close();
    }
    renderAgentToolList(state.agentTools);
    hydrateRecallSettings();
    renderPreview();

    state.dirty = false;
    updateSaveMenu();
    updateViewState();
}

function switchView(view) {
    state.currentView = view === "logs" ? "logs" : "design";
    updateViewState();
    if (state.currentView === "logs") {
        loadExecutionLogs();
    }
}

function updateViewState() {
    elements.navButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.navView === state.currentView);
    });
    elements.logsViews.forEach(section => {
        section.hidden = section.dataset.mainView !== state.currentView;
    });
}

function renderProviderOptions() {
    const options = providerPickerOptions();
    syncNativeSelect(elements.providerSelect, options);
    elements.providerSelect.value = options.some(option => option.value === state.agent.providerConfigId)
        ? state.agent.providerConfigId
        : options[0]?.value ?? "";
    renderFloatingPicker("provider");
}

function renderKnowledgeOptions() {
    const options = knowledgePickerOptions();
    syncNativeSelect(elements.knowledgeSelect, options);
    const selectedKnowledgeBase = state.selectedKnowledgeBaseIds[0] || "";
    elements.knowledgeSelect.value = options.some(option => option.value === selectedKnowledgeBase)
        ? selectedKnowledgeBase
        : "";
    renderFloatingPicker("knowledge");
}

function providerPickerOptions() {
    const enabledProviders = state.providers
        .filter(item => item.enabled)
        .filter(item => !item.modelType || String(item.modelType).toLowerCase() === "llm")
        .map(item => ({
            value: item.id,
            label: item.model || item.name,
            providerId: String(item.provider || item.name || "").toLowerCase(),
            providerName: item.provider || item.name,
            modelName: item.model || item.name,
            tag: item.modelType || "LLM"
        }));

    return enabledProviders.length
        ? enabledProviders
        : [{
            value: "",
            label: "暂无可用模型配置",
            providerId: "system",
            providerName: "系统",
            modelName: "暂无可用模型配置",
            tag: "LLM"
        }];
}

function normalizeRerankOptions(options) {
    const defaults = [{
        value: "none",
        label: "不使用重排",
        providerId: "system",
        providerName: "知识库",
        modelName: "不使用重排",
        tag: "Off"
    }];

    const items = Array.isArray(options?.rerankModels) && options.rerankModels.length
        ? options.rerankModels
        : defaults;

    return items.map(item => ({
        value: item.value,
        label: item.label,
        providerId: String(item.providerId || item.provider || "system").toLowerCase(),
        providerName: item.providerName || item.label,
        modelName: item.modelName || item.label,
        tag: item.tag || "Rerank"
    }));
}

function knowledgePickerOptions() {
    return state.knowledgeBases.map(item => ({
        value: item.id,
        label: item.name,
        providerId: "knowledge",
        providerName: "知识库",
        modelName: item.name,
        tag: "Knowledge"
    }));
}

function syncNativeSelect(select, options) {
    const currentValue = select.value;
    select.innerHTML = options.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("");
    select.value = options.some(item => item.value === currentValue) ? currentValue : options[0]?.value ?? "";
}

function renderFloatingPicker(kind) {
    if (kind === "knowledge") {
        renderKnowledgePicker();
        return;
    }

    const root = kind === "provider"
        ? elements.providerPicker
        : elements.recallRerankPicker;
    const select = kind === "provider"
        ? elements.providerSelect
        : elements.recallRerankSelect;
    const options = kind === "provider"
        ? providerPickerOptions()
        : state.modelOptions.rerank;
    if (!root || !select || !options.length) {
        return;
    }

    const selected = options.find(item => item.value === select.value) || options[0];
    select.value = selected.value;
    const open = state.openPicker === kind;
    const query = state.pickerSearch[kind] || "";

    root.innerHTML = `
        <button type="button" class="floating-model-trigger${open ? " is-open" : ""}" data-picker-trigger="${kind}">
            <span class="floating-model-selected">
                ${providerLogoHtml(selected.providerId)}
                <span class="floating-model-selected-copy">
                    <strong>${escapeHtml(selected.modelName)}</strong>
                </span>
            </span>
            <span class="floating-model-caret" aria-hidden="true"><img src="/assets/down.svg" alt=""></span>
        </button>
        <div class="floating-model-panel${open ? " is-open" : ""}">
            <div class="floating-model-search-row">
                <input
                    type="search"
                    class="floating-model-search"
                    data-picker-search="${kind}"
                    value="${escapeHtml(query)}"
                    placeholder="搜索${kind === "provider" ? "模型" : "Rerank 模型"}">
            </div>
            <div class="floating-model-options" data-picker-options="${kind}">
                ${pickerOptionsHtml(kind, options, query)}
            </div>
        </div>
    `;

    if (open) {
        const input = root.querySelector(`[data-picker-search="${kind}"]`);
        if (document.activeElement !== input) {
            window.setTimeout(() => input?.focus(), 0);
        }
    }
}

function renderKnowledgePicker() {
    const root = elements.knowledgePicker;
    const options = knowledgePickerOptions();
    if (!root) {
        return;
    }

    const open = state.openPicker === "knowledge";
    const query = state.pickerSearch.knowledge || "";
    const selectedOptions = state.selectedKnowledgeBaseIds
        .map(id => findKnowledgeBaseById(id))
        .filter(Boolean);

    root.innerHTML = `
        <div class="knowledge-selection-list${selectedOptions.length ? "" : " is-empty"}">
            ${selectedOptions.length
                ? selectedOptions.map(option => `
                    <article class="knowledge-selection-card">
                        <span class="knowledge-selection-card-main">
                            ${providerLogoHtml("knowledge")}
                            <span class="knowledge-selection-card-copy">
                                <strong>${escapeHtml(option.name)}</strong>
                            </span>
                        </span>
                        <span class="knowledge-selection-card-meta">
                            <span class="knowledge-selection-chip">${escapeHtml(getKnowledgeIndexModeLabel(option.indexMode))}</span>
                            <button type="button" class="knowledge-selection-remove" data-knowledge-remove="${escapeHtml(option.value)}">移除</button>
                        </span>
                    </article>
                `).join("")
                : `<div class="knowledge-selection-empty">暂未添加知识库</div>`}
        </div>
        <div class="floating-model-panel knowledge-floating-panel${open ? " is-open" : ""}">
            <div class="floating-model-search-row">
                <input
                    type="search"
                    class="floating-model-search"
                    data-picker-search="knowledge"
                    value="${escapeHtml(query)}"
                    placeholder="搜索知识库">
            </div>
            <div class="floating-model-options" data-picker-options="knowledge">
                ${pickerOptionsHtml("knowledge", options, query)}
            </div>
        </div>
    `;

    if (elements.knowledgeAddButton) {
        elements.knowledgeAddButton.classList.toggle("is-open", open);
        elements.knowledgeAddButton.setAttribute("aria-expanded", String(open));
    }

    if (open) {
        const input = root.querySelector('[data-picker-search="knowledge"]');
        if (document.activeElement !== input) {
            window.setTimeout(() => input?.focus(), 0);
        }
    }
}

function pickerOptionsHtml(kind, options, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const filtered = normalizedQuery
        ? options.filter(item => [item.modelName, item.providerName, item.label, item.tag].join(" ").toLowerCase().includes(normalizedQuery))
        : options;

    if (!filtered.length) {
        return `<div class="floating-model-empty">没有找到匹配的${kind === "provider" ? "模型" : "知识库"}</div>`;
    }

    const groups = new Map();
    filtered.forEach(item => {
        const groupName = item.providerName || "其他";
        if (!groups.has(groupName)) {
            groups.set(groupName, []);
        }
        groups.get(groupName).push(item);
    });

    return Array.from(groups.entries()).map(([groupName, items]) => `
        <section class="floating-model-group">
            <header>${escapeHtml(groupName)}</header>
            ${items.map(item => {
                const selected = kind === "knowledge"
                    ? state.selectedKnowledgeBaseIds.includes(item.value)
                    : getPickerValue(kind) === item.value;
                return `
                    <button
                        type="button"
                        class="floating-model-option${selected ? " is-selected" : ""}"
                        data-picker-option="${kind}"
                        data-value="${escapeHtml(item.value)}">
                        ${providerLogoHtml(item.providerId)}
                        <span class="floating-model-option-copy">
                            <strong>${escapeHtml(item.modelName)}</strong>
                        </span>
                    </button>
                `;
            }).join("")}
        </section>
    `).join("");
}

function getPickerValue(kind) {
    if (kind === "provider") {
        return elements.providerSelect.value;
    }
    if (kind === "recall-rerank") {
        return elements.recallRerankSelect.value;
    }
    return elements.knowledgeSelect.value;
}

function closeModelPickers() {
    if (!state.openPicker) {
        return;
    }
    state.openPicker = null;
    renderFloatingPicker("provider");
    renderFloatingPicker("knowledge");
    renderFloatingPicker("recall-rerank");
}

function addKnowledgeBase(knowledgeBaseId) {
    if (!knowledgeBaseId || state.selectedKnowledgeBaseIds.includes(knowledgeBaseId)) {
        return;
    }

    state.selectedKnowledgeBaseIds = state.selectedKnowledgeBaseIds.concat(knowledgeBaseId);
    elements.knowledgeSelect.value = state.selectedKnowledgeBaseIds[0] || "";
    renderFloatingPicker("knowledge");
    markDirty();
}

function removeKnowledgeBase(knowledgeBaseId) {
    const nextIds = state.selectedKnowledgeBaseIds.filter(id => id !== knowledgeBaseId);
    if (nextIds.length === state.selectedKnowledgeBaseIds.length) {
        return;
    }

    state.selectedKnowledgeBaseIds = nextIds;
    elements.knowledgeSelect.value = nextIds[0] || "";
    renderFloatingPicker("knowledge");
    markDirty();
}

function normalizeKnowledgeBaseIds(ids) {
    if (!Array.isArray(ids)) {
        return [];
    }

    return ids
        .filter(id => typeof id === "string" && id.trim())
        .filter((id, index, list) => list.indexOf(id) === index);
}

function hydrateRecallSettings() {
    const canPaintRanges = !!elements.recallSettingsDialog?.open;

    if (elements.recallRerankSelect) {
        syncNativeSelect(elements.recallRerankSelect, state.modelOptions.rerank);
        const rerankValue = state.modelOptions.rerank.some(option => option.value === state.agent?.recallRerankModel)
            ? state.agent.recallRerankModel
            : "none";
        elements.recallRerankSelect.value = rerankValue;
    }

    if (elements.recallTopKInput) {
        elements.recallTopKInput.value = String(clampInteger(state.agent?.recallTopK, 4, 1, 12));
    }
    if (elements.recallTopKRange) {
        elements.recallTopKRange.value = String(clampInteger(state.agent?.recallTopK, 4, 1, 12));
        if (canPaintRanges) {
            updateRangeProgress(elements.recallTopKRange);
        }
    }
    if (elements.recallScoreThresholdEnabled) {
        elements.recallScoreThresholdEnabled.checked = !!state.agent?.recallScoreThresholdEnabled;
    }
    if (elements.recallScoreThresholdInput) {
        elements.recallScoreThresholdInput.value = String(clampNumber(state.agent?.recallScoreThreshold, 0, 0, 1));
    }
    if (elements.recallScoreThresholdRange) {
        elements.recallScoreThresholdRange.value = String(clampNumber(state.agent?.recallScoreThreshold, 0, 0, 1));
        if (canPaintRanges) {
            updateRangeProgress(elements.recallScoreThresholdRange);
        }
    }

    syncRecallThresholdUi();
    renderFloatingPicker("recall-rerank");
}

function openRecallSettingsDialog() {
    elements.recallSettingsDialog?.showModal();
    window.requestAnimationFrame(() => {
        hydrateRecallSettings();
        updateRangeProgress(elements.recallTopKRange);
        updateRangeProgress(elements.recallScoreThresholdRange);
    });
}

function closeRecallSettingsDialog() {
    elements.recallSettingsDialog?.close();
    closeModelPickers();
}

function syncRecallTopKFromInput() {
    const value = clampInteger(elements.recallTopKInput?.value, 4, 1, 12);
    elements.recallTopKInput.value = String(value);
    elements.recallTopKRange.value = String(value);
    updateRangeProgress(elements.recallTopKRange);
}

function syncRecallTopKFromRange() {
    const value = clampInteger(elements.recallTopKRange?.value, 4, 1, 12);
    elements.recallTopKRange.value = String(value);
    elements.recallTopKInput.value = String(value);
    updateRangeProgress(elements.recallTopKRange);
}

function syncRecallThresholdFromInput() {
    const value = clampNumber(elements.recallScoreThresholdInput?.value, 0, 0, 1);
    elements.recallScoreThresholdInput.value = String(value);
    elements.recallScoreThresholdRange.value = String(value);
    updateRangeProgress(elements.recallScoreThresholdRange);
}

function syncRecallThresholdFromRange() {
    const value = clampNumber(elements.recallScoreThresholdRange?.value, 0, 0, 1);
    elements.recallScoreThresholdRange.value = String(value);
    elements.recallScoreThresholdInput.value = String(value);
    updateRangeProgress(elements.recallScoreThresholdRange);
}

function syncRecallThresholdUi() {
    const enabled = !!elements.recallScoreThresholdEnabled?.checked;
    if (elements.recallScoreThresholdInput) {
        elements.recallScoreThresholdInput.disabled = !enabled;
    }
    if (elements.recallScoreThresholdRange) {
        elements.recallScoreThresholdRange.disabled = !enabled;
        updateRangeProgress(elements.recallScoreThresholdRange);
    }
}

function saveRecallSettings(event) {
    event.preventDefault();
    state.agent = {
        ...state.agent,
        recallRerankModel: elements.recallRerankSelect.value || "none",
        recallTopK: clampInteger(elements.recallTopKInput?.value, 4, 1, 12),
        recallScoreThresholdEnabled: !!elements.recallScoreThresholdEnabled?.checked,
        recallScoreThreshold: clampNumber(elements.recallScoreThresholdInput?.value, 0, 0, 1)
    };
    markDirty();
    closeRecallSettingsDialog();
    showToast("召回设置已更新");
}

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
}

function clampNumber(value, fallback, min, max) {
    const parsed = Number.parseFloat(String(value ?? ""));
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(parsed * 100) / 100));
}

function updateRangeProgress(range) {
    if (!range) {
        return;
    }

    const min = Number.parseFloat(range.min || "0");
    const max = Number.parseFloat(range.max || "100");
    const value = Number.parseFloat(range.value || "0");
    const denominator = max - min;
    const progress = denominator <= 0 ? 0 : Math.max(0, Math.min(1, (value - min) / denominator));
    const activeColor = range.disabled ? "#cfd8e6" : "#2b6cf6";
    const inactiveColor = "#dbe4f0";
    const trackWidth = Math.max(1, range.clientWidth || 1);
    const activeWidth = Math.min(trackWidth, trackWidth * progress);
    const inactiveWidth = Math.max(0, trackWidth - activeWidth);

    range.style.background = [
        `linear-gradient(to right, ${activeColor} 0%, ${activeColor} 100%) left center / ${activeWidth}px 3px no-repeat`,
        `linear-gradient(to right, ${inactiveColor} 0%, ${inactiveColor} 100%) ${activeWidth}px center / ${inactiveWidth}px 3px no-repeat`
    ].join(", ");
}

function findKnowledgeBaseById(id) {
    const knowledgeBase = state.knowledgeBases.find(item => item.id === id);
    return knowledgeBase
        ? {
            ...knowledgeBase,
            value: knowledgeBase.id
        }
        : null;
}

function getKnowledgeIndexModeLabel(indexMode) {
    const indexModeMap = {
        hybrid: "混合检索",
        vector: "向量检索",
        "full-text": "全文检索"
    };
    return indexModeMap[String(indexMode || "").toLowerCase()] || "混合检索";
}

function normalizeAgentTools(tools) {
    const source = Array.isArray(tools) ? tools : [];
    return source
        .map(tool => {
            const toolType = agentToolCatalog.some(item => item.type === tool?.toolType)
                ? String(tool.toolType).toLowerCase()
                : "http";
            const meta = agentToolCatalog.find(item => item.type === toolType);
            return {
                toolType,
                name: typeof tool?.name === "string" ? tool.name : (meta?.label ?? "HTTP API"),
                purpose: typeof tool?.purpose === "string" ? tool.purpose : "",
                resource: typeof tool?.resource === "string" ? tool.resource : "",
                guardrails: typeof tool?.guardrails === "string" ? tool.guardrails : "",
                currentTime: normalizeAgentCurrentTimeConfig(tool?.currentTime),
                http: normalizeAgentHttpConfig(tool?.http),
                webCrawler: normalizeAgentWebCrawlerConfig(tool?.webCrawler),
                database: normalizeAgentDatabaseConfig(tool?.database)
            };
        })
        .filter(tool => tool?.toolType);
}

function normalizeAgentCurrentTimeConfig(config) {
    return {
        mode: typeof config?.mode === "string" ? config.mode : "local",
        timeZone: typeof config?.timeZone === "string" ? config.timeZone : "",
        format: typeof config?.format === "string" && config.format.trim()
            ? config.format
            : "yyyy-MM-dd HH:mm:ss zzz"
    };
}

function normalizeAgentHttpConfig(config) {
    return {
        method: typeof config?.method === "string" ? config.method : "GET",
        url: typeof config?.url === "string" ? config.url : "",
        body: typeof config?.body === "string" ? config.body : "",
        queryParametersJson: typeof config?.queryParametersJson === "string" ? config.queryParametersJson : "[]",
        headersJson: typeof config?.headersJson === "string" ? config.headersJson : "[]",
        timeoutSeconds: clampInteger(config?.timeoutSeconds, 30, 1, 300),
        retryCount: clampInteger(config?.retryCount, 0, 0, 5)
    };
}

function normalizeAgentWebCrawlerConfig(config) {
    return {
        url: typeof config?.url === "string" ? config.url : "",
        userAgent: typeof config?.userAgent === "string" && config.userAgent.trim()
            ? config.userAgent
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.1000.0 Safari/537.36",
        generateSummary: config?.generateSummary ?? true,
        timeoutSeconds: clampInteger(config?.timeoutSeconds, 30, 1, 300),
        retryCount: clampInteger(config?.retryCount, 0, 0, 5),
        maxContentLength: clampInteger(config?.maxContentLength, 100000, 1000, 500000)
    };
}

function normalizeAgentDatabaseConfig(config) {
    const provider = typeof config?.provider === "string" ? config.provider : "sqlserver";
    return {
        provider,
        host: typeof config?.host === "string" ? config.host : "",
        port: clampInteger(config?.port, getDatabaseDefaultPort(provider), 1, 65535),
        database: typeof config?.database === "string" ? config.database : "",
        username: typeof config?.username === "string" ? config.username : "",
        password: typeof config?.password === "string" ? config.password : "",
        useSsl: !!config?.useSsl,
        mode: typeof config?.mode === "string" ? config.mode : "query",
        sql: typeof config?.sql === "string" ? config.sql : "",
        parametersJson: typeof config?.parametersJson === "string" ? config.parametersJson : "[]",
        timeoutSeconds: clampInteger(config?.timeoutSeconds, 30, 1, 300)
    };
}

function renderAgentToolList(tools) {
    if (!elements.agentToolList) {
        return;
    }
    if (!tools.length) {
        elements.agentToolList.innerHTML = '<div class="agent-selection-empty">暂未添加工具，请先添加一个 Agent 工具。</div>';
        return;
    }

    elements.agentToolList.innerHTML = tools.map((tool, index) => {
        const meta = agentToolCatalog.find(item => item.type === tool.toolType);
        const summary = buildAgentToolSummary(tool);
        const args = detectAgentToolArgumentNames(tool);
        return `
            <article class="agent-tool-card" data-agent-tool-index="${index}">
                <div class="agent-tool-card-header">
                    <div class="agent-tool-card-main">
                        <span class="agent-tool-card-icon">${agentToolIconHtml(tool.toolType)}</span>
                        <div class="agent-tool-card-copy">
                            <strong>${escapeHtml(tool.name || meta?.label || tool.toolType)}</strong>
                            <small>${escapeHtml(meta?.label ?? tool.toolType)}${summary ? ` · ${escapeHtml(summary)}` : ""}</small>
                        </div>
                    </div>
                    <span class="agent-tool-card-actions">
                        <button class="manual-field-action-button edit" type="button" data-agent-tool-edit="${index}" title="配置工具" aria-label="配置工具">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg>
                        </button>
                        <button class="manual-field-action-button delete" type="button" data-agent-tool-remove="${index}" title="删除工具" aria-label="删除工具">
                            <img src="/assets/delete.svg" alt="" aria-hidden="true">
                        </button>
                    </span>
                </div>
                <div class="agent-tool-card-tags">
                    ${tool.purpose ? `<span>${escapeHtml(tool.purpose)}</span>` : ""}
                    ${tool.resource ? `<span>${escapeHtml(tool.resource)}</span>` : ""}
                    <span>参数 ${args.length ? escapeHtml(args.join(", ")) : "无"}</span>
                </div>
            </article>
        `;
    }).join("");
}

function buildAgentToolSummary(tool) {
    if (tool.toolType === "current-time") {
        return tool.currentTime?.mode === "custom" && tool.currentTime?.timeZone
            ? `${tool.currentTime.timeZone} · get_current_time`
            : `${tool.currentTime?.mode || "local"} · get_current_time`;
    }
    if (tool.toolType === "http") {
        return tool.http?.url || `${tool.http?.method || "GET"} request`;
    }
    if (tool.toolType === "web-crawler") {
        return tool.webCrawler?.url || "web content fetch";
    }
    if (tool.toolType === "database") {
        const databaseName = tool.database?.database?.trim();
        return databaseName ? `${tool.database?.provider || "sqlserver"} · ${databaseName}` : `${tool.database?.provider || "sqlserver"} query`;
    }
    return "";
}

function agentToolIconHtml(toolType) {
    const nodeType = toolType === "current-time"
        ? "utility.current-time"
        : toolType === "http"
            ? "integration.http-request"
            : toolType === "web-crawler"
                ? "integration.web-crawler"
                : "integration.database";
    if (nodeType === "integration.web-crawler") {
        return '<img src="/assets/webcra.svg" alt="" aria-hidden="true">';
    }
    const paths = agentToolNodeIcons[nodeType] ?? '<circle cx="12" cy="12" r="8"/><path d="M12 8v4"/><path d="M12 16h.01"/>';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function createAgentTool(toolType = "current-time") {
    const normalizedType = agentToolCatalog.some(item => item.type === toolType) ? toolType : "current-time";
    const meta = agentToolCatalog.find(item => item.type === normalizedType);
    return {
        toolType: normalizedType,
        name: meta?.label ?? "时间",
        purpose: "",
        resource: "",
        guardrails: "",
        currentTime: normalizeAgentCurrentTimeConfig(null),
        http: normalizeAgentHttpConfig(null),
        webCrawler: normalizeAgentWebCrawlerConfig(null),
        database: normalizeAgentDatabaseConfig(null)
    };
}

function toggleAgentToolPicker(event) {
    event?.stopPropagation?.();
    state.agentToolPickerOpen = !state.agentToolPickerOpen;
    renderAgentToolPicker();
}

function renderAgentToolPicker() {
    if (!elements.agentToolPicker) {
        return;
    }
    elements.agentToolPicker.hidden = !state.agentToolPickerOpen;
    if (!state.agentToolPickerOpen) {
        elements.agentToolPicker.innerHTML = "";
        return;
    }

    elements.agentToolPicker.innerHTML = agentToolCatalog.map(item => `
        <button class="agent-tool-picker-option" type="button" data-agent-tool-option="${escapeAttribute(item.type)}">
            <span class="agent-tool-picker-icon">${agentToolIconHtml(item.type)}</span>
            <span class="agent-tool-picker-copy">
                <strong>${escapeHtml(item.label)}</strong>
                <small>${escapeHtml(item.description)}</small>
            </span>
        </button>
    `).join("");
    positionAgentToolPicker();
}

function closeAgentToolPicker() {
    if (!elements.agentToolPicker) {
        return;
    }
    state.agentToolPickerOpen = false;
    elements.agentToolPicker.hidden = true;
    elements.agentToolPicker.style.left = "";
    elements.agentToolPicker.style.top = "";
}

function positionAgentToolPicker() {
    if (!state.agentToolPickerOpen || !elements.agentToolPicker || !elements.addAgentToolButton) {
        return;
    }

    const buttonRect = elements.addAgentToolButton.getBoundingClientRect();
    const viewportInset = 12;
    const preferredWidth = Math.min(420, window.innerWidth - viewportInset * 2);
    elements.agentToolPicker.style.width = `${preferredWidth}px`;

    const pickerRect = elements.agentToolPicker.getBoundingClientRect();
    const pickerWidth = pickerRect.width || preferredWidth;
    const left = Math.max(viewportInset, Math.min(buttonRect.right - pickerWidth, window.innerWidth - pickerWidth - viewportInset));
    const top = Math.min(buttonRect.bottom + 8, window.innerHeight - pickerRect.height - viewportInset);

    elements.agentToolPicker.style.left = `${Math.round(left)}px`;
    elements.agentToolPicker.style.top = `${Math.round(Math.max(viewportInset, top))}px`;
}

function handleAgentToolPickerClick(event) {
    const option = event.target.closest("[data-agent-tool-option]");
    if (!option) {
        return;
    }

    const toolType = option.dataset.agentToolOption;
    state.agentTools.push(createAgentTool(toolType));
    closeAgentToolPicker();
    renderAgentToolList(state.agentTools);
    markDirty();
    openAgentToolDialog(state.agentTools.length - 1);
}

function openAgentToolDialog(index) {
    const tool = state.agentTools[index];
    if (!tool || !elements.agentToolDialog) {
        return;
    }

    state.agentToolDialogIndex = index;
    state.agentToolDraftOriginal = structuredClone(tool);
    state.agentToolDraft = structuredClone(tool);
    renderAgentToolDialog();
    elements.agentToolDialog.showModal();
    window.setTimeout(() => elements.agentToolNameInput?.focus(), 0);
}

function renderAgentToolDialog() {
    const tool = state.agentToolDraft;
    if (!tool) {
        return;
    }

    const meta = agentToolCatalog.find(item => item.type === tool.toolType);
    elements.agentToolDialogTitle.textContent = `${meta?.label ?? "工具"}配置`;
    elements.agentToolTypeDisplay.value = meta?.label ?? tool.toolType;
    elements.agentToolNameInput.value = tool.name ?? "";
    elements.agentToolPurposeInput.value = tool.purpose ?? "";
    elements.agentToolResourceInput.value = tool.resource ?? "";
    elements.agentToolGuardrailsInput.value = tool.guardrails ?? "";

    elements.agentCurrentTimeModeInput.value = tool.currentTime.mode;
    elements.agentCurrentTimeTimeZoneInput.value = tool.currentTime.timeZone;
    elements.agentCurrentTimeFormatInput.value = tool.currentTime.format;
    updateAgentCurrentTimeFieldsVisibility();

    elements.agentHttpMethodInput.value = tool.http.method;
    elements.agentHttpTimeoutInput.value = tool.http.timeoutSeconds;
    elements.agentHttpRetryInput.value = tool.http.retryCount;
    elements.agentHttpUrlInput.value = tool.http.url;
    elements.agentHttpBodyInput.value = tool.http.body;
    renderAgentHttpQueryParameters(parseAgentHttpItems(tool.http.queryParametersJson));
    renderAgentHttpHeaders(parseAgentHttpItems(tool.http.headersJson));

    elements.agentWebUrlInput.value = tool.webCrawler.url;
    elements.agentWebUserAgentInput.value = tool.webCrawler.userAgent;
    elements.agentWebTimeoutInput.value = tool.webCrawler.timeoutSeconds;
    elements.agentWebRetryInput.value = tool.webCrawler.retryCount;
    elements.agentWebMaxLengthInput.value = tool.webCrawler.maxContentLength;
    elements.agentWebSummaryInput.checked = !!tool.webCrawler.generateSummary;

    elements.agentDatabaseProviderInput.value = tool.database.provider;
    elements.agentDatabasePortInput.value = tool.database.port;
    elements.agentDatabaseTimeoutInput.value = tool.database.timeoutSeconds;
    elements.agentDatabaseHostInput.value = tool.database.host;
    elements.agentDatabaseNameInput.value = tool.database.database;
    elements.agentDatabaseUsernameInput.value = tool.database.username;
    elements.agentDatabasePasswordInput.value = tool.database.password;
    elements.agentDatabaseSslInput.checked = !!tool.database.useSsl;
    elements.agentDatabaseModeInput.value = tool.database.mode;
    elements.agentDatabaseSqlInput.value = tool.database.sql;
    renderAgentDatabaseParameters(parseAgentDatabaseParameters(tool.database.parametersJson));
    updateAgentDatabaseDefaultPort(false);

    elements.agentCurrentTimeToolFields.hidden = tool.toolType !== "current-time";
    elements.agentHttpToolFields.hidden = tool.toolType !== "http";
    elements.agentWebCrawlerToolFields.hidden = tool.toolType !== "web-crawler";
    elements.agentDatabaseToolFields.hidden = tool.toolType !== "database";
}

function updateAgentCurrentTimeFieldsVisibility() {
    if (!elements.agentCurrentTimeTimeZoneField || !elements.agentCurrentTimeModeInput) {
        return;
    }
    elements.agentCurrentTimeTimeZoneField.hidden = elements.agentCurrentTimeModeInput.value !== "custom";
}

function parseAgentHttpItems(value) {
    try {
        const parsed = JSON.parse(String(value || "[]"));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function parseAgentDatabaseParameters(value) {
    try {
        const parsed = JSON.parse(String(value || "[]"));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function renderHttpKeyValueRows(container, items, emptyText, namePlaceholder, valuePlaceholder, removeItem) {
    container.innerHTML = "";
    if (items.length === 0) {
        container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
        return;
    }

    items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "http-key-value-item";
        row.innerHTML = `
            <input data-field="name" value="${escapeHtml(item.name ?? "")}" placeholder="${namePlaceholder}">
            <input data-field="value" value="${escapeHtml(item.value ?? "")}" placeholder="${valuePlaceholder}">
            <button class="file-delete-button" type="button" title="删除" aria-label="删除">×</button>
        `;
        row.querySelector("button").addEventListener("click", () => removeItem(index));
        container.appendChild(row);
    });
}

function renderAgentHttpQueryParameters(parameters) {
    renderHttpKeyValueRows(
        elements.agentHttpQueryList,
        parameters,
        "暂无请求参数",
        "参数名",
        "参数值，支持 {{变量}}",
        removeAgentHttpQueryParameter);
}

function renderAgentHttpHeaders(headers) {
    renderHttpKeyValueRows(
        elements.agentHttpHeaderList,
        headers,
        "暂无自定义请求头",
        "Header 名称",
        "Header 值，支持 {{变量}}",
        removeAgentHttpHeader);
}

function collectAgentHttpKeyValueRows(container) {
    return Array.from(container.querySelectorAll(".http-key-value-item"))
        .map(row => ({
            name: row.querySelector('[data-field="name"]').value.trim(),
            value: row.querySelector('[data-field="value"]').value
        }))
        .filter(item => item.name);
}

function collectAgentHttpQueryParameters() {
    return collectAgentHttpKeyValueRows(elements.agentHttpQueryList);
}

function collectAgentHttpHeaders() {
    return collectAgentHttpKeyValueRows(elements.agentHttpHeaderList);
}

function addAgentHttpQueryParameter() {
    const parameters = collectAgentHttpQueryParameters();
    parameters.push({ name: "", value: "" });
    renderAgentHttpQueryParameters(parameters);
}

function removeAgentHttpQueryParameter(index) {
    const parameters = collectAgentHttpQueryParameters();
    parameters.splice(index, 1);
    renderAgentHttpQueryParameters(parameters);
}

function addAgentHttpHeader() {
    const headers = collectAgentHttpHeaders();
    headers.push({ name: "", value: "" });
    renderAgentHttpHeaders(headers);
}

function removeAgentHttpHeader(index) {
    const headers = collectAgentHttpHeaders();
    headers.splice(index, 1);
    renderAgentHttpHeaders(headers);
}

function renderAgentDatabaseParameters(parameters) {
    elements.agentDatabaseParameterList.innerHTML = "";
    if (parameters.length === 0) {
        elements.agentDatabaseParameterList.innerHTML = '<div class="empty-state">暂无 SQL 参数</div>';
        return;
    }

    parameters.forEach((parameter, index) => {
        const row = document.createElement("div");
        row.className = "database-parameter-item";
        row.innerHTML = `
            <input data-field="name" value="${escapeHtml(parameter.name ?? "")}" placeholder="参数名，如 id">
            <select data-field="type">
                <option value="string">文本</option>
                <option value="integer">整数</option>
                <option value="number">数字</option>
                <option value="boolean">布尔值</option>
                <option value="datetime">日期时间</option>
                <option value="null">NULL</option>
            </select>
            <button class="file-delete-button" type="button" title="删除参数" aria-label="删除参数">×</button>
            <input class="database-parameter-value" data-field="value" value="${escapeHtml(parameter.value ?? "")}" placeholder="参数值，支持 {{变量}}">
        `;
        row.querySelector('[data-field="type"]').value = parameter.type ?? "string";
        row.querySelector("button").addEventListener("click", () => removeAgentDatabaseParameter(index));
        elements.agentDatabaseParameterList.appendChild(row);
    });
}

function collectAgentDatabaseParameters() {
    return Array.from(elements.agentDatabaseParameterList.querySelectorAll(".database-parameter-item"))
        .map(row => ({
            name: row.querySelector('[data-field="name"]').value.trim(),
            type: row.querySelector('[data-field="type"]').value,
            value: row.querySelector('[data-field="value"]').value
        }))
        .filter(parameter => parameter.name);
}

function addAgentDatabaseParameter() {
    const parameters = collectAgentDatabaseParameters();
    parameters.push({ name: "", type: "string", value: "" });
    renderAgentDatabaseParameters(parameters);
}

function removeAgentDatabaseParameter(index) {
    const parameters = collectAgentDatabaseParameters();
    parameters.splice(index, 1);
    renderAgentDatabaseParameters(parameters);
}

function updateAgentDatabaseDefaultPort(overwrite = true) {
    if (!elements.agentDatabasePortInput || !elements.agentDatabaseProviderInput) {
        return;
    }
    if (!overwrite && String(elements.agentDatabasePortInput.value || "").trim()) {
        return;
    }
    elements.agentDatabasePortInput.value = getDatabaseDefaultPort(elements.agentDatabaseProviderInput.value);
}

function syncAgentToolDialogDraft() {
    if (!state.agentToolDraft) {
        return;
    }

    state.agentToolDraft = {
        ...state.agentToolDraft,
        name: elements.agentToolNameInput.value.trim(),
        purpose: elements.agentToolPurposeInput.value.trim(),
        resource: elements.agentToolResourceInput.value.trim(),
        guardrails: elements.agentToolGuardrailsInput.value.trim(),
        currentTime: {
            mode: elements.agentCurrentTimeModeInput.value || "local",
            timeZone: elements.agentCurrentTimeTimeZoneInput.value.trim(),
            format: elements.agentCurrentTimeFormatInput.value.trim() || "yyyy-MM-dd HH:mm:ss zzz"
        },
        http: {
            method: elements.agentHttpMethodInput.value || "GET",
            url: elements.agentHttpUrlInput.value.trim(),
            body: elements.agentHttpBodyInput.value,
            queryParametersJson: JSON.stringify(collectAgentHttpQueryParameters()),
            headersJson: JSON.stringify(collectAgentHttpHeaders()),
            timeoutSeconds: clampInteger(elements.agentHttpTimeoutInput.value, 30, 1, 300),
            retryCount: clampInteger(elements.agentHttpRetryInput.value, 0, 0, 5)
        },
        webCrawler: {
            url: elements.agentWebUrlInput.value.trim(),
            userAgent: elements.agentWebUserAgentInput.value.trim()
                || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.1000.0 Safari/537.36",
            generateSummary: !!elements.agentWebSummaryInput.checked,
            timeoutSeconds: clampInteger(elements.agentWebTimeoutInput.value, 30, 1, 300),
            retryCount: clampInteger(elements.agentWebRetryInput.value, 0, 0, 5),
            maxContentLength: clampInteger(elements.agentWebMaxLengthInput.value, 100000, 1000, 500000)
        },
        database: {
            provider: elements.agentDatabaseProviderInput.value || "sqlserver",
            host: elements.agentDatabaseHostInput.value.trim(),
            port: clampInteger(elements.agentDatabasePortInput.value, getDatabaseDefaultPort(elements.agentDatabaseProviderInput.value), 1, 65535),
            database: elements.agentDatabaseNameInput.value.trim(),
            username: elements.agentDatabaseUsernameInput.value.trim(),
            password: elements.agentDatabasePasswordInput.value,
            useSsl: !!elements.agentDatabaseSslInput.checked,
            mode: elements.agentDatabaseModeInput.value || "query",
            sql: elements.agentDatabaseSqlInput.value,
            parametersJson: JSON.stringify(collectAgentDatabaseParameters()),
            timeoutSeconds: clampInteger(elements.agentDatabaseTimeoutInput.value, 30, 1, 300)
        }
    };
}

function saveAgentToolDialog(event) {
    event.preventDefault();
    if (state.agentToolDialogIndex == null || !state.agentToolDraft) {
        return;
    }
    syncAgentToolDialogDraft();
    state.agentTools[state.agentToolDialogIndex] = structuredClone(state.agentToolDraft);
    renderAgentToolList(state.agentTools);
    markDirty();
    closeAgentToolDialog(true);
}

function deleteCurrentAgentTool() {
    if (state.agentToolDialogIndex == null) {
        return;
    }
    const index = state.agentToolDialogIndex;
    closeAgentToolDialog(false);
    removeAgentTool(index);
}

function closeAgentToolDialog(keepChanges = false) {
    if (!keepChanges && state.agentToolDialogIndex != null && state.agentToolDraftOriginal) {
        state.agentTools[state.agentToolDialogIndex] = structuredClone(state.agentToolDraftOriginal);
    }
    if (elements.agentToolDialog?.open) {
        elements.agentToolDialog.close();
    }
    resetAgentToolDialogState();
}

function resetAgentToolDialogState() {
    state.agentToolDialogIndex = null;
    state.agentToolDraft = null;
    state.agentToolDraftOriginal = null;
}

function removeAgentTool(index) {
    state.agentTools.splice(index, 1);
    renderAgentToolList(state.agentTools);
    markDirty();
}

function handleAgentToolListClick(event) {
    const editButton = event.target.closest("[data-agent-tool-edit]");
    if (editButton) {
        openAgentToolDialog(Number.parseInt(editButton.dataset.agentToolEdit, 10));
        return;
    }

    const removeButton = event.target.closest("[data-agent-tool-remove]");
    if (removeButton) {
        removeAgentTool(Number.parseInt(removeButton.dataset.agentToolRemove, 10));
    }
}

function collectAgentTools() {
    return normalizeAgentTools(state.agentTools);
}

function normalizeJsonArrayText(value) {
    const text = String(value || "").trim();
    if (!text) {
        return "[]";
    }
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? JSON.stringify(parsed) : "[]";
    } catch {
        return text;
    }
}

function getDatabaseDefaultPort(provider) {
    const ports = {
        sqlserver: 1433,
        mysql: 3306,
        postgres: 5432,
        oracle: 1521,
        sqlite: 0
    };
    return ports[String(provider || "").toLowerCase()] ?? 1433;
}

function detectAgentToolArgumentNames(tool) {
    const values = [
        tool.resource,
        tool.currentTime?.timeZone,
        tool.currentTime?.format,
        tool.http?.url,
        tool.http?.body,
        tool.http?.queryParametersJson,
        tool.http?.headersJson,
        tool.webCrawler?.url,
        tool.webCrawler?.userAgent,
        tool.database?.host,
        tool.database?.database,
        tool.database?.username,
        tool.database?.password,
        tool.database?.sql,
        tool.database?.parametersJson
    ];
    const names = new Set();
    for (const value of values) {
        const text = String(value || "");
        for (const match of text.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
            let name = String(match[1] || "").trim();
            if (name.startsWith("var.")) {
                name = name.slice(4);
            }
            if (name.startsWith("input.")) {
                continue;
            }
            if (name) {
                names.add(name);
            }
        }
    }
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function collectAgent(published) {
    return {
        ...state.agent,
        providerConfigId: elements.providerSelect.value || null,
        instructions: elements.instructionsInput.value.trim(),
        maxIterations: clampInteger(elements.maxIterationsInput?.value, 5, 1, 12),
        timeoutSeconds: clampInteger(elements.timeoutSecondsInput?.value, 180, 1, 600),
        tools: collectAgentTools(),
        openingStatement: state.agent.openingStatement || "你好，我是你的 AI 助手。有什么可以帮你？",
        suggestedQuestions: state.agent.suggestedQuestions || [],
        knowledgeBaseIds: [...state.selectedKnowledgeBaseIds],
        recallRerankModel: state.agent.recallRerankModel || "none",
        recallTopK: clampInteger(state.agent.recallTopK, 4, 1, 12),
        recallScoreThresholdEnabled: !!state.agent.recallScoreThresholdEnabled,
        recallScoreThreshold: clampNumber(state.agent.recallScoreThreshold, 0, 0, 1),
        temperature: state.agent.temperature ?? 0.7,
        maxTokens: state.agent.maxTokens || 2048,
        published: published ?? state.agent.published
    };
}

async function saveAgent(publish) {
    const agent = collectAgent(publish ? true : state.agent.published);

    try {
        const response = await fetch(`/api/conversation-agents/${encodeURIComponent(agent.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(agent)
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        state.agent = await response.json();
        state.dirty = false;
        updateSaveMenu();
        showToast(publish ? "对话 Agent 已发布" : "配置已保存");
        return true;
    } catch (error) {
        showToast(`保存失败：${error.message}`);
        return false;
    }
}

function restoreSavedAgent() {
    elements.saveMenu.hidden = true;
    elements.saveMenuButton.setAttribute("aria-expanded", "false");
    render();
    showToast("已恢复到最近保存的配置");
}

function updateSaveMenu() {
    elements.lastSavedText.textContent = state.agent?.updatedAt
        ? formatRelativeTime(state.agent.updatedAt)
        : "尚未保存";
    elements.restoreButton.disabled = !state.dirty;
}

function formatRelativeTime(value) {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return "刚刚";
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return "刚刚";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
}

function renderPreview() {
    state.previewHistory = [];
    state.previewStepDetails = [];
    elements.previewMessages.innerHTML = "";
    const openingStatement = state.agent?.openingStatement?.trim() || "你好，我是你的 AI 助手。有什么可以帮你？";
    appendPreviewMessage("assistant", openingStatement);
    renderSuggestions();
}

function renderSuggestions() {
    const suggestions = (state.agent?.suggestedQuestions || []).filter(Boolean).slice(0, 4);
    elements.suggestionList.innerHTML = suggestions.map(question =>
        `<button type="button" data-suggestion="${escapeHtml(question)}">${escapeHtml(question)}</button>`
    ).join("");

    elements.suggestionList.querySelectorAll("[data-suggestion]").forEach(button => {
        button.addEventListener("click", () => {
            elements.previewInput.value = button.dataset.suggestion || "";
            elements.previewInput.focus();
        });
    });
}

async function submitPreview(event) {
    event.preventDefault();
    const question = elements.previewInput.value.trim();
    if (!question) return;

    const draftAgent = collectAgent(state.agent?.published);
    appendPreviewMessage("user", question);
    state.previewHistory.push({ role: "user", content: question });
    elements.previewInput.value = "";
    setPreviewBusy(true);
    state.previewAbortController = new AbortController();
    state.previewStepDetails = [{ message: "已提交请求", elapsedMilliseconds: 0 }];
    state.previewStatusMessageId = appendPreviewMessage("assistant", buildRunningStatusText(), false, "status");

    try {
        const response = await fetch(`/api/conversation-agents/${encodeURIComponent(draftAgent.id)}/preview/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: state.previewAbortController.signal,
            body: JSON.stringify({
                agent: draftAgent,
                message: question,
                history: state.previewHistory
            })
        });

        if (!response.ok) {
            throw new Error((await response.text()).replace(/^"|"$/g, ""));
        }

        let completed = false;
        await consumePreviewStream(response, streamEvent => {
            if (Array.isArray(streamEvent.steps) && streamEvent.steps.length) {
                state.previewStepDetails = streamEvent.steps;
            }

            if (streamEvent.type === "preview.progress") {
                updatePreviewMessage(state.previewStatusMessageId, buildRunningStatusText());
                return;
            }

            if (streamEvent.type === "preview.completed") {
                const reply = String(streamEvent.reply || "").trim() || "模型未返回内容。";
                const modeText = formatExecutionModeLabel(streamEvent.executionMode);
                updatePreviewMessage(
                    state.previewStatusMessageId,
                    [buildCompletedStatusText(streamEvent.elapsedMilliseconds, state.previewStepDetails), modeText]
                        .filter(Boolean)
                        .join("\n\n"));
                appendPreviewMessage("assistant", reply);
                state.previewHistory.push({ role: "assistant", content: reply });
                completed = true;
                return;
            }

            if (streamEvent.type === "preview.error") {
                throw new Error(streamEvent.error || "执行失败。");
            }
        });

        if (!completed) {
            throw new Error("预览执行未返回完成结果。");
        }
    } catch (error) {
        const errorMessage = error.name === "AbortError"
            ? "错误：已终止执行。"
            : `错误：${error.message}`;
        updatePreviewMessage(
            state.previewStatusMessageId,
            `${buildRunningStatusText()}\n\n${errorMessage}`,
            true);
    } finally {
        state.previewAbortController = null;
        state.previewStatusMessageId = null;
        setPreviewBusy(false);
        elements.previewInput.focus();
        if (state.currentView === "logs") {
            loadExecutionLogs();
        }
    }
}

function setPreviewBusy(busy) {
    if (elements.previewSubmitButton) {
        elements.previewSubmitButton.hidden = busy;
        elements.previewSubmitButton.disabled = busy;
        elements.previewSubmitButton.textContent = "发送";
    }
    if (elements.stopPreviewButton) {
        elements.stopPreviewButton.hidden = !busy;
        elements.stopPreviewButton.disabled = !busy;
    }
    elements.previewInput.disabled = busy;
    if (busy) {
        startPreviewTimer();
    } else {
        stopPreviewTimer();
    }
}

function stopPreviewExecution() {
    if (!state.previewAbortController) {
        return;
    }
    state.previewAbortController.abort();
}

function startPreviewTimer() {
    stopPreviewTimer();
    state.previewStartedAt = Date.now();
    updatePreviewElapsed();
    state.previewTimer = window.setInterval(updatePreviewElapsed, 1000);
}

function stopPreviewTimer() {
    if (state.previewTimer) {
        window.clearInterval(state.previewTimer);
    }
    state.previewTimer = null;
    state.previewStartedAt = null;
}

function updatePreviewElapsed() {
    if (state.previewStatusMessageId) {
        updatePreviewMessage(state.previewStatusMessageId, buildRunningStatusText());
    }
}

function buildRunningStatusText() {
    return buildStatusText(getPreviewElapsedText(), state.previewStepDetails, true);
}

function buildCompletedStatusText(elapsedMilliseconds, steps) {
    return buildStatusText(`执行时间 ${formatElapsedClock(elapsedMilliseconds)}`, steps, false);
}

function formatExecutionModeText(mode) {
    const normalized = String(mode || "").trim().toLowerCase();
    if (!normalized) {
        return "";
    }
    if (normalized === "native-tools") {
        return "执行模式：Native Tools";
    }
    if (normalized === "standard-chat") {
        return "执行模式：Standard Chat";
    }
    return "执行模式：ReAct";
}

function formatExecutionModeLabel(mode) {
    const normalized = String(mode || "").trim().toLowerCase();
    if (!normalized) {
        return "";
    }
    if (normalized === "native-tools") {
        return "Mode: Native Tools";
    }
    if (normalized === "standard-chat") {
        return "Mode: Standard Chat";
    }
    return "Mode: ReAct";
}

function buildStatusText(elapsedText, steps, running = false) {
    const lines = Array.isArray(steps) && steps.length
        ? steps.map((step, index) => {
            const isLastRunningStep = running && index === steps.length - 1;
            const message = isLastRunningStep && !String(step.message || "").endsWith("...")
                ? `${step.message}...`
                : step.message;
            return `${index + 1}. [耗时 ${formatStepDuration(steps, index)}] ${message}`;
        })
        : [`1. [耗时 ${formatDuration(0)}] 已提交请求${running ? "..." : ""}`];
    return `${elapsedText}\n\n执行步骤\n${lines.join("\n")}`;
}

function formatStepDuration(steps, index) {
    const current = Number(steps[index]?.elapsedMilliseconds || 0);
    const previous = index > 0 ? Number(steps[index - 1]?.elapsedMilliseconds || 0) : 0;
    return formatDuration(Math.max(0, current - previous));
}

function formatDuration(milliseconds) {
    const safeMilliseconds = Math.max(0, Math.floor(Number(milliseconds || 0)));
    const minutes = Math.floor(safeMilliseconds / 60000);
    const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
    const ms = safeMilliseconds % 1000;
    const parts = [];

    if (minutes > 0) {
        parts.push(`${minutes}分`);
    }
    if (seconds > 0) {
        parts.push(`${seconds}秒`);
    }
    if (ms > 0 || parts.length === 0) {
        parts.push(`${ms}毫秒`);
    }

    return parts.join("");
}

function getPreviewElapsedText() {
    const milliseconds = state.previewStartedAt
        ? Math.max(0, Date.now() - state.previewStartedAt)
        : 0;
    return `执行时间 ${formatElapsedClock(milliseconds)}`;
}

function formatElapsedClock(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
    const minutesPart = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const secondsPart = String(totalSeconds % 60).padStart(2, "0");
    return `${minutesPart}:${secondsPart}`;
}

function appendPreviewMessage(role, text, isError = false, extraClass = "") {
    const article = document.createElement("div");
    article.className = `preview-message ${role}${isError ? " error" : ""}${extraClass ? ` ${extraClass}` : ""}`;
    article.dataset.messageId = crypto.randomUUID();
    article.innerHTML = '<div class="bubble"></div>';
    article.querySelector(".bubble").textContent = text;
    elements.previewMessages.appendChild(article);
    article.scrollIntoView({ behavior: "smooth", block: "end" });
    return article.dataset.messageId;
}

function updatePreviewMessage(messageId, text, isError = false) {
    if (!messageId) {
        return;
    }
    const article = elements.previewMessages.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!article) {
        return;
    }
    article.classList.toggle("error", isError);
    const bubble = article.querySelector(".bubble");
    if (bubble) {
        bubble.textContent = text;
    }
    article.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function consumePreviewStream(response, onEvent) {
    if (!response.body) {
        throw new Error("浏览器不支持流式预览。");
    }

    await EaseGptSse.consume(response.body, onEvent);
}

async function submitLogFilters(event) {
    event.preventDefault();
    const range = validateLogDateRange(elements.logsStartInput, elements.logsEndInput);
    if (!range) {
        return;
    }

    state.logFilters.from = elements.logsStartInput?.value || "";
    state.logFilters.to = elements.logsEndInput?.value || "";
    state.logFilters.keyword = elements.logsKeywordInput?.value.trim() || "";
    await loadExecutionLogs();
}

async function loadExecutionLogs() {
    if (!state.agent?.id) {
        return;
    }

    const params = new URLSearchParams();
    if (state.logFilters.from) {
        params.set("from", parseLogDateTime(state.logFilters.from).toISOString());
    }
    if (state.logFilters.to) {
        params.set("to", parseLogDateTime(state.logFilters.to).toISOString());
    }
    if (state.logFilters.keyword) {
        params.set("keyword", state.logFilters.keyword);
    }

    try {
        const response = await fetch(`/api/conversation-agents/${encodeURIComponent(state.agent.id)}/executions?${params.toString()}`, {
            cache: "no-store"
        });
        if (!response.ok) {
            throw new Error(await response.text());
        }
        state.executions = await response.json();
        renderExecutionLogs();
    } catch (error) {
        state.executions = [];
        renderExecutionLogs(`日志加载失败：${error.message}`);
    }
}

function renderExecutionLogs(errorMessage = "") {
    if (elements.logsStartInput) {
        elements.logsStartInput.value = state.logFilters.from;
    }
    if (elements.logsEndInput) {
        elements.logsEndInput.value = state.logFilters.to;
    }
    if (elements.logsKeywordInput) {
        elements.logsKeywordInput.value = state.logFilters.keyword;
    }

    if (errorMessage) {
        elements.logsTableBody.innerHTML = "";
        elements.logsEmpty.hidden = false;
        elements.logsEmpty.textContent = errorMessage;
        return;
    }

    elements.logsTableBody.innerHTML = state.executions.map(renderExecutionRow).join("");
    elements.logsEmpty.hidden = state.executions.length > 0;
    elements.logsEmpty.textContent = "暂无执行记录";
}

function renderExecutionRow(item) {
    const conversationParts = [];
    const history = Array.isArray(item.history) ? item.history : [];
    if (history.length) {
        conversationParts.push(...history.map(entry => `${entry.role === "assistant" ? "AI" : "用户"}：${entry.content || ""}`));
    }
    conversationParts.push(`本轮提问：${item.message || ""}`);

    const resultText = item.status === "Failed" || item.status === "Cancelled"
        ? (item.error || "执行失败")
        : (item.reply || "");

    const modeText = formatExecutionModeLabel(item.executionMode);

    return `<tr>
        <td>${escapeHtml(formatLogDateTime(item.startedAt))}</td>
        <td>${renderLogStatusBadge(item.status)}</td>
        <td>${escapeHtml(conversationParts.join("\n"))}</td>
        <td>${escapeHtml([modeText, resultText].filter(Boolean).join("\n"))}</td>
        <td>${escapeHtml(formatDuration(item.elapsedMilliseconds || 0))}</td>
    </tr>`;
}

function renderLogStatusBadge(status) {
    const normalized = String(status || "").toLowerCase();
    const label = normalized === "completed"
        ? "成功"
        : normalized === "cancelled"
            ? "已终止"
            : "失败";
    const cssClass = normalized === "completed"
        ? "completed"
        : normalized === "cancelled"
            ? "cancelled"
            : "failed";
    return `<span class="logs-status-badge ${cssClass}">${escapeHtml(label)}</span>`;
}

function formatLogDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "-";
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function initializeLogFilterInputs() {
    if (elements.logsStartInput) {
        elements.logsStartInput.value = state.logFilters.from;
    }
    if (elements.logsEndInput) {
        elements.logsEndInput.value = state.logFilters.to;
    }
}

function createDefaultLogRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return {
        from: formatLogInputDateTime(start),
        to: formatLogInputDateTime(end)
    };
}

function formatLogInputDateTime(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-") + " " + [
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0"),
        String(date.getSeconds()).padStart(2, "0")
    ].join(":");
}

function parseLogDateTime(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second] = match.map(Number);
    const date = new Date(year, month - 1, day, hour, minute, second);
    const isValid = date.getFullYear() === year
        && date.getMonth() === month - 1
        && date.getDate() === day
        && date.getHours() === hour
        && date.getMinutes() === minute
        && date.getSeconds() === second;
    return isValid ? date : null;
}

function validateLogDateRange(startInput, endInput) {
    startInput.setCustomValidity("");
    endInput.setCustomValidity("");
    const start = parseLogDateTime(startInput.value);
    const end = parseLogDateTime(endInput.value);

    if (!start) {
        startInput.setCustomValidity("请输入 yyyy-MM-dd HH:mm:ss 格式的开始时间");
        startInput.reportValidity();
        return null;
    }
    if (!end) {
        endInput.setCustomValidity("请输入 yyyy-MM-dd HH:mm:ss 格式的结束时间");
        endInput.reportValidity();
        return null;
    }
    if (start > end) {
        endInput.setCustomValidity("结束时间不能早于开始时间");
        endInput.reportValidity();
        return null;
    }
    return { start, end };
}

function markDirty() {
    if (!state.agent) return;
    state.dirty = true;
    updateSaveMenu();
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function providerLogoHtml(providerId) {
    const src = providerLogoSrc(providerId);
    if (src) {
        return `<span class="floating-model-logo has-image"><img src="${escapeHtml(src)}" alt=""></span>`;
    }

    const fallback = {
        system: "系",
        none: "关",
        knowledge: "知",
        deepseek: "D",
        ollama: "O",
        openai: "O",
        qwen: "Q",
        doubao: "豆"
    };
    return `<span class="floating-model-logo">${escapeHtml(fallback[providerId] || "?")}</span>`;
}

function providerLogoSrc(providerId) {
    const logos = {
        system: "/assets/setting.svg",
        none: "/assets/setting.svg",
        knowledge: "/assets/knowledge.svg",
        deepseek: "/assets/deepseek.svg",
        gemini: "/assets/gemini.svg",
        hunyuan: "/assets/tencent.png",
        ollama: "/assets/Ollama.svg",
        openai: "/assets/OpenAI.svg",
        qwen: "/assets/tongyi.svg",
        doubao: "/assets/Volcengine.svg",
        vllm: "/assets/vLLM.svg",
        zhipu: "/assets/ZHIPU.svg"
    };
    return logos[String(providerId || "").toLowerCase()] || "";
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character]);
}

async function runAgent() {
    elements.saveMenu.hidden = true;
    elements.saveMenuButton.setAttribute("aria-expanded", "false");
    const saved = await saveAgent(false);
    if (!saved) return;
    window.open(`/ai-agent/${encodeURIComponent(state.agent.id)}`, "_blank", "noopener");
    showToast("配置已保存，已打开运行界面");
}
