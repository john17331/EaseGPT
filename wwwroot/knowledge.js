const state = {
    bases: [],
    selectedId: null,
    selectedBase: null,
    documents: [],
    selectedDocumentId: null,
    currentView: "create",
    pollTimer: null,
    editing: false,
    modelOptions: {
        embedding: [],
        rerank: []
    },
    pickerSearch: {
        embedding: "",
        rerank: ""
    },
    openPicker: null
};

const elements = {
    sidebar: document.querySelector(".sidebar"),
    workspace: document.querySelector("#workspace"),
    fileWorkspace: document.querySelector("#fileWorkspace"),
    emptyState: document.querySelector("#emptyState"),
    emptyCreateButton: document.querySelector("#emptyCreateButton"),
    mobileMenuButton: document.querySelector("#mobileMenuButton"),
    pageTitle: document.querySelector("#pageTitle"),
    pageDescription: document.querySelector("#pageDescription"),
    documentSummary: document.querySelector("#documentSummary"),
    fileInput: document.querySelector("#fileInput"),
    dropZone: document.querySelector("#dropZone"),
    uploadQueue: document.querySelector("#uploadQueue"),
    documentList: document.querySelector("#documentList"),
    documentEmpty: document.querySelector("#documentEmpty"),
    previewSection: document.querySelector("#previewSection"),
    previewDescription: document.querySelector("#previewDescription"),
    previewEmpty: document.querySelector("#previewEmpty"),
    previewPanel: document.querySelector("#previewPanel"),
    previewStatus: document.querySelector("#previewStatus"),
    previewChunkCount: document.querySelector("#previewChunkCount"),
    previewSize: document.querySelector("#previewSize"),
    previewUpdatedAt: document.querySelector("#previewUpdatedAt"),
    chunkPreviewList: document.querySelector("#chunkPreviewList"),
    testSection: document.querySelector("#testSection"),
    askForm: document.querySelector("#askForm"),
    questionInput: document.querySelector("#questionInput"),
    topKSelect: document.querySelector("#topKSelect"),
    askButton: document.querySelector("#askButton"),
    answerEmpty: document.querySelector("#answerEmpty"),
    answerPanel: document.querySelector("#answerPanel"),
    recallCount: document.querySelector("#recallCount"),
    citationList: document.querySelector("#citationList"),
    knowledgeSettingsForm: document.querySelector("#knowledgeSettingsForm"),
    chunkModeSelect: document.querySelector("#chunkModeSelect"),
    chunkDelimiterInput: document.querySelector("#chunkDelimiterInput"),
    chunkSizeInput: document.querySelector("#chunkSizeInput"),
    chunkOverlapInput: document.querySelector("#chunkOverlapInput"),
    chunkSettingsHint: document.querySelector("#chunkSettingsHint"),
    indexModeSelect: document.querySelector("#indexModeSelect"),
    embeddingModelSelect: document.querySelector("#embeddingModelSelect"),
    embeddingModelPicker: document.querySelector("#embeddingModelPicker"),
    rerankModelSelect: document.querySelector("#rerankModelSelect"),
    rerankModelPicker: document.querySelector("#rerankModelPicker"),
    chunkSummary: document.querySelector("#chunkSummary"),
    indexSummary: document.querySelector("#indexSummary"),
    rerankSummary: document.querySelector("#rerankSummary"),
    baseDialog: document.querySelector("#baseDialog"),
    baseForm: document.querySelector("#baseForm"),
    dialogTitle: document.querySelector("#dialogTitle"),
    baseNameInput: document.querySelector("#baseNameInput"),
    baseDescriptionInput: document.querySelector("#baseDescriptionInput"),
    closeDialogButton: document.querySelector("#closeDialogButton"),
    cancelDialogButton: document.querySelector("#cancelDialogButton"),
    documentErrorDialog: document.querySelector("#documentErrorDialog"),
    documentErrorMessage: document.querySelector("#documentErrorMessage"),
    closeDocumentErrorButton: document.querySelector("#closeDocumentErrorButton"),
    toast: document.querySelector("#toast")
};

