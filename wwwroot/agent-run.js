const agentId = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "");
const recentKey = `easegpt:agent:recent:${agentId}`;

const workflowTitle = document.getElementById("workflowTitle");
const messages = document.getElementById("messages");
const composerForm = document.getElementById("composerForm");
const questionInput = document.getElementById("questionInput");
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const sendButton = document.getElementById("sendButton");
const stopButton = document.getElementById("stopButton");
const statusText = document.getElementById("statusText");
const recentList = document.getElementById("recentList");
const newChatButton = document.getElementById("newChatButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const collapseButton = document.getElementById("collapseButton");
const shareButton = document.getElementById("shareButton");

const state = {
    agent: null,
    files: [],
    running: false,
    abortController: null,
    sessionId: createSessionId(),
    conversationHistory: []
};

fileInput.addEventListener("change", () => {
    const selectedKeys = new Set(state.files.map(getFileIdentity));
    for (const file of Array.from(fileInput.files ?? [])) {
        const identity = getFileIdentity(file);
        if (selectedKeys.has(identity)) continue;
        selectedKeys.add(identity);
        state.files.push(file);
    }
    fileInput.value = "";
    renderFiles();
});

function getFileIdentity(file) {
    return [file.name, file.size, file.type, file.lastModified].join(":");
}

questionInput.addEventListener("input", () => {
    questionInput.style.height = "auto";
    questionInput.style.height = `${Math.min(questionInput.scrollHeight, 180)}px`;
});

questionInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        composerForm.requestSubmit();
    }
});

composerForm.addEventListener("submit", async event => {
    event.preventDefault();
    await runAgent();
});

newChatButton.addEventListener("click", event => {
    event.preventDefault();
    startNewConversation();
});

sidebarToggle.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
});

collapseButton.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("sidebar-collapsed");
    collapseButton.classList.toggle("is-collapsed", collapsed);
    collapseButton.setAttribute("aria-label", collapsed ? "展开左侧栏" : "收起左侧栏");
    collapseButton.setAttribute("title", collapsed ? "展开左侧栏" : "收起左侧栏");
});

shareButton.addEventListener("click", copyCurrentLink);
stopButton.addEventListener("click", stopExecution);

renderRecent();
loadAgent();

async function loadAgent() {
    if (!agentId) {
        setStatus("Agent 编号缺失");
        return;
    }

    try {
        const response = await fetch(`/api/conversation-agents/${encodeURIComponent(agentId)}`, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(await response.text());
        }

        state.agent = normalizeAgent(await response.json());
        workflowTitle.textContent = state.agent.name;
        workflowTitle.dataset.tooltip = `ID: ${state.agent.id}${state.agent.description ? `\n描述: ${state.agent.description}` : ""}`;
        setStatus("准备就绪");

        const openingStatement = String(state.agent.openingStatement || "").trim();
        if (openingStatement) {
            appendMessage("assistant", openingStatement);
        }
    } catch (error) {
        workflowTitle.textContent = "对话 Agent 加载失败";
        setStatus(error.message);
        sendButton.disabled = true;
    }
}

async function copyCurrentLink() {
    const url = location.href;
    const originalLabel = shareButton.getAttribute("aria-label") || "分享";

    try {
        await navigator.clipboard.writeText(url);
    } catch {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
    }

    shareButton.classList.add("is-copied");
    shareButton.setAttribute("aria-label", "链接已复制");
    shareButton.disabled = true;
    setStatus("链接已复制到剪贴板");

    window.setTimeout(() => {
        shareButton.classList.remove("is-copied");
        shareButton.setAttribute("aria-label", originalLabel);
        shareButton.disabled = false;
    }, 1600);
}

