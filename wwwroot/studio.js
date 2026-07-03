const state = {
    type: "agent",
    agents: [],
    workflows: [],
    knowledgeBases: [],
    providerConfigs: [],
    providers: [],
    query: "",
    createType: "agent",
    editingId: null,
    editingProviderId: null,
    setupProviderId: null,
    discoveredModels: [],
    providerModelListsCollapsed: {},
    queuedProviderIds: new Set()
};

const maxIconFileSize = 1024 * 1024;
const defaultWorkflowIcon = "/assets/easegpt.svg";
const defaultKnowledgeIcon = "/assets/knowledge.svg";
const defaultAgentIcon = "/assets/agentchat.svg";

const elements = {
    collapseButton: document.querySelector("#collapseButton"),
    resourceTitle: document.querySelector("#resourceTitle"),
    createResourceButton: document.querySelector("#createResourceButton"),
    resourceSearchInput: document.querySelector("#resourceSearchInput"),
    resourceGrid: document.querySelector("#resourceGrid"),
    resourceEmpty: document.querySelector("#resourceEmpty"),
    emptyTitle: document.querySelector("#emptyTitle"),
    emptyDescription: document.querySelector("#emptyDescription"),
    modelConfigPanel: document.querySelector("#modelConfigPanel"),
    modelConfigList: document.querySelector("#modelConfigList"),
    modelConfigEmpty: document.querySelector("#modelConfigEmpty"),
    pendingProviderSection: document.querySelector("#pendingProviderSection"),
    pendingProviderList: document.querySelector("#pendingProviderList"),
    availableProviderList: document.querySelector("#availableProviderList"),
    createResourceDialog: document.querySelector("#createResourceDialog"),
    createResourceForm: document.querySelector("#createResourceForm"),
    createResourceTitle: document.querySelector("#createResourceTitle"),
    closeCreateResourceButton: document.querySelector("#closeCreateResourceButton"),
    cancelCreateResourceButton: document.querySelector("#cancelCreateResourceButton"),
    confirmCreateResourceButton: document.querySelector("#confirmCreateResourceButton"),
    newResourceNameInput: document.querySelector("#newResourceNameInput"),
    newResourceIconInput: document.querySelector("#newResourceIconInput"),
    resourceIconFileInput: document.querySelector("#resourceIconFileInput"),
    resourceIconPreview: document.querySelector("#resourceIconPreview"),
    newResourceDescriptionInput: document.querySelector("#newResourceDescriptionInput"),
    modelConfigDialog: document.querySelector("#modelConfigDialog"),
    modelConfigForm: document.querySelector("#modelConfigForm"),
    modelConfigDialogTitle: document.querySelector("#modelConfigDialogTitle"),
    closeModelConfigButton: document.querySelector("#closeModelConfigButton"),
    cancelModelConfigButton: document.querySelector("#cancelModelConfigButton"),
    saveModelConfigButton: document.querySelector("#saveModelConfigButton"),
    modelConfigProviderSummary: document.querySelector("#modelConfigProviderSummary"),
    modelConfigNameField: document.querySelector("#modelConfigNameField"),
    modelConfigProviderField: document.querySelector("#modelConfigProviderField"),
    modelConfigModelField: document.querySelector("#modelConfigModelField"),
    modelConfigTypeField: document.querySelector("#modelConfigTypeField"),
    modelConfigEndpointField: document.querySelector("#modelConfigEndpointField"),
    modelConfigApiKeyField: document.querySelector("#modelConfigApiKeyField"),
    modelConfigContextLengthField: document.querySelector("#modelConfigContextLengthField"),
    modelConfigNameInput: document.querySelector("#modelConfigNameInput"),
    modelConfigProviderInput: document.querySelector("#modelConfigProviderInput"),
    modelConfigModelInput: document.querySelector("#modelConfigModelInput"),
    modelConfigEndpointInput: document.querySelector("#modelConfigEndpointInput"),
    modelConfigApiKeyInput: document.querySelector("#modelConfigApiKeyInput"),
    modelConfigContextLengthInput: document.querySelector("#modelConfigContextLengthInput"),
    modelConfigTypeInputs: Array.from(document.querySelectorAll("input[name='modelConfigType']")),
    modelConfigEnabledInput: document.querySelector("#modelConfigEnabledInput"),
    providerSetupDialog: document.querySelector("#providerSetupDialog"),
    providerSetupForm: document.querySelector("#providerSetupForm"),
    providerSetupTitle: document.querySelector("#providerSetupTitle"),
    providerSetupDescription: document.querySelector("#providerSetupDescription"),
    closeProviderSetupButton: document.querySelector("#closeProviderSetupButton"),
    cancelProviderSetupButton: document.querySelector("#cancelProviderSetupButton"),
    providerApiAddressInput: document.querySelector("#providerApiAddressInput"),
    providerApiKeyInput: document.querySelector("#providerApiKeyInput"),
    enableProviderButton: document.querySelector("#enableProviderButton"),
    toast: document.querySelector("#toast")
};

elements.collapseButton.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("sidebar-collapsed");
    elements.collapseButton.classList.toggle("is-collapsed", collapsed);
    elements.collapseButton.setAttribute("aria-label", collapsed ? "展开侧边栏" : "收起侧边栏");
    elements.collapseButton.setAttribute("title", collapsed ? "展开侧边栏" : "收起侧边栏");
});

document.querySelectorAll("[data-resource]").forEach(button => button.addEventListener("click", () => {
    state.type = button.dataset.resource;
    state.query = "";
    elements.resourceSearchInput.value = "";
    document.querySelectorAll("[data-resource]").forEach(item => item.classList.toggle("active", item === button));
    render();
}));