elements.emptyCreateButton?.addEventListener("click", () => openBaseDialog(false));
elements.closeDialogButton?.addEventListener("click", () => elements.baseDialog.close());
elements.cancelDialogButton?.addEventListener("click", () => elements.baseDialog.close());
elements.closeDocumentErrorButton?.addEventListener("click", () => elements.documentErrorDialog.close());
elements.baseForm?.addEventListener("submit", saveBase);
elements.fileInput?.addEventListener("change", event => uploadFiles(event.target.files));
elements.dropZone?.addEventListener("dragover", event => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
});
elements.dropZone?.addEventListener("dragleave", () => elements.dropZone.classList.remove("dragging"));
elements.dropZone?.addEventListener("drop", event => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
    uploadFiles(event.dataTransfer.files);
});
elements.documentList?.addEventListener("click", handleDocumentListClick);
elements.askForm?.addEventListener("submit", askQuestion);
elements.knowledgeSettingsForm?.addEventListener("submit", saveKnowledgeSettings);
elements.mobileMenuButton?.addEventListener("click", () => elements.sidebar.classList.toggle("open"));
elements.chunkModeSelect?.addEventListener("change", () => {
    syncOptionCards();
    syncChunkSettingsUi();
    updateSettingsPreview();
});
elements.indexModeSelect?.addEventListener("change", () => {
    syncOptionCards();
    updateSettingsPreview();
});
elements.chunkDelimiterInput?.addEventListener("input", updateSettingsPreview);
elements.chunkSizeInput?.addEventListener("input", () => {
    syncChunkSettingsUi();
    updateSettingsPreview();
});
elements.chunkOverlapInput?.addEventListener("input", () => {
    syncChunkSettingsUi();
    updateSettingsPreview();
});
document.querySelectorAll("[data-knowledge-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.knowledgeView));
});
document.querySelectorAll(".option-card[data-select-target]").forEach(button => {
    button.addEventListener("click", () => selectOptionCard(button));
});
document.addEventListener("click", handleDocumentClick);
document.addEventListener("input", handleDocumentInput);
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModelPickers();
    }
});

initialize();

async function initialize() {
    try {
        const [bases, configOptions] = await Promise.all([
            request("/api/knowledge-bases"),
            request("/api/knowledge-bases/config-options").catch(() => null)
        ]);

        state.bases = Array.isArray(bases) ? bases : [];
        renderModelOptions(configOptions);

        const requestedId = new URLSearchParams(location.search).get("id");
        state.selectedId = state.bases.some(item => item.id === requestedId)
            ? requestedId
            : state.bases[0]?.id ?? null;

        if (state.selectedId) {
            await selectBase(state.selectedId);
        } else {
            renderNoSelection();
        }
    } catch (error) {
        showToast(error.message, true);
        renderNoSelection();
    }
}

function setView(view) {
    state.currentView = view === "test" ? "test" : "create";
    document.querySelectorAll("[data-knowledge-view]").forEach(item => {
        item.classList.toggle("active", item.dataset.knowledgeView === state.currentView);
    });
    elements.sidebar.classList.remove("open");

    const isTestView = state.currentView === "test";
    elements.fileWorkspace.hidden = isTestView;
    elements.previewSection.hidden = isTestView;
    elements.testSection.hidden = !isTestView;
    elements.workspace.classList.toggle("view-test", isTestView);

    if (isTestView) {
        window.setTimeout(() => elements.questionInput?.focus(), 120);
    }
}

async function selectBase(id) {
    stopPolling();
    state.selectedId = id;
    history.replaceState(null, "", `/knowledge?id=${encodeURIComponent(id)}`);
    elements.sidebar.classList.remove("open");

    try {
        const result = await request(`/api/knowledge-bases/${id}`);
        state.selectedBase = result.knowledgeBase;
        state.documents = result.documents ?? [];
        state.selectedDocumentId = pickPreviewDocumentId(state.documents, state.selectedDocumentId);

        elements.pageTitle.textContent = state.selectedBase.name;
        elements.pageDescription.textContent = state.selectedBase.description || "管理文档并查看分段预览";
        elements.emptyState.hidden = true;
        elements.workspace.hidden = false;

        renderKnowledgeSettings(state.selectedBase);
        renderDocuments();
        await renderSelectedDocumentPreview();
        setView(state.currentView);
        schedulePolling();
    } catch (error) {
        showToast(error.message, true);
        renderNoSelection();
    }
}

function renderNoSelection() {
    stopPolling();
    state.selectedId = null;
    state.selectedBase = null;
    state.documents = [];
    state.selectedDocumentId = null;
    elements.pageTitle.textContent = "知识库管理";
    elements.pageDescription.textContent = "选择或创建一个知识库开始使用";
    elements.emptyState.hidden = false;
    elements.workspace.hidden = true;
}

