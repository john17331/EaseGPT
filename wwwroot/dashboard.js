const recentWorkflowsKey = "easegpt-recent-workflows";
const quickAppKey = "easegpt-home-quick-app";
const myAgentsKey = "easegpt-my-agent-ids";

const state = {
    apps: [],
    tab: "mine",
    query: "",
    mineIds: loadJson(myAgentsKey, []),
    quickAppId: localStorage.getItem(quickAppKey) || ""
};

const elements = {
    homeView: document.querySelector("#homeView"),
    appsView: document.querySelector("#appsView"),
    collapseButton: document.querySelector("#collapseButton"),
    settingsButton: document.querySelector("#settingsButton"),
    settingsDialog: document.querySelector("#settingsDialog"),
    closeSettingsButton: document.querySelector("#closeSettingsButton"),
    appGrid: document.querySelector("#appGrid"),
    appsEmpty: document.querySelector("#appsEmpty"),
    appsEmptyTitle: document.querySelector("#appsEmptyTitle"),
    appsEmptyDescription: document.querySelector("#appsEmptyDescription"),
    workflowSearchInput: document.querySelector("#workflowSearchInput"),
    sidebarRecentList: document.querySelector("#sidebarRecentList"),
    quickAppHome: document.querySelector("#quickAppHome"),
    quickAppFrame: document.querySelector("#quickAppFrame"),
    quickAppSelect: document.querySelector("#quickAppSelect"),
    agentPickList: document.querySelector("#agentPickList"),
    homeSettingsPanel: document.querySelector("#homeSettingsPanel"),
    agentsSettingsPanel: document.querySelector("#agentsSettingsPanel"),
    toast: document.querySelector("#toast")
};

elements.collapseButton.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("sidebar-collapsed");
    elements.collapseButton.classList.toggle("is-collapsed", collapsed);
    elements.collapseButton.setAttribute("aria-label", collapsed ? "展开左侧栏" : "收起左侧栏");
});

document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
    state.tab = button.dataset.tab;
    document.querySelectorAll(".tab").forEach(item => item.classList.toggle("active", item === button));
    renderApps();
}));

document.querySelectorAll(".settings-tab").forEach(button => button.addEventListener("click", () => {
    const home = button.dataset.settingsTab === "home";
    document.querySelectorAll(".settings-tab").forEach(item => item.classList.toggle("active", item === button));
    elements.homeSettingsPanel.hidden = !home;
    elements.agentsSettingsPanel.hidden = home;
}));

elements.workflowSearchInput.addEventListener("input", () => {
    state.query = elements.workflowSearchInput.value.trim().toLocaleLowerCase();
    renderApps();
});

elements.settingsButton.addEventListener("click", () => {
    renderSettings();
    elements.settingsDialog.showModal();
});

elements.closeSettingsButton.addEventListener("click", () => elements.settingsDialog.close());

elements.quickAppSelect.addEventListener("change", () => {
    state.quickAppId = elements.quickAppSelect.value;
    if (state.quickAppId) {
        localStorage.setItem(quickAppKey, state.quickAppId);
    } else {
        localStorage.removeItem(quickAppKey);
    }
    renderQuickApp();
});

elements.agentPickList.addEventListener("click", event => {
    const button = event.target.closest("[data-agent-id]");
    if (!button) return;
    toggleMyAgent(button.dataset.agentId);
});

elements.sidebarRecentList.addEventListener("click", event => {
    const deleteButton = event.target.closest("[data-delete-recent]");
    if (!deleteButton) return;
    event.preventDefault();
    event.stopPropagation();
    deleteRecentWorkflow(deleteButton.dataset.deleteRecent);
});

initialize();

