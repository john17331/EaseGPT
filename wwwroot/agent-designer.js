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

const elements = {
    agentIcon: document.querySelector("#agentIcon"),
    agentName: document.querySelector("#agentName"),
    agentDescription: document.querySelector("#agentDescription"),
    providerSelect: document.querySelector("#providerSelect"),
    providerPicker: document.querySelector("#providerPicker"),
    instructionsInput: document.querySelector("#instructionsInput"),
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
elements.knowledgeRecallButton?.addEventListener("click", openRecallSettingsDialog);
elements.closeRecallSettingsButton?.addEventListener("click", closeRecallSettingsDialog);
elements.cancelRecallSettingsButton?.addEventListener("click", closeRecallSettingsDialog);
elements.recallSettingsForm?.addEventListener("submit", saveRecallSettings);
elements.recallTopKInput?.addEventListener("input", syncRecallTopKFromInput);
elements.recallTopKRange?.addEventListener("input", syncRecallTopKFromRange);
elements.recallScoreThresholdEnabled?.addEventListener("change", syncRecallThresholdUi);
elements.recallScoreThresholdInput?.addEventListener("input", syncRecallThresholdFromInput);
elements.recallScoreThresholdRange?.addEventListener("input", syncRecallThresholdFromRange);
window.addEventListener("resize", () => {
    updateRangeProgress(elements.recallTopKRange);
    updateRangeProgress(elements.recallScoreThresholdRange);
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
    elements.agentIcon.innerHTML = `<img src="${escapeAttribute(agent.icon || defaultAgentIcon)}" alt="">`;
    elements.agentName.textContent = agent.name;
    elements.agentDescription.textContent = agent.description || "暂无 Agent 描述";

    renderProviderOptions();
    renderKnowledgeOptions();
    elements.instructionsInput.value = agent.instructions || "";
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

function collectAgent(published) {
    return {
        ...state.agent,
        providerConfigId: elements.providerSelect.value || null,
        instructions: elements.instructionsInput.value.trim(),
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
                updatePreviewMessage(
                    state.previewStatusMessageId,
                    buildCompletedStatusText(streamEvent.elapsedMilliseconds, state.previewStepDetails));
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

    return `<tr>
        <td>${escapeHtml(formatLogDateTime(item.startedAt))}</td>
        <td>${renderLogStatusBadge(item.status)}</td>
        <td>${escapeHtml(conversationParts.join("\n"))}</td>
        <td>${escapeHtml(resultText)}</td>
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
        ollama: "/assets/Ollama.svg",
        openai: "/assets/OpenAI.svg",
        qwen: "/assets/tongyi.svg",
        doubao: "/assets/Volcengine.svg"
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