elements.resourceSearchInput.addEventListener("input", () => {
    state.query = elements.resourceSearchInput.value.trim().toLocaleLowerCase();
    if (state.type === "model-config") renderModelConfigList();
    else renderGrid();
});

elements.createResourceButton.addEventListener("click", () => {
    if (state.type === "model-config") openModelConfigDialog();
    else openCreateResourceDialog(state.type);
});
elements.resourceGrid.addEventListener("click", handleGridClick);
elements.resourceGrid.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("studio-card")) {
        event.preventDefault();
        openDesignWindow(event.target.dataset.openUrl);
    }
});
elements.modelConfigList.addEventListener("click", handleModelConfigListClick);
elements.pendingProviderList.addEventListener("click", handleProviderListClick);
elements.availableProviderList.addEventListener("click", handleProviderListClick);
document.addEventListener("click", closeCardMenus);
document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeCardMenus();
});

elements.closeCreateResourceButton.addEventListener("click", closeCreateResourceDialog);
elements.cancelCreateResourceButton.addEventListener("click", closeCreateResourceDialog);
elements.resourceIconFileInput.addEventListener("change", loadIconFile);
elements.createResourceForm.addEventListener("submit", saveResource);

elements.closeModelConfigButton.addEventListener("click", closeModelConfigDialog);
elements.cancelModelConfigButton.addEventListener("click", closeModelConfigDialog);
elements.modelConfigForm.addEventListener("submit", saveModelConfig);
elements.closeProviderSetupButton.addEventListener("click", closeProviderSetupDialog);
elements.cancelProviderSetupButton.addEventListener("click", closeProviderSetupDialog);
elements.providerSetupForm.addEventListener("submit", enableProviderModels);

initialize();

async function initialize() {
    await loadResources();
}

async function loadResources() {
    try {
        const [agentResponse, workflowResponse, knowledgeResponse, providerConfigResponse, providersResponse] = await Promise.all([
            fetch("/api/conversation-agents", { cache: "no-store" }),
            fetch("/api/workflows", { cache: "no-store" }),
            fetch("/api/knowledge-bases", { cache: "no-store" }),
            fetch("/api/llm-provider-configs", { cache: "no-store" }),
            fetch("/api/llm-providers", { cache: "no-store" })
        ]);
        if (!agentResponse.ok) throw new Error(await agentResponse.text());
        if (!workflowResponse.ok) throw new Error(await workflowResponse.text());
        if (!knowledgeResponse.ok) throw new Error(await knowledgeResponse.text());
        if (!providerConfigResponse.ok) throw new Error(await providerConfigResponse.text());
        if (!providersResponse.ok) throw new Error(await providersResponse.text());
        state.agents = await agentResponse.json();
        state.workflows = await workflowResponse.json();
        state.knowledgeBases = await knowledgeResponse.json();
        state.providerConfigs = await providerConfigResponse.json();
        state.providers = await providersResponse.json();
        render();
    } catch (error) {
        showToast(`资源加载失败：${error.message}`);
        render();
    }
}

function render() {
    const meta = resourceMeta(state.type);
    const modelConfigMode = state.type === "model-config";
    elements.resourceTitle.textContent = meta.title;
    elements.createResourceButton.textContent = meta.createLabel;
    elements.createResourceButton.setAttribute("aria-label", meta.createLabel);
    elements.createResourceButton.setAttribute("title", meta.createLabel);
    elements.resourceSearchInput.placeholder = meta.searchPlaceholder;
    document.querySelector(".studio-heading-actions")?.toggleAttribute("hidden", modelConfigMode);
    elements.resourceGrid.hidden = modelConfigMode;
    elements.resourceEmpty.hidden = true;
    elements.modelConfigPanel.hidden = !modelConfigMode;

    if (modelConfigMode) renderModelConfigList();
    else renderGrid();
}

function renderGrid() {
    const meta = resourceMeta(state.type);
    const source = getResourceList(state.type);
    const items = state.query ? source.filter(item => (item.name || "").toLocaleLowerCase().includes(state.query)) : source;
    const renderer = state.type === "knowledge" ? knowledgeCardHtml : state.type === "agent" ? agentCardHtml : workflowCardHtml;
    elements.resourceGrid.innerHTML = items.map(renderer).join("");
    elements.resourceEmpty.hidden = items.length > 0;
    elements.emptyTitle.textContent = state.query ? `未找到匹配${meta.itemLabel}` : `暂无${meta.itemLabel}`;
    elements.emptyDescription.textContent = state.query ? `没有名称包含“${elements.resourceSearchInput.value.trim()}”的资源` : `当前还没有可设计的${meta.itemLabel}`;
}