async function initialize() {
    const view = new URLSearchParams(location.search).get("view") || "home";
    showView(view === "apps" ? "apps" : "home");

    try {
        const [workflowsResponse, agentsResponse] = await Promise.all([
            fetch("/api/workflows", { cache: "no-store" }),
            fetch("/api/conversation-agents", { cache: "no-store" })
        ]);

        if (!workflowsResponse.ok) throw new Error(await workflowsResponse.text());
        if (!agentsResponse.ok) throw new Error(await agentsResponse.text());

        const workflows = await workflowsResponse.json();
        const conversationAgents = await agentsResponse.json();

        state.apps = [
            ...workflows.map(workflow => mapWorkflowApp(workflow)),
            ...conversationAgents.map(agent => mapConversationAgentApp(agent))
        ];

        state.mineIds = state.mineIds.filter(id => state.apps.some(item => item.id === id));
        saveMyAgents();
        renderApps();
        renderRecent();
        renderSettings();
        renderQuickApp();
    } catch (error) {
        showToast(`Agent 门户加载失败：${error.message}`);
    }
}

function showView(view) {
    elements.homeView.hidden = view !== "home";
    elements.appsView.hidden = view !== "apps";
    document.querySelectorAll(".admin-nav-item[data-view]").forEach(item => item.classList.toggle("active", item.dataset.view === view));
    if (view === "home") renderQuickApp();
}

function renderApps() {
    const source = state.tab === "mine"
        ? state.mineIds.map(id => state.apps.find(item => item.id === id)).filter(Boolean)
        : state.apps;
    const apps = state.query
        ? source.filter(item => (item.name || "").toLocaleLowerCase().includes(state.query))
        : source;

    elements.appGrid.innerHTML = apps.map(cardHtml).join("");
    elements.appsEmpty.hidden = apps.length > 0;
    elements.appsEmptyTitle.textContent = state.query ? "未找到匹配 Agent" : "暂无 Agent";
    elements.appsEmptyDescription.textContent = state.query
        ? `没有名称包含“${elements.workflowSearchInput.value.trim()}”的 Agent`
        : "当前分类还没有 Agent";
    bindCards(elements.appGrid);
}

function renderRecent() {
    const ids = loadJson(recentWorkflowsKey, []);
    const apps = ids.slice(0, 10).map(id => state.apps.find(item => item.id === id)).filter(Boolean);

    elements.sidebarRecentList.innerHTML = apps.length
        ? apps.map(item => `
            <div class="sidebar-recent-row">
                <a class="sidebar-recent-item" href="${escapeAttribute(item.portalUrl)}" title="${escapeHtml(item.name)}">
                    <span class="sidebar-recent-icon${isImageIcon(item.icon) ? " has-custom-image" : ""}">${appIconHtml(item)}</span>
                    <strong>${escapeHtml(item.name)}</strong>
                </a>
                <button class="sidebar-recent-delete" data-delete-recent="${escapeHtml(item.id)}" type="button" aria-label="删除最近记录：${escapeHtml(item.name)}" title="删除">×</button>
            </div>
        `).join("")
        : '<div class="sidebar-recent-empty">暂无访问记录</div>';
}

function deleteRecentWorkflow(id) {
    const ids = loadJson(recentWorkflowsKey, []).filter(item => item !== id);
    localStorage.setItem(recentWorkflowsKey, JSON.stringify(ids));
    renderRecent();
    showToast("最近记录已删除");
}

function renderQuickApp() {
    const app = state.apps.find(item => item.id === state.quickAppId);
    const enabled = Boolean(app) && !elements.homeView.hidden;
    elements.quickAppHome.hidden = !enabled;

    if (enabled) {
        if (elements.quickAppFrame.getAttribute("src") !== app.portalUrl) {
            elements.quickAppFrame.setAttribute("src", app.portalUrl);
        }
    } else {
        elements.quickAppFrame.removeAttribute("src");
    }
}