async function runAgent() {
    const question = questionInput.value.trim();
    if (!state.agent || state.running) {
        return;
    }

    if (!question && state.files.length === 0) {
        setStatus("请输入问题或上传文件");
        return;
    }

    state.running = true;
    state.abortController = new AbortController();
    setBusy(true);
    setStatus("正在运行对话 Agent...");

    const filesForRequest = [...state.files];
    const historyForRequest = [...state.conversationHistory];
    const userText = question || "请处理我上传的附件。";

    resetComposer();
    appendMessage("user", userText, filesForRequest.map(file => file.name));
    saveConversationMessage("user", userText, filesForRequest.map(file => file.name));
    state.conversationHistory.push({ role: "user", content: userText });
    await nextPaint();

    const assistantBubble = appendMessage("assistant", "");
    showThinkingIndicator(assistantBubble);

    try {
        const response = await fetch(`/api/conversation-agents/${encodeURIComponent(state.agent.id)}/preview/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: state.abortController.signal,
            body: JSON.stringify({
                agent: buildAgentRequestPayload(state.agent),
                message: await buildRequestMessage(question, filesForRequest),
                history: historyForRequest
            })
        });

        if (!response.ok || !response.body) {
            throw new Error((await response.text()).replace(/^"|"$/g, ""));
        }

        let reply = "";
        let completed = false;

        await EaseGptSse.consume(response.body, event => {
            if (event.type === "preview.progress") {
                const latestStep = Array.isArray(event.steps) && event.steps.length
                    ? String(event.steps[event.steps.length - 1]?.message || "").trim()
                    : "";
                setStatus(latestStep ? `正在执行：${latestStep}` : "正在运行对话 Agent...");
                return;
            }

            if (event.type === "preview.completed") {
                reply = String(event.reply || "").trim() || "模型未返回内容。";
                completed = true;
                return;
            }

            if (event.type === "preview.error") {
                throw new Error(event.error || "执行失败。");
            }
        });

        if (!completed) {
            throw new Error("运行未返回完成结果。");
        }

        renderMessageContent(assistantBubble, reply, "assistant");
        scrollToLatestMessage();
        saveConversationMessage("assistant", reply, []);
        state.conversationHistory.push({ role: "assistant", content: reply });
        setStatus("对话 Agent 运行完成");
    } catch (error) {
        const message = error.name === "AbortError"
            ? "已终止运行"
            : `执行失败：${error.message}`;
        renderMessageContent(assistantBubble, message, "assistant");
        saveConversationMessage("assistant", message, []);
        setStatus(message);
    } finally {
        state.abortController = null;
        state.running = false;
        setBusy(false);
    }
}

function stopExecution() {
    if (!state.abortController) {
        return;
    }

    setStatus("正在终止运行...");
    stopButton.disabled = true;
    state.abortController.abort();
}

function setBusy(busy) {
    sendButton.hidden = busy;
    sendButton.disabled = busy;
    stopButton.hidden = !busy;
    stopButton.disabled = !busy;
}

function renderFiles() {
    fileList.innerHTML = "";
    for (const file of state.files) {
        const chip = document.createElement("span");
        chip.className = "file-chip";
        chip.textContent = `${file.name} · ${formatBytes(file.size)}`;
        fileList.appendChild(chip);
    }
}

function resetComposer() {
    questionInput.value = "";
    questionInput.style.height = "auto";
    fileInput.value = "";
    state.files = [];
    renderFiles();
}

function startNewConversation() {
    state.sessionId = createSessionId();
    state.conversationHistory = [];
    messages.innerHTML = "";
    resetComposer();
    if (state.agent?.openingStatement) {
        appendMessage("assistant", state.agent.openingStatement);
    }
    setStatus("已开始新对话");
    document.body.classList.remove("sidebar-open");
}

function normalizeAgent(agent) {
    const normalized = agent && typeof agent === "object" ? { ...agent } : {};
    normalized.instructions = typeof normalized.instructions === "string" ? normalized.instructions : "";
    normalized.openingStatement = typeof normalized.openingStatement === "string" ? normalized.openingStatement : "";
    normalized.suggestedQuestions = Array.isArray(normalized.suggestedQuestions) ? normalized.suggestedQuestions : [];
    normalized.knowledgeBaseIds = Array.isArray(normalized.knowledgeBaseIds) ? normalized.knowledgeBaseIds : [];
    normalized.recallRerankModel = typeof normalized.recallRerankModel === "string" ? normalized.recallRerankModel : "none";
    normalized.recallTopK = Number.isFinite(Number(normalized.recallTopK)) ? Number(normalized.recallTopK) : 4;
    normalized.recallScoreThresholdEnabled = Boolean(normalized.recallScoreThresholdEnabled);
    normalized.recallScoreThreshold = Number.isFinite(Number(normalized.recallScoreThreshold))
        ? Number(normalized.recallScoreThreshold)
        : 0;
    normalized.temperature = Number.isFinite(Number(normalized.temperature)) ? Number(normalized.temperature) : 0.7;
    normalized.maxTokens = Number.isFinite(Number(normalized.maxTokens)) ? Number(normalized.maxTokens) : 2048;
    return normalized;
}

function buildAgentRequestPayload(agent) {
    const normalized = normalizeAgent(agent);
    return {
        ...normalized,
        instructions: normalized.instructions ?? "",
        openingStatement: normalized.openingStatement ?? "",
        suggestedQuestions: normalized.suggestedQuestions,
        knowledgeBaseIds: normalized.knowledgeBaseIds
    };
}

function saveConversationMessage(role, text, files) {
    const conversations = loadRecent();
    let conversation = conversations.find(item => item.id === state.sessionId);

    if (!conversation) {
        conversation = {
            id: state.sessionId,
            title: role === "user" ? createConversationTitle(text, files) : "新对话",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: []
        };
        conversations.unshift(conversation);
    }

    if (conversation.title === "新对话" && role === "user") {
        conversation.title = createConversationTitle(text, files);
    }

    conversation.updatedAt = new Date().toISOString();
    conversation.messages.push({ role, text, files });

    const sorted = conversations
        .filter(item => item.messages.length > 0)
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .slice(0, 20);

    localStorage.setItem(recentKey, JSON.stringify(sorted));
    renderRecent();
}

function createConversationTitle(text, files) {
    if (text) return text.slice(0, 32);
    if (files.length > 0) return `文件处理：${files[0]}`;
    return "新对话";
}

function loadRecent() {
    try {
        return JSON.parse(localStorage.getItem(recentKey) || "[]");
    } catch {
        return [];
    }
}

function renderRecent() {
    const list = loadRecent();
    recentList.innerHTML = "";

    if (list.length === 0) {
        const empty = document.createElement("div");
        empty.className = "recent-empty";
        empty.textContent = "暂无最近对话";
        recentList.appendChild(empty);
        return;
    }

    for (const item of list) {
        const row = document.createElement("div");
        row.className = "recent-row";

        const link = document.createElement("a");
        link.href = "#";
        link.className = "recent-item";
        link.textContent = item.title;
        link.addEventListener("click", event => {
            event.preventDefault();
            loadConversation(item.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "recent-delete";
        deleteButton.textContent = "×";
        deleteButton.title = "删除";
        deleteButton.setAttribute("aria-label", `删除对话：${item.title}`);
        deleteButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            deleteConversation(item.id);
        });

        row.append(link, deleteButton);
        recentList.appendChild(row);
    }
}

function deleteConversation(sessionId) {
    const conversations = loadRecent().filter(item => item.id !== sessionId);
    localStorage.setItem(recentKey, JSON.stringify(conversations));

    if (state.sessionId === sessionId) {
        startNewConversation();
    } else {
        renderRecent();
    }

    setStatus("最近对话已删除");
}

function loadConversation(sessionId) {
    const conversation = loadRecent().find(item => item.id === sessionId);
    if (!conversation) {
        return;
    }

    state.sessionId = sessionId;
    state.conversationHistory = [];
    messages.innerHTML = "";
    for (const message of conversation.messages) {
        appendMessage(message.role, message.text, message.files ?? []);
        state.conversationHistory.push({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.text
        });
    }
    resetComposer();
    setStatus("已加载最近对话");
    document.body.classList.remove("sidebar-open");
}

async function buildRequestMessage(question, files) {
    if (files.length === 0) {
        return question;
    }

    const attachments = await Promise.all(files.map(async file => {
        if (isTextFile(file)) {
            const text = (await readAsText(file)).trim();
            const preview = text.length > 12000
                ? `${text.slice(0, 12000)}\n...[内容已截断]`
                : (text || "[空文本文件]");
            return `附件：${file.name}\n${preview}`;
        }

        return `附件：${file.name}\n[当前运行页暂不解析该文件类型，仅记录文件名。]`;
    }));

    const prompt = question || "请结合以下附件内容进行处理。";
    return `${prompt}\n\n以下是我上传的附件内容：\n\n${attachments.join("\n\n")}`;
}

function appendMessage(role, text, files = []) {
    const article = document.createElement("article");
    article.className = `message ${role}`;
    const fileText = files.length > 0 ? `\n\n已上传：${files.join("、")}` : "";

    article.innerHTML = `<div class="bubble"><div class="message-content"></div></div>`;

    const content = article.querySelector(".message-content");
    renderMessageContent(content, `${text}${fileText}`, role);
    messages.appendChild(article);
    article.scrollIntoView({ behavior: "smooth", block: "end" });
    return content;
}

function showThinkingIndicator(container) {
    container.className = "message-content thinking-dots";
    container.setAttribute("aria-label", "正在思考");
    container.innerHTML = "<span></span><span></span><span></span>";
}

function renderMessageContent(container, text, role) {
    container.className = "message-content";
    container.removeAttribute("aria-label");

    if (role === "assistant" && looksLikeMarkdown(text)) {
        container.classList.add("markdown-content");
        container.innerHTML = renderMarkdown(text);
        return;
    }

    container.classList.add("plain-text");
    container.textContent = text;
}

function looksLikeMarkdown(text) {
    return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|---+\s*$)|(\*\*|__|~~|`[^`\n]+`|\[[^\]]+\]\([^)]+\))/m.test(text);
}