function renderModelConfigList() {
    const matches = item => !state.query
        || [item.name, item.description, item.id, item.apiAddress]
            .some(value => (value || "").toLocaleLowerCase().includes(state.query));
    const configsByProvider = new Map();
    for (const config of state.providerConfigs) {
        const list = configsByProvider.get(config.provider) || [];
        list.push(config);
        configsByProvider.set(config.provider, list);
    }

    const configuredProviders = state.providers.filter(provider => {
        const configs = configsByProvider.get(provider.id) || [];
        return configs.length > 0 && (matches(provider) || configs.some(config => matches(config)));
    });
    const pendingProviders = state.providers.filter(provider => {
        const configs = configsByProvider.get(provider.id) || [];
        return configs.length === 0
            && state.queuedProviderIds.has(provider.id)
            && matches(provider);
    });
    const availableProviders = state.providers.filter(provider => {
        const configs = configsByProvider.get(provider.id) || [];
        return !configs.some(config => config.enabled)
            && !state.queuedProviderIds.has(provider.id)
            && matches(provider);
    });
    const customConfigs = state.providerConfigs.filter(config =>
        !state.providers.some(provider => provider.id === config.provider)
        && (!state.query || matches(config)));

    elements.modelConfigList.innerHTML = [
        ...configuredProviders.map(provider => providerConfigCardHtml(provider, configsByProvider.get(provider.id) || [])),
        ...customConfigs.map(modelConfigCardHtml)
    ].join("");
    elements.modelConfigEmpty.hidden = configuredProviders.length > 0 || customConfigs.length > 0;
    elements.pendingProviderSection.hidden = pendingProviders.length === 0;
    elements.pendingProviderList.innerHTML = pendingProviders.map(providerPendingCardHtml).join("");
    elements.availableProviderList.innerHTML = availableProviders.map(providerMarketCardHtml).join("")
        || `<div class="provider-market-empty">没有更多待配置的供应商</div>`;
}

function openCreateResourceDialog(type) {
    state.createType = normalizeResourceType(type);
    state.editingId = null;
    const meta = resourceMeta(state.createType);
    elements.createResourceTitle.textContent = meta.createLabel;
    elements.confirmCreateResourceButton.textContent = "确定";
    elements.newResourceNameInput.placeholder = meta.namePlaceholder;
    elements.newResourceDescriptionInput.placeholder = meta.descriptionPlaceholder;
    elements.createResourceForm.reset();
    elements.resourceIconFileInput.value = "";
    elements.newResourceIconInput.value = meta.defaultIcon;
    updateIconPreview();
    elements.createResourceDialog.showModal();
    window.setTimeout(() => elements.newResourceNameInput.focus(), 0);
}

function openEditResourceDialog(type, id) {
    state.createType = normalizeResourceType(type);
    state.editingId = id;
    const item = getResourceList(state.createType).find(resource => resource.id === id);
    if (!item) return;
    const meta = resourceMeta(state.createType);
    elements.createResourceTitle.textContent = `编辑${meta.itemLabel}`;
    elements.confirmCreateResourceButton.textContent = "保存";
    elements.newResourceNameInput.placeholder = meta.namePlaceholder;
    elements.newResourceDescriptionInput.placeholder = meta.descriptionPlaceholder;
    elements.createResourceForm.reset();
    elements.newResourceNameInput.value = item.name || "";
    elements.newResourceIconInput.value = item.icon || meta.defaultIcon;
    elements.resourceIconFileInput.value = "";
    elements.newResourceDescriptionInput.value = item.description || "";
    updateIconPreview();
    elements.createResourceDialog.showModal();
    window.setTimeout(() => elements.newResourceNameInput.focus(), 0);
}

function closeCreateResourceDialog() {
    if (!elements.createResourceDialog.open) return;
    elements.createResourceDialog.close();
    state.editingId = null;
}

function updateIconPreview() {
    const icon = elements.newResourceIconInput.value.trim();
    elements.resourceIconPreview.classList.toggle("has-image", isImageIcon(icon));
    elements.resourceIconPreview.innerHTML = icon ? resourceIconPreviewHtml(icon) : "";
}

function resourceIconPreviewHtml(icon) {
    return isImageIcon(icon) ? `<img src="${escapeAttribute(icon)}" alt="">` : escapeHtml(icon);
}

function loadIconFile() {
    const file = elements.resourceIconFileInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        showToast("请选择图片文件");
        elements.resourceIconFileInput.value = "";
        return;
    }
    if (file.size > maxIconFileSize) {
        showToast("图标图片不能超过 1MB");
        elements.resourceIconFileInput.value = "";
        return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
        elements.newResourceIconInput.value = String(reader.result || "");
        updateIconPreview();
    });
    reader.addEventListener("error", () => showToast("图标读取失败"));
    reader.readAsDataURL(file);
}

async function saveResource(event) {
    event.preventDefault();
    const name = elements.newResourceNameInput.value.trim();
    if (!name) {
        elements.newResourceNameInput.focus();
        return;
    }

    const meta = resourceMeta(state.createType);
    const editing = Boolean(state.editingId);
    const designWindow = editing ? null : window.open("about:blank", "_blank");
    elements.confirmCreateResourceButton.disabled = true;
    elements.confirmCreateResourceButton.textContent = editing ? "保存中..." : "创建中...";
    try {
        const description = elements.newResourceDescriptionInput.value.trim() || null;
        const icon = elements.newResourceIconInput.value.trim() || null;
        const item = editing
            ? await updateResource(state.createType, state.editingId, name, description, icon)
            : await request(meta.apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, icon })
            });

        if (editing) replaceResource(state.createType, item);
        else getResourceList(state.createType).unshift(item);

        closeCreateResourceDialog();
        render();
        if (!editing) {
            const designUrl = meta.designUrl(item.id);
            if (designWindow) {
                designWindow.opener = null;
                designWindow.location.href = designUrl;
            } else {
                window.open(designUrl, "_blank", "noopener");
            }
        }
        showToast(editing ? "已保存修改" : `${meta.itemLabel}已创建`);
    } catch (error) {
        if (designWindow) designWindow.close();
        showToast(`${editing ? "保存" : "创建"}失败：${error.message}`);
    } finally {
        elements.confirmCreateResourceButton.disabled = false;
        elements.confirmCreateResourceButton.textContent = editing ? "保存" : "确定";
    }
}