function renderSettings() {
    elements.quickAppSelect.innerHTML = [
        '<option value="">不启用快捷应用</option>',
        ...state.apps.map(item => `<option value="${escapeAttribute(item.id)}">${escapeHtml(item.name)}（${escapeHtml(item.portalTypeLabel)}）</option>`)
    ].join("");
    elements.quickAppSelect.value = state.apps.some(item => item.id === state.quickAppId) ? state.quickAppId : "";

    elements.agentPickList.innerHTML = state.apps.length
        ? state.apps.map(item => {
            const added = state.mineIds.includes(item.id);
            return `
                <div class="agent-pick-item">
                    <span class="agent-pick-icon${isImageIcon(item.icon) ? " has-custom-image" : ""}">${appIconHtml(item)}</span>
                    <span class="agent-pick-copy">
                        <strong>${escapeHtml(item.name)}</strong>
                        <span>${escapeHtml(item.description || "暂无应用描述")}</span>
                    </span>
                    <button class="agent-pick-button${added ? " is-added" : ""}" data-agent-id="${escapeHtml(item.id)}" type="button">${added ? "已添加" : "添加"}</button>
                </div>
            `;
        }).join("")
        : '<div class="sidebar-recent-empty">暂无 Agent</div>';
}

function toggleMyAgent(id) {
    if (state.mineIds.includes(id)) {
        state.mineIds = state.mineIds.filter(item => item !== id);
    } else {
        state.mineIds.unshift(id);
    }
    saveMyAgents();
    renderSettings();
    renderApps();
}

function saveMyAgents() {
    localStorage.setItem(myAgentsKey, JSON.stringify(state.mineIds));
}

function cardHtml(app) {
    return `
        <a class="app-card portal-card" href="${escapeAttribute(app.portalUrl)}" target="_blank" rel="noopener" data-id="${escapeHtml(app.id)}">
            <span class="portal-card-type">${escapeHtml(app.portalTypeLabel)}</span>
            <div class="app-icon${isImageIcon(app.icon) ? " has-custom-image" : ""}">${appIconHtml(app)}</div>
            <div class="app-copy">
                <strong>${escapeHtml(app.name)}</strong>
                <p>${escapeHtml(app.description || "暂无应用描述")}</p>
                <div class="app-meta"><span>${escapeHtml(getAppMetaText(app))}</span></div>
            </div>
        </a>
    `;
}

function appIconHtml(app) {
    if (isImageIcon(app.icon)) {
        return `<img src="${escapeAttribute(app.icon)}" alt="">`;
    }

    return escapeHtml(app.icon || (app.name || "A").slice(0, 1).toUpperCase());
}

function getAppMetaText(app) {
    if (app.appType === "workflow") {
        return `${app.nodes?.length || 0} 个节点`;
    }

    const knowledgeCount = Array.isArray(app.knowledgeBaseIds) ? app.knowledgeBaseIds.length : 0;
    return knowledgeCount > 0 ? `${knowledgeCount} 个知识库` : "对话 Agent";
}

function bindCards(container) {
    container.querySelectorAll(".app-card").forEach(card => card.addEventListener("click", () => {
        const ids = loadJson(recentWorkflowsKey, []).filter(id => id !== card.dataset.id);
        ids.unshift(card.dataset.id);
        localStorage.setItem(recentWorkflowsKey, JSON.stringify(ids.slice(0, 10)));
    }));
}

function mapWorkflowApp(workflow) {
    return {
        ...workflow,
        appType: "workflow",
        portalTypeLabel: "工作流",
        portalUrl: `/ai/${encodeURIComponent(workflow.id)}`
    };
}

function mapConversationAgentApp(agent) {
    return {
        ...agent,
        appType: "conversation-agent",
        portalTypeLabel: "对话Agent",
        portalUrl: `/ai-agent/${encodeURIComponent(agent.id)}`
    };
}

function loadJson(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        return Array.isArray(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function isImageIcon(value) {
    return typeof value === "string" && (/^data:image\//i.test(value) || /^\/[^"'<>]+\.(png|jpe?g|webp|gif|svg)$/i.test(value));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    setTimeout(() => elements.toast.classList.remove("show"), 3200);
}