function openBaseDialog(editing) {
    state.editing = editing;
    const current = state.bases.find(item => item.id === state.selectedId);
    elements.dialogTitle.textContent = editing ? "编辑知识库" : "新建知识库";
    elements.baseNameInput.value = editing ? current?.name ?? "" : "";
    elements.baseDescriptionInput.value = editing ? current?.description ?? "" : "";
    elements.baseDialog.showModal();
    requestAnimationFrame(() => elements.baseNameInput.focus());
}

async function saveBase(event) {
    event.preventDefault();

    const current = state.bases.find(item => item.id === state.selectedId);
    const body = {
        name: elements.baseNameInput.value.trim(),
        description: elements.baseDescriptionInput.value.trim() || null,
        icon: state.editing ? current?.icon ?? null : null,
        ...(state.editing && state.selectedBase ? knowledgeSettingsBody(state.selectedBase) : {})
    };

    if (!body.name) {
        return;
    }

    try {
        const item = await request(state.editing ? `/api/knowledge-bases/${state.selectedId}` : "/api/knowledge-bases", {
            method: state.editing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const existingIndex = state.bases.findIndex(base => base.id === item.id);
        if (existingIndex >= 0) {
            state.bases[existingIndex] = item;
        } else {
            state.bases.unshift(item);
        }

        elements.baseDialog.close();
        await selectBase(item.id);
        showToast(state.editing ? "知识库已更新" : "知识库已创建");
    } catch (error) {
        showToast(error.message, true);
    }
}

function renderModelOptions(options) {
    state.modelOptions.embedding = normalizePickerOptions(options?.embeddingModels, "embedding");
    state.modelOptions.rerank = normalizePickerOptions(options?.rerankModels, "rerank");
    syncNativeSelect(elements.embeddingModelSelect, state.modelOptions.embedding);
    syncNativeSelect(elements.rerankModelSelect, state.modelOptions.rerank);
    renderFloatingPicker("embedding");
    renderFloatingPicker("rerank");
}

function normalizePickerOptions(items, kind) {
    const defaults = kind === "embedding"
        ? [{ value: "system-default", label: "系统默认", providerId: "system", providerName: "系统默认", modelName: "系统默认", tag: "Embedding" }]
        : [{ value: "none", label: "不使用重排", providerId: "none", providerName: "关闭重排", modelName: "不使用重排", tag: "Off" }];

    return (items?.length ? items : defaults).map(item => ({
        value: item.value,
        label: item.label,
        providerId: String(item.providerId || "").toLowerCase(),
        providerName: item.providerName || item.label,
        modelName: item.modelName || item.label,
        tag: item.tag || (kind === "embedding" ? "Embedding" : "Rerank")
    }));
}

function syncNativeSelect(select, options) {
    const currentValue = select.value;
    select.innerHTML = options.map(item => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join("");
    select.value = options.some(item => item.value === currentValue) ? currentValue : options[0]?.value ?? "";
}

function renderFloatingPicker(kind) {
    const root = kind === "embedding" ? elements.embeddingModelPicker : elements.rerankModelPicker;
    const select = kind === "embedding" ? elements.embeddingModelSelect : elements.rerankModelSelect;
    const options = state.modelOptions[kind];
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
            <span class="floating-model-caret" aria-hidden="true">⌄</span>
        </button>
        <div class="floating-model-panel${open ? " is-open" : ""}">
            <div class="floating-model-search-row">
                <input
                    type="search"
                    class="floating-model-search"
                    data-picker-search="${kind}"
                    value="${escapeHtml(query)}"
                    placeholder="搜索模型">
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

function pickerOptionsHtml(kind, options, query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const filtered = normalizedQuery
        ? options.filter(item => [item.modelName, item.providerName, item.label, item.tag].join(" ").toLowerCase().includes(normalizedQuery))
        : options;

    if (!filtered.length) {
        return '<div class="floating-model-empty">没有找到匹配的模型</div>';
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
                const selected = getPickerValue(kind) === item.value;
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

function renderKnowledgeSettings(item) {
    elements.chunkModeSelect.value = item.chunkMode || "paragraph";
    elements.chunkDelimiterInput.value = item.chunkDelimiter || "\\n\\n";
    elements.chunkSizeInput.value = String(item.chunkSize || 1024);
    elements.chunkOverlapInput.value = String(item.chunkOverlap || 100);
    elements.indexModeSelect.value = item.indexMode || "hybrid";

    const embeddingOptions = state.modelOptions.embedding;
    const rerankOptions = state.modelOptions.rerank;
    elements.embeddingModelSelect.value = embeddingOptions.some(option => option.value === item.embeddingModel) ? item.embeddingModel : "system-default";
    elements.rerankModelSelect.value = rerankOptions.some(option => option.value === item.rerankModel) ? item.rerankModel : "none";

    syncOptionCards();
    syncChunkSettingsUi();
    updateSettingsPreview();
    renderFloatingPicker("embedding");
    renderFloatingPicker("rerank");
}

function knowledgeSettingsBody(item = state.selectedBase) {
    const chunkSize = clampInteger(elements.chunkSizeInput.value, item?.chunkSize ?? 1024, 200, 4000);
    return {
        chunkMode: elements.chunkModeSelect.value,
        chunkDelimiter: normalizeDelimiterInput(elements.chunkDelimiterInput.value),
        chunkSize,
        chunkOverlap: clampInteger(elements.chunkOverlapInput.value, item?.chunkOverlap ?? 100, 0, Math.floor(chunkSize / 2)),
        indexMode: elements.indexModeSelect.value,
        embeddingModel: getPickerValue("embedding"),
        rerankModel: getPickerValue("rerank")
    };
}

function selectOptionCard(button) {
    const select = document.getElementById(button.dataset.selectTarget);
    if (!select) {
        return;
    }
    select.value = button.dataset.value;
    syncOptionCards();
    if (button.dataset.selectTarget === "chunkModeSelect") {
        syncChunkSettingsUi();
    }
    updateSettingsPreview();
}

function syncOptionCards() {
    document.querySelectorAll(".option-card[data-select-target]").forEach(button => {
        const select = document.getElementById(button.dataset.selectTarget);
        button.classList.toggle("is-selected", !!select && select.value === button.dataset.value);
    });
}

function syncChunkSettingsUi() {
    const isFixed = elements.chunkModeSelect.value === "fixed";
    const chunkSize = clampInteger(elements.chunkSizeInput.value, 1024, 200, 4000);
    const overlapMax = Math.floor(chunkSize / 2);
    const overlapValue = clampInteger(elements.chunkOverlapInput.value, 100, 0, overlapMax);

    elements.chunkDelimiterInput.disabled = !isFixed;
    elements.chunkSizeInput.disabled = !isFixed;
    elements.chunkOverlapInput.disabled = !isFixed;
    elements.chunkSizeInput.min = "200";
    elements.chunkSizeInput.max = "4000";
    elements.chunkOverlapInput.min = "0";
    elements.chunkOverlapInput.max = String(overlapMax);
    elements.chunkOverlapInput.value = String(overlapValue);

    if (elements.chunkSettingsHint) {
        elements.chunkSettingsHint.textContent = isFixed
            ? `固定长度模式下，后端会使用分段标识作为优先切分边界；最大长度范围 200-4000，重叠长度会被限制在最大长度的一半以内，当前上限为 ${overlapMax}。`
            : "按段落模式下，后端使用固定规则进行分段：按标题分块、按段落合并、800 字目标长度、1024 字最大长度、100 字重叠；当前这三个输入不会参与后端分段。";
    }
}

function updateSettingsPreview() {
    const chunkMode = elements.chunkModeSelect.value === "fixed" ? "固定长度" : "按段落";
    const chunkSize = clampInteger(elements.chunkSizeInput.value, 1024, 200, 4000);
    const indexModeMap = {
        hybrid: "混合检索",
        vector: "向量检索",
        "full-text": "全文检索"
    };
    const rerankOption = state.modelOptions.rerank.find(item => item.value === getPickerValue("rerank"));

    elements.chunkSummary.textContent = `${chunkMode} · ${chunkSize}`;
    elements.indexSummary.textContent = indexModeMap[elements.indexModeSelect.value] || "混合检索";
    elements.rerankSummary.textContent = rerankOption ? rerankOption.modelName : "不使用重排";
}

async function saveKnowledgeSettings(event) {
    event.preventDefault();
    if (!state.selectedBase) {
        return;
    }

    const body = {
        name: state.selectedBase.name,
        description: state.selectedBase.description,
        icon: state.selectedBase.icon,
        ...knowledgeSettingsBody(state.selectedBase)
    };

    try {
        const updated = await request(`/api/knowledge-bases/${state.selectedBase.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        state.selectedBase = updated;
        const index = state.bases.findIndex(item => item.id === updated.id);
        if (index >= 0) {
            state.bases[index] = updated;
        }
        renderKnowledgeSettings(updated);
        showToast("知识库设置已保存");
        await selectBase(updated.id);
    } catch (error) {
        showToast(error.message, true);
    }
}

function handleDocumentClick(event) {
    const trigger = event.target.closest("[data-picker-trigger]");
    if (trigger) {
        const kind = trigger.dataset.pickerTrigger;
        const nextOpen = state.openPicker === kind ? null : kind;
        state.openPicker = nextOpen;
        if (nextOpen) {
            state.pickerSearch[kind] = "";
        }
        renderFloatingPicker("embedding");
        renderFloatingPicker("rerank");
        event.preventDefault();
        return;
    }

    const option = event.target.closest("[data-picker-option]");
    if (option) {
        const kind = option.dataset.pickerOption;
        const select = kind === "embedding" ? elements.embeddingModelSelect : elements.rerankModelSelect;
        select.value = option.dataset.value;
        state.openPicker = null;
        state.pickerSearch[kind] = "";
        renderFloatingPicker("embedding");
        renderFloatingPicker("rerank");
        updateSettingsPreview();
        event.preventDefault();
        return;
    }

    if (!event.target.closest(".floating-model-picker")) {
        closeModelPickers();
    }
}

function handleDocumentInput(event) {
    const search = event.target.closest("[data-picker-search]");
    if (!search) {
        return;
    }

    const kind = search.dataset.pickerSearch;
    state.pickerSearch[kind] = search.value;
    renderFloatingPicker(kind);
}

function closeModelPickers() {
    if (!state.openPicker) {
        return;
    }
    state.openPicker = null;
    renderFloatingPicker("embedding");
    renderFloatingPicker("rerank");
}

function getPickerValue(kind) {
    return kind === "embedding" ? elements.embeddingModelSelect.value : elements.rerankModelSelect.value;
}

function handleDocumentListClick(event) {
    const rowAction = event.target.closest("[data-row-action]");
    if (rowAction) {
        const documentId = rowAction.dataset.documentId;
        const action = rowAction.dataset.rowAction;
        if (action === "show-error") {
            openDocumentErrorDialog(documentId);
        } else if (action === "retry") {
            retryDocument(documentId);
        } else if (action === "delete") {
            deleteDocument(documentId);
        }
        return;
    }

    const row = event.target.closest("[data-document-id]");
    if (!row) {
        return;
    }

    state.selectedDocumentId = row.dataset.documentId;
    renderDocuments();
    renderSelectedDocumentPreview();
}

function renderDocuments() {
    const rows = state.documents.map(document => {
        const status = resolveStatus(document.status);
        const statusMarkup = status.key === "failed"
            ? `<button type="button" class="status-badge status-${escapeHtml(status.key)} status-badge-button" data-row-action="show-error" data-document-id="${escapeHtml(document.id)}">${escapeHtml(status.label)}</button>`
            : `<span class="status-badge status-${escapeHtml(status.key)}">${escapeHtml(status.label)}</span>`;
        return `
            <tr data-document-id="${escapeHtml(document.id)}" class="${document.id === state.selectedDocumentId ? "is-selected" : ""}">
                <td>
                    <div class="file-cell">
                        ${fileIconMarkup(document.fileName, document.contentType)}
                        <span class="file-name">${escapeHtml(document.fileName)}</span>
                    </div>
                </td>
                <td>${statusMarkup}</td>
                <td>${Number(document.chunkCount || 0)}</td>
                <td>${escapeHtml(formatSize(document.size || 0))}</td>
                <td>${escapeHtml(formatDate(document.createdAt))}</td>
                <td>
                    <div class="row-actions">
                        ${(status.key === "failed" || status.key === "pending")
                            ? `<button type="button" class="row-button" data-row-action="retry" data-document-id="${escapeHtml(document.id)}">重试</button>`
                            : ""}
                        <button type="button" class="row-button danger" data-row-action="delete" data-document-id="${escapeHtml(document.id)}">删除</button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    elements.documentList.innerHTML = rows;
    elements.documentEmpty.hidden = state.documents.length > 0;
    elements.documentSummary.textContent = state.documents.length
        ? `共 ${state.documents.length} 个文档`
        : "暂无文档。";
}

async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!state.selectedId || !files.length) {
        return;
    }

    for (const file of files) {
        const queueItem = document.createElement("div");
        queueItem.className = "upload-item";
        queueItem.innerHTML = `<span>${escapeHtml(file.name)}</span><span>上传中...</span>`;
        elements.uploadQueue.appendChild(queueItem);

        try {
            const formData = new FormData();
            formData.append("file", file);
            await request(`/api/knowledge-bases/${state.selectedId}/documents`, {
                method: "POST",
                body: formData
            });
            queueItem.lastElementChild.textContent = "已加入处理队列";
            await refreshDocuments();
        } catch (error) {
            queueItem.lastElementChild.textContent = "上传失败";
            showToast(error.message, true);
        }
    }

    elements.fileInput.value = "";
    window.setTimeout(() => {
        elements.uploadQueue.innerHTML = "";
    }, 2200);
}

async function retryDocument(documentId) {
    if (!state.selectedId) {
        return;
    }
    try {
        await request(`/api/knowledge-bases/${state.selectedId}/documents/${documentId}/retry`, {
            method: "POST"
        });
        showToast("已重新加入处理队列");
        await refreshDocuments();
    } catch (error) {
        showToast(error.message, true);
    }
}

async function deleteDocument(documentId) {
    if (!state.selectedId) {
        return;
    }
    try {
        await request(`/api/knowledge-bases/${state.selectedId}/documents/${documentId}`, {
            method: "DELETE"
        });
        if (state.selectedDocumentId === documentId) {
            state.selectedDocumentId = null;
        }
        await refreshDocuments();
        showToast("文档已删除");
    } catch (error) {
        showToast(error.message, true);
    }
}

async function renderSelectedDocumentPreview() {
    const selectedDocument = state.documents.find(item => item.id === state.selectedDocumentId);
    if (!state.selectedId || !selectedDocument) {
        elements.previewEmpty.hidden = false;
        elements.previewPanel.hidden = true;
        elements.previewDescription.textContent = "查看文件的分段数量、状态与前 10 段内容";
        return;
    }

    elements.previewDescription.textContent = selectedDocument.fileName;
    if (!isPreviewAvailable(selectedDocument.status)) {
        elements.previewEmpty.hidden = false;
        elements.previewPanel.hidden = true;
        elements.previewEmpty.textContent = selectedDocument.status === 3 || String(selectedDocument.status).toLowerCase() === "failed"
            ? "该文件分段失败，请重试后再查看预览"
            : "该文件正在处理中，完成后会自动显示分段预览";
        return;
    }

    try {
        const result = await request(`/api/knowledge-bases/${state.selectedId}/documents/${selectedDocument.id}/preview`);
        elements.previewEmpty.hidden = true;
        elements.previewPanel.hidden = false;
        elements.previewStatus.textContent = resolveStatus(result.stats.status).label;
        elements.previewChunkCount.textContent = String(result.stats.chunkCount ?? 0);
        elements.previewSize.textContent = formatSize(result.stats.size);
        elements.previewUpdatedAt.textContent = formatDate(result.stats.updatedAt);
        elements.chunkPreviewList.innerHTML = (result.chunks ?? []).map(chunk => `
            <article class="chunk-preview-item">
                <div class="chunk-preview-meta">
                    <span class="chunk-preview-index">分段 ${chunk.index + 1}</span>
                    <span class="chunk-preview-range">${chunk.startOffset}-${chunk.endOffset}</span>
                </div>
                ${chunk.keywordSummary ? `<div class="chunk-preview-keywords">关键词：${escapeHtml(chunk.keywordSummary)}</div>` : ""}
                ${chunk.heading ? `<strong class="chunk-preview-heading">${escapeHtml(chunk.heading)}</strong>` : ""}
                <p>${escapeHtml(chunk.text)}</p>
            </article>
        `).join("") || '<div class="list-empty">当前文件暂无可预览分段</div>';
    } catch (error) {
        elements.previewEmpty.hidden = false;
        elements.previewPanel.hidden = true;
        elements.previewEmpty.textContent = "分段预览加载失败";
        showToast(error.message, true);
    }
}

function openDocumentErrorDialog(documentId) {
    const document = state.documents.find(item => item.id === documentId);
    if (!document) {
        return;
    }

    const message = String(document.error || "").trim() || "当前没有可显示的错误信息。";
    if (!elements.documentErrorDialog || !elements.documentErrorMessage) {
        showToast(message, true);
        return;
    }

    elements.documentErrorMessage.textContent = message;
    elements.documentErrorDialog.showModal();
}

function schedulePolling() {
    stopPolling();
    if (!state.documents.some(item => [0, 1, "Pending", "Processing"].includes(item.status))) {
        return;
    }
    state.pollTimer = window.setTimeout(refreshDocuments, 1400);
}

async function refreshDocuments() {
    if (!state.selectedId) {
        return;
    }

    try {
        const result = await request(`/api/knowledge-bases/${state.selectedId}`);
        state.selectedBase = result.knowledgeBase;
        state.documents = result.documents ?? [];
        state.selectedDocumentId = pickPreviewDocumentId(state.documents, state.selectedDocumentId);
        renderKnowledgeSettings(state.selectedBase);
        renderDocuments();
        await renderSelectedDocumentPreview();
        schedulePolling();
    } catch (error) {
        showToast(error.message, true);
    }
}

function stopPolling() {
    if (state.pollTimer) {
        clearTimeout(state.pollTimer);
    }
    state.pollTimer = null;
}

async function askQuestion(event) {
    event.preventDefault();
    if (!state.selectedId || !elements.questionInput.value.trim()) {
        return;
    }

    elements.askButton.disabled = true;
    elements.askButton.textContent = "检索中...";

    try {
        const result = await request(`/api/knowledge-bases/${state.selectedId}/recall`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: elements.questionInput.value.trim(),
                topK: Number(elements.topKSelect.value)
            })
        });

        elements.answerEmpty.hidden = true;
        elements.answerPanel.hidden = false;
        const hits = result.hits ?? [];
        if (elements.recallCount) {
            elements.recallCount.textContent = `共返回 ${hits.length} 项`;
        }
        elements.citationList.innerHTML = hits.map((item, index) => `
            <details class="citation" ${index === 0 ? "open" : ""}>
                <summary>
                    <span class="citation-number">${index + 1}</span>
                    <span class="citation-title">${escapeHtml(item.fileName)} · 分段 ${Number(item.chunkIndex || 0) + 1}</span>
                    <span class="citation-score">总分 ${formatScore(item.score)}</span>
                </summary>
                ${item.heading ? `<div class="citation-heading-inline">${escapeHtml(item.heading)}</div>` : ""}
                ${item.keywordSummary ? `<div class="citation-keywords">关键词：${escapeHtml(item.keywordSummary)}</div>` : ""}
                <div class="citation-metrics">
                    <span>Embedding ${formatScore(item.vectorScore)}</span>
                    <span>关键词 ${formatScore(item.keywordScore)}</span>
                </div>
                <p>${escapeHtml(item.quote)}</p>
            </details>
        `).join("") || '<div class="list-empty">没有命中的分段</div>';
    } catch (error) {
        showToast(error.message, true);
    } finally {
        elements.askButton.disabled = false;
        elements.askButton.textContent = "开始提问";
    }
}

async function request(url, options = {}) {
    const response = await fetch(url, options);
    if (response.ok) {
        return response.status === 204 ? null : response.json();
    }

    let message = `请求失败：${response.status}`;
    try {
        const body = await response.text();
        if (body) {
            message = body.replace(/^"|"$/g, "");
        }
    } catch {
    }
    throw new Error(message);
}

function pickPreviewDocumentId(documents, preferredId) {
    if (preferredId && documents.some(item => item.id === preferredId)) {
        return preferredId;
    }
    return documents.find(item => isPreviewAvailable(item.status))?.id ?? documents[0]?.id ?? null;
}

function isPreviewAvailable(status) {
    return status === 2 || String(status).toLowerCase() === "ready";
}

function resolveStatus(value) {
    const key = typeof value === "string"
        ? value.toLowerCase()
        : ["pending", "processing", "ready", "failed"][value] ?? "pending";
    const labelMap = {
        pending: "等待处理",
        processing: "处理中",
        ready: "可用",
        failed: "处理失败"
    };
    return { key, label: labelMap[key] ?? key };
}

function formatSize(bytes) {
    if (!bytes) {
        return "0 B";
    }
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
    return value
        ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
        : "--";
}

function formatScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? score.toFixed(4) : "0.0000";
}

function providerLogoHtml(providerId) {
    const src = providerLogoSrc(providerId);
    if (src) {
        return `<span class="floating-model-logo has-image"><img src="${escapeHtml(src)}" alt=""></span>`;
    }
    const fallback = {
        system: "系",
        none: "关",
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

function fileIconMarkup(fileName, contentType) {
    const extension = String(fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
    const type = resolveFileIconType(extension, contentType);
    return `<span class="file-icon file-icon--${type}" aria-hidden="true">${fileIconSvg(type)}</span>`;
}

function resolveFileIconType(extension, contentType) {
    if (["doc", "docx"].includes(extension)) return "word";
    if (["xls", "xlsx", "csv"].includes(extension)) return "sheet";
    if (["ppt", "pptx"].includes(extension)) return "slide";
    if (extension === "pdf") return "pdf";
    if (["md", "markdown"].includes(extension)) return "markdown";
    if (["json", "xml", "yaml", "yml"].includes(extension)) return "code";
    if (["txt", "log"].includes(extension)) return "text";
    if (contentType?.includes("json") || contentType?.includes("xml")) return "code";
    if (contentType?.startsWith("text/")) return "text";
    return "file";
}

function fileIconSvg(type) {
    switch (type) {
        case "word":
            return `<svg viewBox="0 0 48 48"><path d="M8 6C8 4.89543 8.89543 4 10 4H30L40 14V42C40 43.1046 39.1046 44 38 44H10C8.89543 44 8 43.1046 8 42V6Z"/><path d="M16 20H32"/><path d="M16 28H32"/></svg>`;
        case "sheet":
            return `<svg viewBox="0 0 48 48"><path d="M10 4H38C39.1046 4 40 4.89543 40 6V42C40 43.1046 39.1046 44 38 44H10C8.89543 44 8 43.1046 8 42V6C8 4.89543 8.89543 4 10 4Z"/><path d="M8 16H40"/><path d="M18 16V44"/><path d="M30 16V44"/><path d="M8 30H40"/></svg>`;
        case "slide":
            return `<svg viewBox="0 0 48 48"><path d="M8 8C8 5.79086 9.79086 4 12 4H36C38.2091 4 40 5.79086 40 8V30C40 32.2091 38.2091 34 36 34H26L30 44H18L22 34H12C9.79086 34 8 32.2091 8 30V8Z"/><path d="M16 13H32"/><path d="M16 21H28"/></svg>`;
        case "pdf":
            return `<svg viewBox="0 0 48 48"><path d="M10 4H30L40 14V42C40 43.1046 39.1046 44 38 44H10C8.89543 44 8 43.1046 8 42V6C8 4.89543 8.89543 4 10 4Z"/><path d="M15 31H19C20.6569 31 22 29.6569 22 28C22 26.3431 20.6569 25 19 25H15V35"/><path d="M26 25V35"/><path d="M26 35H29.5C32.5376 35 35 32.5376 35 29.5C35 26.4624 32.5376 24 29.5 24H26"/></svg>`;
        case "markdown":
            return `<svg viewBox="0 0 48 48"><path d="M10 6H38C39.1046 6 40 6.89543 40 8V40C40 41.1046 39.1046 42 38 42H10C8.89543 42 8 41.1046 8 40V8C8 6.89543 8.89543 6 10 6Z"/><path d="M15 32V18L21 26L27 18V32"/><path d="M31 30H36"/><path d="M33.5 18V30"/></svg>`;
        case "code":
            return `<svg viewBox="0 0 48 48"><path d="M10 6H38C39.1046 6 40 6.89543 40 8V40C40 41.1046 39.1046 42 38 42H10C8.89543 42 8 41.1046 8 40V8C8 6.89543 8.89543 6 10 6Z"/><path d="M20 18L14 24L20 30"/><path d="M28 18L34 24L28 30"/><path d="M25 14L23 34"/></svg>`;
        case "text":
            return `<svg viewBox="0 0 48 48"><path d="M10 4H30L40 14V42C40 43.1046 39.1046 44 38 44H10C8.89543 44 8 43.1046 8 42V6C8 4.89543 8.89543 4 10 4Z"/><path d="M16 18H32"/><path d="M16 24H32"/><path d="M16 30H28"/></svg>`;
        default:
            return `<svg viewBox="0 0 48 48"><path d="M10 4H30L40 14V42C40 43.1046 39.1046 44 38 44H10C8.89543 44 8 43.1046 8 42V6C8 4.89543 8.89543 4 10 4Z"/><path d="M30 4V14H40"/></svg>`;
    }
}

function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value ?? "").trim(), 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}

function normalizeDelimiterInput(value) {
    const normalized = String(value ?? "").trim();
    return normalized || "\\n\\n";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
    }[char]));
}

let toastTimer;
function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.className = `toast show${isError ? " error" : ""}`;
    toastTimer = window.setTimeout(() => {
        elements.toast.className = "toast";
    }, 3200);
}