function openModelConfigDialog(id = null, options = {}) {
    state.editingProviderId = id;
    const item = id ? state.providerConfigs.find(config => config.id === id) : null;
    const providerPreset = options.providerId ? state.providers.find(provider => provider.id === options.providerId) : null;
    const summaryProvider = providerPreset || (item ? state.providers.find(provider => provider.id === item.provider) : null);
    const providerName = summaryProvider?.name || item?.provider || "";
    const providerLogo = summaryProvider ? providerLogoContent(summaryProvider) : "";
    elements.modelConfigDialogTitle.textContent = item ? "编辑模型配置" : "添加模型";
    elements.saveModelConfigButton.textContent = item ? "保存" : "添加";
    elements.modelConfigForm.reset();
    elements.modelConfigProviderSummary.hidden = !summaryProvider;
    elements.modelConfigProviderSummary.innerHTML = summaryProvider
        ? `<span class="provider-summary-logo">${providerLogo}</span><span class="provider-summary-copy"><strong>${escapeHtml(providerName)}</strong><small>${escapeHtml(summaryProvider.id)}</small></span>`
        : "";
    elements.modelConfigNameField.hidden = true;
    elements.modelConfigProviderField.hidden = Boolean(providerPreset);
    elements.modelConfigEndpointField.hidden = Boolean(providerPreset);
    elements.modelConfigApiKeyField.classList.toggle("is-full-width", Boolean(providerPreset));
    elements.modelConfigNameInput.value = item?.name || "";
    elements.modelConfigProviderInput.value = item?.provider || providerPreset?.id || "";
    elements.modelConfigModelInput.value = item?.model || "";
    setModelConfigType(item?.modelType || "llm");
    elements.modelConfigEndpointInput.value = item?.endpoint || providerPreset?.apiAddress || "";
    elements.modelConfigApiKeyInput.value = "";
    elements.modelConfigContextLengthInput.value = String(item?.contextLength || 4096);
    elements.modelConfigEnabledInput.checked = item?.enabled ?? true;
    elements.modelConfigProviderInput.readOnly = Boolean(options.lockProvider && providerPreset);
    applyModelConfigFieldRequirements();
    elements.modelConfigDialog.showModal();
    window.setTimeout(() => elements.modelConfigModelInput.focus(), 0);
}

function closeModelConfigDialog() {
    if (!elements.modelConfigDialog.open) return;
    elements.modelConfigDialog.close();
    state.editingProviderId = null;
    elements.modelConfigProviderInput.readOnly = false;
    elements.modelConfigProviderSummary.hidden = true;
    elements.modelConfigProviderSummary.innerHTML = "";
    elements.modelConfigNameField.hidden = true;
    elements.modelConfigProviderField.hidden = false;
    elements.modelConfigEndpointField.hidden = false;
    elements.modelConfigApiKeyField.classList.remove("is-full-width");
    setModelConfigType("llm");
    elements.modelConfigContextLengthInput.value = "4096";
    applyModelConfigFieldRequirements();
}

function applyModelConfigFieldRequirements() {
    elements.modelConfigNameInput.required = false;
    elements.modelConfigProviderInput.required = !elements.modelConfigProviderField.hidden;
    elements.modelConfigModelInput.required = true;
    elements.modelConfigEndpointInput.required = !elements.modelConfigEndpointField.hidden;
    elements.modelConfigApiKeyInput.required = true;
    elements.modelConfigContextLengthInput.required = true;
}

function getSelectedModelConfigType() {
    return elements.modelConfigTypeInputs.find(input => input.checked)?.value || "llm";
}

function setModelConfigType(type) {
    const normalizedType = (type || "llm").toLocaleLowerCase();
    let matched = false;
    for (const input of elements.modelConfigTypeInputs) {
        const checked = input.value === normalizedType;
        input.checked = checked;
        matched ||= checked;
    }
    if (!matched && elements.modelConfigTypeInputs[0]) {
        elements.modelConfigTypeInputs[0].checked = true;
    }
}