function renderMarkdown(markdown) {
    const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let index = 0;

    while (index < lines.length) {
        const line = lines[index];
        const fence = line.match(/^\s*```([\w-]*)\s*$/);
        if (fence) {
            const code = [];
            index += 1;
            while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
                code.push(lines[index]);
                index += 1;
            }
            index += index < lines.length ? 1 : 0;
            const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : "";
            html.push(`<pre><code${language}>${escapeHtml(code.join("\n"))}</code></pre>`);
            continue;
        }

        const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
            index += 1;
            continue;
        }

        if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
            html.push("<hr>");
            index += 1;
            continue;
        }

        const listMatch = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
        if (listMatch) {
            const ordered = Boolean(listMatch[2]);
            const tag = ordered ? "ol" : "ul";
            const items = [];
            while (index < lines.length) {
                const item = lines[index].match(/^\s*(?:([-*+])|(\d+)\.)\s+(.+)$/);
                if (!item || Boolean(item[2]) !== ordered) break;
                items.push(`<li>${renderInlineMarkdown(item[3])}</li>`);
                index += 1;
            }
            html.push(`<${tag}>${items.join("")}</${tag}>`);
            continue;
        }

        const quote = line.match(/^\s*>\s?(.*)$/);
        if (quote) {
            const quoted = [];
            while (index < lines.length) {
                const quotedLine = lines[index].match(/^\s*>\s?(.*)$/);
                if (!quotedLine) break;
                quoted.push(quotedLine[1]);
                index += 1;
            }
            html.push(`<blockquote>${renderInlineMarkdown(quoted.join("\n"))}</blockquote>`);
            continue;
        }

        if (!line.trim()) {
            index += 1;
            continue;
        }

        const paragraph = [line];
        index += 1;
        while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index])) {
            paragraph.push(lines[index]);
            index += 1;
        }
        html.push(`<p>${renderInlineMarkdown(paragraph.join("\n"))}</p>`);
    }

    return html.join("");
}

function isMarkdownBlockStart(line) {
    return /^\s*```|^\s{0,3}#{1,6}\s|^\s*(?:[-*+]|\d+\.)\s+|^\s*>|^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function renderInlineMarkdown(text) {
    let value = escapeHtml(text);
    value = value.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    value = value.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    value = value.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    value = value.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    value = value.replace(/(^|[^\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return value.replace(/\n/g, "<br>");
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

function setStatus(message) {
    statusText.textContent = message;
}

function scrollToLatestMessage() {
    messages.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "end" });
}

function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function createSessionId() {
    return `session-${crypto.randomUUID()}`;
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** exponent);
    return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