async function saveModelConfig(event) {
    event.preventDefault();
    const provider = elements.modelConfigProviderInput.value.trim();
    const model = elements.modelConfigModelInput.value.trim();
    const endpoint = elements.modelConfigEndpointInput.value.trim();
    const apiKey = elements.modelConfigApiKeyInput.value.trim();
    const modelType = getSelectedModelConfigType();
    const contextLength = Number.parseInt(elements.modelConfigContextLengthInput.value, 10) || 4096;
    const name = elements.modelConfigNameInput.value.trim() || generateModelConfigName(provider, model);
    if (!provider) return elements.modelConfigProviderInput.focus();
    if (!model) return elements.modelConfigModelInput.focus();
    if (!endpoint) return elements.modelConfigEndpointInput.focus();
    if (!apiKey) return elements.modelConfigApiKeyInput.focus();
    if (contextLength <= 0) return elements.modelConfigContextLengthInput.focus();

    const body = {
        name,
        provider,
        model,
        modelType,
        endpoint,
        apiKey,
        contextLength,
        enabled: elements.modelConfigEnabledInput.checked
    };

    elements.saveModelConfigButton.disabled = true;
    elements.saveModelConfigButton.textContent = state.editingProviderId ? "保存中..." : "添加中...";
    try {
        const item = state.editingProviderId
            ? await request(`/api/llm-provider-configs/${encodeURIComponent(state.editingProviderId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            })
            : await request("/api/llm-provider-configs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

        if (state.editingProviderId) replaceProviderConfig(item);
        else state.providerConfigs.unshift(item);
        closeModelConfigDialog();
        renderModelConfigList();
        showToast(state.editingProviderId ? "模型配置已保存" : "模型配置已新增");
    } catch (error) {
        showToast(`保存失败：${error.message}`);
    } finally {
        elements.saveModelConfigButton.disabled = false;
        elements.saveModelConfigButton.textContent = state.editingProviderId ? "保存" : "添加";
    }
}

function providerConfigCardHtml(provider, configs) {
    const totalConfigs = configs.length;
    const enabledConfigCount = configs.filter(config => config.enabled).length;
    const collapsed = state.providerModelListsCollapsed[provider.id] ?? true;
    return `<article class="provider-config-card">
        <div class="provider-config-summary">
            <div class="provider-brand">
                <span class="provider-logo provider-logo--${escapeAttribute(provider.id)}${providerLogoHasImage(provider) ? " has-image" : ""}">${providerLogoContent(provider)}</span>
                <span>
                    <strong>${escapeHtml(provider.name)}</strong>
                    <small>${escapeHtml(provider.description || provider.apiAddress)}</small>
                </span>
            </div>
            <div class="provider-config-status">
                <span>${enabledConfigCount} 个模型</span>
                <i aria-hidden="true"></i>
                <button type="button" data-provider-action="configure" data-provider-id="${escapeAttribute(provider.id)}">配置</button>
            </div>
        </div>
        <div class="provider-model-list-card"${collapsed ? " hidden" : ""}>
            <div class="provider-model-list-heading">
                <span>${enabledConfigCount} / ${totalConfigs} 已启用</span>
                <button type="button" class="provider-model-list-toggle" data-provider-action="toggle-model-list" data-provider-id="${escapeAttribute(provider.id)}">${collapsed ? "展开" : "收起"}</button>
            </div>
            <div class="provider-model-rows">
                ${configs.map(config => providerModelRowHtml(provider, config)).join("")}
            </div>
        </div>
        <div class="provider-config-footer">
            <span>${provider.hasDefaultApiKey ? "API Key 已保存" : "使用模型配置中的 API Key"}</span>
            <div class="provider-config-footer-actions">
                <button type="button" class="provider-config-footer-toggle" data-provider-action="toggle-model-list" data-provider-id="${escapeAttribute(provider.id)}">${collapsed ? "展开列表" : "收起列表"}</button>
                <button type="button" data-provider-action="add-model" data-provider-id="${escapeAttribute(provider.id)}">添加模型</button>
            </div>
        </div>
    </article>`;
}

function providerPendingCardHtml(provider) {
    return `<article class="provider-pending-card">
        <div class="provider-brand">
            <span class="provider-logo provider-logo--${escapeAttribute(provider.id)}${providerLogoHasImage(provider) ? " has-image" : ""}">${providerLogoContent(provider)}</span>
            <span>
                <strong>${escapeHtml(provider.name)}</strong>
                <small>${escapeHtml(provider.description || "")}</small>
            </span>
        </div>
        <div class="provider-pending-state">
            <span>待选择模型 <i aria-hidden="true"></i></span>
            <button type="button" data-provider-action="configure" data-provider-id="${escapeAttribute(provider.id)}">设置</button>
        </div>
    </article>`;
}

function providerModelRowHtml(provider, config) {
    const available = Boolean(config.enabled);
    return `<div class="provider-model-row${available ? "" : " is-disabled"}">
        <span class="provider-model-row-main">
            <span class="provider-model-row-copy">
                <strong>${escapeHtml(config.model || config.name)}</strong>
                <span class="provider-model-row-tags">
                    ${modelCapabilityTagsHtml(config)}
                </span>
            </span>
        </span>
        <button class="provider-model-toggle${available ? " is-on" : ""}" type="button" data-model-toggle data-model-id="${escapeAttribute(config.id)}" aria-label="${available ? "禁用模型" : "启用模型"}" title="${available ? "禁用模型" : "启用模型"}"><i></i></button>
    </div>`;
}

function providerMarketCardHtml(provider) {
    return `<article class="provider-market-card">
        <span class="provider-logo provider-logo--${escapeAttribute(provider.id)}${providerLogoHasImage(provider) ? " has-image" : ""}">${providerLogoContent(provider)}</span>
        <span class="provider-market-copy">
            <strong>${escapeHtml(provider.name)}</strong>
            <small>${escapeHtml(provider.id)}</small>
            <p>${escapeHtml(provider.description || "OpenAI 兼容模型供应商")}</p>
        </span>
        <button type="button" class="provider-market-add" data-provider-action="queue-provider" data-provider-id="${escapeAttribute(provider.id)}">添加</button>
    </article>`;
}

function providerLogoContent(provider) {
    const src = providerLogoSrc(provider.id);
    if (src) {
        return `<img src="${escapeAttribute(src)}" alt="" aria-hidden="true">`;
    }
    const labels = { openai: "O", qwen: "Q", doubao: "D", ollama: "O", deepseek: "D" };
    return escapeHtml(labels[provider.id] || provider.name.slice(0, 1).toUpperCase());
}

function providerLogoHasImage(provider) {
    return Boolean(providerLogoSrc(provider.id));
}

function providerLogoSrc(providerId) {
    const logos = {
        deepseek: "/assets/deepseek.svg",
        ollama: "/assets/Ollama.svg",
        openai: "/assets/OpenAI.svg",
        qwen: "/assets/tongyi.svg",
        doubao: "/assets/Volcengine.svg"
    };
    return logos[providerId];
}

function toggleProviderModelList(providerId) {
    const currentCollapsed = state.providerModelListsCollapsed[providerId] ?? true;
    state.providerModelListsCollapsed = {
        ...state.providerModelListsCollapsed,
        [providerId]: !currentCollapsed
    };
    renderModelConfigList();
}

function handleProviderListClick(event) {
    const queueButton = event.target.closest("[data-provider-action='queue-provider']");
    if (queueButton) {
        event.preventDefault();
        event.stopPropagation();
        queueAvailableProvider(queueButton.dataset.providerId);
        return;
    }

    const button = event.target.closest("[data-provider-action='configure']");
    if (button) openProviderSetupDialog(button.dataset.providerId);
}

function queueAvailableProvider(providerId) {
    if (!providerId) return;
    state.queuedProviderIds = new Set(state.queuedProviderIds);
    state.queuedProviderIds.add(providerId);
    renderModelConfigList();
    showToast("已加入待配置列表");
}

function openProviderSetupDialog(providerId) {
    const provider = state.providers.find(item => item.id === providerId);
    if (!provider) return;
    state.setupProviderId = providerId;
    elements.providerSetupForm.reset();
    elements.providerSetupTitle.textContent = `配置 ${provider.name}`;
    elements.providerSetupDescription.textContent = provider.description || "";
    elements.providerApiAddressInput.value = provider.apiAddress;
    elements.providerApiKeyInput.placeholder = provider.hasDefaultApiKey
        ? "已保存 API Key，留空可继续使用"
        : "请输入供应商 API Key";
    elements.providerSetupDialog.showModal();
    window.setTimeout(() => elements.providerApiKeyInput.focus(), 0);
}

function closeProviderSetupDialog() {
    if (elements.providerSetupDialog.open) elements.providerSetupDialog.close();
    state.setupProviderId = null;
    state.discoveredModels = [];
}

async function enableProviderModels(event) {
    event.preventDefault();
    if (!state.setupProviderId) return;

    elements.enableProviderButton.disabled = true;
    elements.enableProviderButton.textContent = "保存中...";
    try {
        const result = await request(`/api/llm-providers/${encodeURIComponent(state.setupProviderId)}/enable`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                apiKey: elements.providerApiKeyInput.value.trim() || null
            })
        });
        replaceProvider(result.provider);
        for (const config of result.configs) upsertProviderConfig(config);
        closeProviderSetupDialog();
        renderModelConfigList();
        showToast(result.configs.length
            ? `已新增 ${result.configs.length} 个模型配置，默认不可用`
            : "未新增模型，已存在的同名模型已跳过");
    } catch (error) {
        showToast(`保存失败：${error.message}`);
    } finally {
        elements.enableProviderButton.disabled = false;
        elements.enableProviderButton.textContent = "确定";
    }
}

function modelConfigCardHtml(item) {
    const statusClass = item.enabled ? "" : " disabled";
    const apiStatus = item.hasApiKey ? "已配置 API Key" : "未配置 API Key";
    return `<article class="model-config-card">
        <div class="model-config-main">
            <div class="model-config-title-row">
                <div class="model-config-icon" aria-hidden="true">${modelProviderIconSvg()}</div>
                <div class="model-config-copy">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.provider)}${item.model ? ` · ${escapeHtml(item.model)}` : ""}</span>
                </div>
            </div>
            <div class="model-config-tags">
                ${modelCapabilityTagsHtml(item)}
                ${item.model ? `<span>${escapeHtml(item.model)}</span>` : ""}
                ${item.endpoint ? `<span>${escapeHtml(shortEndpoint(item.endpoint))}</span>` : ""}
                <span>${apiStatus}</span>
                ${item.temperature != null ? `<span>Temperature ${escapeHtml(item.temperature)}</span>` : ""}
            </div>
            <div class="model-config-meta">
                <span>接口地址：${escapeHtml(item.endpoint || "未配置")}</span>
                <span>环境变量：${escapeHtml(item.apiKeyEnvironmentVariable || "未配置")}</span>
                <span>更新时间：${formatDate(item.updatedAt)}</span>
            </div>
        </div>
        <div class="model-config-side">
            <div class="model-status${statusClass}">
                <strong>${item.enabled ? "已启用" : "不可用"}</strong>
                <span class="model-status-dot" aria-hidden="true"></span>
            </div>
            <div class="model-config-actions">
                <button type="button" data-model-action="edit" data-model-id="${escapeAttribute(item.id)}">配置</button>
                <button class="danger" type="button" data-model-action="delete" data-model-id="${escapeAttribute(item.id)}">删除</button>
            </div>
        </div>
    </article>`;
}

function modelProviderIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M8 8 10.5 4h3L16 8"/><path d="M9 12h6"/><path d="M3 12H1v4h2"/><path d="M21 12h2v4h-2"/></svg>`;
}

function shortEndpoint(value) {
    try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}`;
    } catch {
        return value;
    }
}

function modelCapabilityTagsHtml(item) {
    const tags = [formatModelTypeLabel(item.modelType), ...(item.modelCapabilities || []).map(formatCapabilityLabel)]
        .filter(Boolean);
    return tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("");
}

function formatModelTypeLabel(value) {
    const normalized = (value || "llm").toLocaleLowerCase();
    if (normalized === "llm") return "LLM";
    if (normalized === "text-embedding") return "Text Embedding";
    if (normalized === "rerank") return "Rerank";
    if (normalized === "speech2text") return "Speech2text";
    if (normalized === "tts") return "TTS";
    return normalized.toUpperCase();
}

function formatCapabilityLabel(value) {
    const normalized = (value || "").toLocaleLowerCase();
    if (!normalized) return "";
    if (normalized === "vision") return "Vision";
    if (normalized === "video") return "Video";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function generateModelConfigName(provider, model) {
    return [provider, model].filter(Boolean).join("-") || provider || model || "model-config";
}

function handleModelConfigListClick(event) {
    const toggleButton = event.target.closest("[data-model-toggle]");
    if (toggleButton) {
        toggleModelConfigEnabled(toggleButton.dataset.modelId);
        return;
    }
    const listToggleButton = event.target.closest("[data-provider-action='toggle-model-list']");
    if (listToggleButton) {
        toggleProviderModelList(listToggleButton.dataset.providerId);
        return;
    }
    const providerButton = event.target.closest("[data-provider-action='configure']");
    if (providerButton) {
        openProviderSetupDialog(providerButton.dataset.providerId);
        return;
    }
    const addModelButton = event.target.closest("[data-provider-action='add-model']");
    if (addModelButton) {
        event.preventDefault();
        event.stopPropagation();
        openModelConfigDialog(null, {
            providerId: addModelButton.dataset.providerId,
            lockProvider: true
        });
        return;
    }
    const actionButton = event.target.closest("[data-model-action]");
    if (!actionButton) return;
    const id = actionButton.dataset.modelId;
    if (actionButton.dataset.modelAction === "edit") {
        openModelConfigDialog(id);
        return;
    }
    if (actionButton.dataset.modelAction === "delete") {
        deleteModelConfig(id);
    }
}

async function toggleModelConfigEnabled(id) {
    const item = state.providerConfigs.find(config => config.id === id);
    if (!item) return;
    try {
        const updated = await request(`/api/llm-provider-configs/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: item.name,
                provider: item.provider,
                endpoint: item.endpoint,
                model: item.model,
                modelType: item.modelType,
                contextLength: item.contextLength,
                apiKey: null,
                apiKeyEnvironmentVariable: item.apiKeyEnvironmentVariable,
                temperature: item.temperature,
                enabled: !item.enabled
            })
        });
        replaceProviderConfig(updated);
        renderModelConfigList();
    } catch (error) {
        showToast(`状态更新失败：${error.message}`);
    }
}

async function deleteModelConfig(id) {
    const item = state.providerConfigs.find(config => config.id === id);
    if (!item) return;
    if (!confirm(`确认删除模型配置“${item.name}”吗？`)) return;
    try {
        await request(`/api/llm-provider-configs/${encodeURIComponent(id)}`, { method: "DELETE" });
        state.providerConfigs = state.providerConfigs.filter(config => config.id !== id);
        renderModelConfigList();
        showToast("模型配置已删除");
    } catch (error) {
        showToast(`删除失败：${error.message}`);
    }
}

function workflowCardHtml(item) {
    return `<div class="app-card studio-card" role="link" tabindex="0" data-open-url="/designer/${encodeURIComponent(item.id)}" data-resource-type="workflow" data-resource-id="${escapeHtml(item.id)}"><span class="studio-card-type">工作流</span><div class="app-icon${isImageIcon(item.icon) ? " has-custom-image" : ""}">${resourceIconHtml(item, workflowIconSvg())}</div><div class="app-copy"><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description || "暂无工作流描述")}</p><div class="app-meta"><span>${item.nodes?.length || 0} 个节点</span></div></div>${cardMenuHtml()}</div>`;
}

function agentCardHtml(item) {
    const knowledgeCount = Array.isArray(item.knowledgeBaseIds) ? item.knowledgeBaseIds.length : 0;
    return `<div class="app-card studio-card" role="link" tabindex="0" data-open-url="/agent-designer/${encodeURIComponent(item.id)}" data-resource-type="agent" data-resource-id="${escapeHtml(item.id)}"><span class="studio-card-type">对话 Agent</span><div class="app-icon has-custom-image">${resourceIconHtml({ ...item, icon: item.icon || defaultAgentIcon }, agentIconSvg())}</div><div class="app-copy"><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description || "暂无 Agent 描述")}</p><div class="app-meta"><span>${knowledgeCount} 个知识库</span></div></div>${cardMenuHtml()}</div>`;
}

function knowledgeCardHtml(item) {
    return `<div class="app-card studio-card" role="link" tabindex="0" data-open-url="/knowledge?id=${encodeURIComponent(item.id)}" data-resource-type="knowledge" data-resource-id="${escapeHtml(item.id)}"><span class="studio-card-type">知识库</span><div class="app-icon has-custom-image">${resourceIconHtml({ ...item, icon: item.icon || defaultKnowledgeIcon }, knowledgeIconSvg())}</div><div class="app-copy"><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description || "暂无知识库描述")}</p><div class="app-meta"><span>本地知识库</span></div></div>${cardMenuHtml()}</div>`;
}

function resourceIconHtml(item, fallbackSvg) {
    if (!item.icon) return fallbackSvg;
    return isImageIcon(item.icon)
        ? `<img class="custom-resource-image" src="${escapeAttribute(item.icon)}" alt="">`
        : `<span class="custom-resource-icon">${escapeHtml(item.icon)}</span>`;
}

function workflowIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="6" height="6" rx="1.5"/><rect x="14.5" y="14" width="6" height="6" rx="1.5"/><path d="M9.5 7h3a4 4 0 0 1 4 4v3"/></svg>`;
}

function knowledgeIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z"/></svg>`;
}

function agentIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 14.2 9.8 21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3Z"/></svg>`;
}

function cardMenuHtml() {
    return `<div class="studio-card-menu"><button class="studio-card-more" data-card-more type="button" aria-label="更多操作" title="更多操作">...</button><div class="studio-action-menu" role="menu"><button data-card-action="edit" type="button" role="menuitem">编辑</button><button class="danger" data-card-action="delete" type="button" role="menuitem">删除</button></div></div>`;
}

function handleGridClick(event) {
    const menu = event.target.closest(".studio-card-menu");
    if (menu) {
        event.stopPropagation();
        const card = menu.closest(".studio-card");
        const action = event.target.closest("[data-card-action]")?.dataset.cardAction;
        if (event.target.closest("[data-card-more]")) {
            toggleCardMenu(menu);
            return;
        }
        if (action === "edit") {
            closeCardMenus();
            openEditResourceDialog(card.dataset.resourceType, card.dataset.resourceId);
            return;
        }
        if (action === "delete") {
            closeCardMenus();
            deleteResource(card.dataset.resourceType, card.dataset.resourceId);
            return;
        }
    }

    const card = event.target.closest(".studio-card");
    if (card?.dataset.openUrl) openDesignWindow(card.dataset.openUrl);
}

function openDesignWindow(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener");
}

function toggleCardMenu(menu) {
    const open = menu.classList.contains("is-open");
    closeCardMenus();
    menu.classList.toggle("is-open", !open);
}

function closeCardMenus() {
    document.querySelectorAll(".studio-card-menu.is-open").forEach(menu => menu.classList.remove("is-open"));
}

async function updateResource(type, id, name, description, icon) {
    if (type === "knowledge") {
        return request(`/api/knowledge-bases/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, description, icon })
        });
    }

    if (type === "agent") {
        const agent = getResourceList("agent").find(item => item.id === id);
        if (!agent) throw new Error("对话 Agent 不存在。");
        return request(`/api/conversation-agents/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...agent, name, description, icon })
        });
    }

    return request(`/api/workflows/${encodeURIComponent(id)}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, icon })
    });
}

async function deleteResource(type, id) {
    const item = getResourceList(type).find(resource => resource.id === id);
    if (!item) return;
    const meta = resourceMeta(type);
    if (!confirm(`确认删除${meta.itemLabel}“${item.name}”吗？`)) return;
    try {
        await request(`${meta.apiUrl}/${encodeURIComponent(id)}`, { method: "DELETE" });
        removeResource(type, id);
        render();
        showToast(`${meta.itemLabel}已删除`);
    } catch (error) {
        showToast(`删除失败：${error.message}`);
    }
}

function getResourceList(type) {
    if (type === "knowledge") return state.knowledgeBases;
    if (type === "agent") return state.agents;
    if (type === "model-config") return state.providerConfigs;
    return state.workflows;
}

function normalizeResourceType(type) {
    return type === "knowledge" || type === "agent" ? type : "workflow";
}

function resourceMeta(type) {
    if (type === "agent") {
        return {
            title: "对话Agent",
            itemLabel: "对话 Agent",
            createLabel: "新建对话 Agent",
            searchPlaceholder: "搜索 Agent 名称",
            namePlaceholder: "请输入 Agent 名称",
            descriptionPlaceholder: "请简要说明 Agent 的角色、用途或风格",
            defaultIcon: defaultAgentIcon,
            apiUrl: "/api/conversation-agents",
            designUrl: id => `/agent-designer/${encodeURIComponent(id)}`
        };
    }
    if (type === "knowledge") {
        return {
            title: "知识库",
            itemLabel: "知识库",
            createLabel: "新建知识库",
            searchPlaceholder: "搜索知识库名称",
            namePlaceholder: "请输入知识库名称",
            descriptionPlaceholder: "请简要说明知识库的用途或内容",
            defaultIcon: defaultKnowledgeIcon,
            apiUrl: "/api/knowledge-bases",
            designUrl: id => `/knowledge?id=${encodeURIComponent(id)}`
        };
    }
    if (type === "model-config") {
        return {
            title: "AI模型配置",
            itemLabel: "模型配置",
            createLabel: "添加模型",
            searchPlaceholder: "搜索模型配置 / 供应商 / 模型",
            apiUrl: "/api/llm-provider-configs"
        };
    }
    return {
        title: "工作流",
        itemLabel: "工作流",
        createLabel: "新建工作流",
        searchPlaceholder: "搜索工作流名称",
        namePlaceholder: "请输入工作流名称",
        descriptionPlaceholder: "请简要说明工作流的用途或步骤",
        defaultIcon: defaultWorkflowIcon,
        apiUrl: "/api/workflows",
        designUrl: id => `/designer/${encodeURIComponent(id)}`
    };
}

function replaceResource(type, item) {
    const list = getResourceList(type);
    const index = list.findIndex(resource => resource.id === item.id);
    if (index >= 0) list[index] = item;
}

function removeResource(type, id) {
    const list = getResourceList(type);
    const index = list.findIndex(resource => resource.id === id);
    if (index >= 0) list.splice(index, 1);
}

function replaceProviderConfig(item) {
    const index = state.providerConfigs.findIndex(config => config.id === item.id);
    if (index >= 0) state.providerConfigs[index] = item;
}

function upsertProviderConfig(item) {
    const index = state.providerConfigs.findIndex(config => config.id === item.id);
    if (index >= 0) state.providerConfigs[index] = item;
    else state.providerConfigs.unshift(item);
}

function replaceProvider(item) {
    const index = state.providers.findIndex(provider => provider.id === item.id);
    if (index >= 0) state.providers[index] = item;
}

async function request(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error((await response.text()).replace(/^"|"$/g, ""));
    if (response.status === 204) return null;
    return response.json();
}

function isImageIcon(value) {
    return typeof value === "string" && (/^data:image\//i.test(value) || /^\/[^"'<>]+\.(png|jpe?g|webp|gif|svg)$/i.test(value));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}

function formatDate(value) {
    return value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "--";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" })[character]);
}

let toastTimer;
function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 3200);
}

