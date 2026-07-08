const workflowId = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "");

const designerShell = document.querySelector(".designer-shell");
const designerViewButtons = Array.from(document.querySelectorAll("[data-designer-view]"));
const designerLogsView = document.querySelector(".designer-logs-view");
const logsFilterForm = document.getElementById("logsFilterForm");
const logsStartInput = document.getElementById("logsStartInput");
const logsEndInput = document.getElementById("logsEndInput");
const logsKeywordInput = document.getElementById("logsKeywordInput");
const logsTableBody = document.getElementById("logsTableBody");
const logsEmpty = document.getElementById("logsEmpty");
const workflowTitle = document.getElementById("workflowTitle");
const workflowDescription = document.getElementById("workflowDescription");
const workflowIcon = document.getElementById("workflowIcon");
const statusText = document.getElementById("statusText");
const designerToast = document.getElementById("designerToast");
const nodePalette = document.getElementById("nodePalette");
const paletteTabs = document.querySelectorAll("[data-palette-tab]");
const rightPanelResizer = document.getElementById("rightPanelResizer");
const canvasViewport = document.getElementById("canvasViewport");
const canvasWorld = document.getElementById("canvasWorld");
const canvas = document.getElementById("canvas");
const edgeLayer = document.getElementById("edgeLayer");
const addNodeMenuButton = document.getElementById("addNodeMenuButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const floatingNodePalette = document.getElementById("floatingNodePalette");
const saveButton = document.getElementById("saveButton");
const runTestButton = document.getElementById("runTestButton");
const systemVariablesButton = document.getElementById("systemVariablesButton");
const publishMenuButton = document.getElementById("publishMenuButton");
const publishMenu = document.getElementById("publishMenu");
let saveUpdateButton = null;
let runButton = null;
const systemVariablesDialog = document.getElementById("systemVariablesDialog");
const closeVariablesDialogButton = document.getElementById("closeVariablesDialogButton");
const systemVariablesList = document.getElementById("systemVariablesList");
const canvasContextMenu = document.getElementById("canvasContextMenu");
const contextFitButton = document.getElementById("contextFitButton");
const contextDeleteButton = document.getElementById("contextDeleteButton");
const propertyTitle = document.getElementById("propertyTitle");
const propertyEmpty = document.getElementById("propertyEmpty");
const propertyPanel = document.querySelector(".property-panel");
const nodeForm = document.getElementById("nodeForm");
const edgeForm = document.getElementById("edgeForm");
const nodeNameInput = document.getElementById("nodeNameInput");
const nodeSettingsInput = document.getElementById("nodeSettingsInput");
const genericSettingsPanel = document.getElementById("genericSettingsPanel");
const manualSettingsPanel = document.getElementById("manualSettingsPanel");
const manualFieldList = document.getElementById("manualFieldList");
const addManualFieldButton = document.getElementById("addManualFieldButton");
const llmSettingsPanel = document.getElementById("llmSettingsPanel");
const llmProviderConfigPicker = document.getElementById("llmProviderConfigPicker");
const llmProviderConfigSelect = document.getElementById("llmProviderConfigSelect");
const llmSystemPromptInput = document.getElementById("llmSystemPromptInput");
const llmUserPromptInput = document.getElementById("llmUserPromptInput");
const llmTimeoutInput = document.getElementById("llmTimeoutInput");
const llmFileInput = document.getElementById("llmFileInput");
const llmFileList = document.getElementById("llmFileList");
const agentSettingsPanel = document.getElementById("agentSettingsPanel");
const agentProviderConfigPicker = document.getElementById("agentProviderConfigPicker");
const agentProviderConfigSelect = document.getElementById("agentProviderConfigSelect");
const agentMessageInput = document.getElementById("agentMessageInput");
const agentInstructionInput = document.getElementById("agentInstructionInput");
const agentMaxIterationsInput = document.getElementById("agentMaxIterationsInput");
const addAgentToolButton = document.getElementById("addAgentToolButton");
const agentToolPicker = document.getElementById("agentToolPicker");
const agentToolList = document.getElementById("agentToolList");
const agentTimeoutInput = document.getElementById("agentTimeoutInput");
const scheduleSettingsPanel = document.getElementById("scheduleSettingsPanel");
const scheduleTypeSelect = document.getElementById("scheduleTypeSelect");
const scheduleIntervalField = document.getElementById("scheduleIntervalField");
const scheduleIntervalInput = document.getElementById("scheduleIntervalInput");
const scheduleCronFields = document.getElementById("scheduleCronFields");
const scheduleCronInput = document.getElementById("scheduleCronInput");
const scheduleTimeZoneSelect = document.getElementById("scheduleTimeZoneSelect");
const currentTimeSettingsPanel = document.getElementById("currentTimeSettingsPanel");
const currentTimeModeSelect = document.getElementById("currentTimeModeSelect");
const currentTimeTimeZoneField = document.getElementById("currentTimeTimeZoneField");
const currentTimeTimeZoneInput = document.getElementById("currentTimeTimeZoneInput");
const currentTimeFormatInput = document.getElementById("currentTimeFormatInput");
const forEachSettingsPanel = document.getElementById("forEachSettingsPanel");
const forEachItemsVariableInput = document.getElementById("forEachItemsVariableInput");
const forEachItemVariableInput = document.getElementById("forEachItemVariableInput");
const forEachIndexVariableInput = document.getElementById("forEachIndexVariableInput");
const classifierSettingsPanel = document.getElementById("classifierSettingsPanel");
const classifierProviderConfigPicker = document.getElementById("classifierProviderConfigPicker");
const classifierProviderConfigSelect = document.getElementById("classifierProviderConfigSelect");
const classifierInput = document.getElementById("classifierInput");
const classifierInstruction = document.getElementById("classifierInstruction");
const classifierClassList = document.getElementById("classifierClassList");
const addClassifierClassButton = document.getElementById("addClassifierClassButton");
const knowledgeRetrievalSettingsPanel = document.getElementById("knowledgeRetrievalSettingsPanel");
const knowledgeRetrievalQueryInput = document.getElementById("knowledgeRetrievalQueryInput");
const addKnowledgeRetrievalBaseButton = document.getElementById("addKnowledgeRetrievalBaseButton");
const knowledgeRetrievalBasePicker = document.getElementById("knowledgeRetrievalBasePicker");
const knowledgeRetrievalBaseList = document.getElementById("knowledgeRetrievalBaseList");
const knowledgeRetrievalRerankSelect = document.getElementById("knowledgeRetrievalRerankSelect");
const knowledgeRetrievalTopKInput = document.getElementById("knowledgeRetrievalTopKInput");
const knowledgeRetrievalThresholdEnabledInput = document.getElementById("knowledgeRetrievalThresholdEnabledInput");
const knowledgeRetrievalThresholdField = document.getElementById("knowledgeRetrievalThresholdField");
const knowledgeRetrievalThresholdInput = document.getElementById("knowledgeRetrievalThresholdInput");
const httpSettingsPanel = document.getElementById("httpSettingsPanel");
const httpMethodSelect = document.getElementById("httpMethodSelect");
const httpUrlInput = document.getElementById("httpUrlInput");
const httpQueryList = document.getElementById("httpQueryList");
const addHttpQueryButton = document.getElementById("addHttpQueryButton");
const httpHeaderList = document.getElementById("httpHeaderList");
const addHttpHeaderButton = document.getElementById("addHttpHeaderButton");
const httpBodyInput = document.getElementById("httpBodyInput");
const httpTimeoutInput = document.getElementById("httpTimeoutInput");
const httpRetryInput = document.getElementById("httpRetryInput");
const mailReadSettingsPanel = document.getElementById("mailReadSettingsPanel");
const mailProtocolSelect = document.getElementById("mailProtocolSelect");
const mailHostInput = document.getElementById("mailHostInput");
const mailPortInput = document.getElementById("mailPortInput");
const mailSecuritySelect = document.getElementById("mailSecuritySelect");
const mailUsernameInput = document.getElementById("mailUsernameInput");
const mailPasswordInput = document.getElementById("mailPasswordInput");
const mailFolderField = document.getElementById("mailFolderField");
const mailFolderInput = document.getElementById("mailFolderInput");
const mailMaxMessagesInput = document.getElementById("mailMaxMessagesInput");
const mailTimeoutInput = document.getElementById("mailTimeoutInput");
const mailMaxAttachmentBytesInput = document.getElementById("mailMaxAttachmentBytesInput");
const mailUnreadOnlyInput = document.getElementById("mailUnreadOnlyInput");
const mailIgnoreKnownInput = document.getElementById("mailIgnoreKnownInput");
const mailMarkAsReadInput = document.getElementById("mailMarkAsReadInput");
const mailPopDeleteField = document.getElementById("mailPopDeleteField");
const mailPopDeleteInput = document.getElementById("mailPopDeleteInput");
const mailIncludeAttachmentsInput = document.getElementById("mailIncludeAttachmentsInput");
const webCrawlerSettingsPanel = document.getElementById("webCrawlerSettingsPanel");
const webCrawlerUrlInput = document.getElementById("webCrawlerUrlInput");
const webCrawlerUserAgentInput = document.getElementById("webCrawlerUserAgentInput");
const webCrawlerGenerateSummaryInput = document.getElementById("webCrawlerGenerateSummaryInput");
const webCrawlerTimeoutInput = document.getElementById("webCrawlerTimeoutInput");
const webCrawlerRetryInput = document.getElementById("webCrawlerRetryInput");
const webCrawlerMaxLengthInput = document.getElementById("webCrawlerMaxLengthInput");
const wecomSettingsPanel = document.getElementById("wecomSettingsPanel");
const wecomWebhookUrlInput = document.getElementById("wecomWebhookUrlInput");
const wecomContentInput = document.getElementById("wecomContentInput");
const wecomMentionedListInput = document.getElementById("wecomMentionedListInput");
const wecomMentionedMobileListInput = document.getElementById("wecomMentionedMobileListInput");
const databaseSettingsPanel = document.getElementById("databaseSettingsPanel");
const databaseProviderSelect = document.getElementById("databaseProviderSelect");
const databaseModeSelect = document.getElementById("databaseModeSelect");
const databaseHostInput = document.getElementById("databaseHostInput");
const databasePortInput = document.getElementById("databasePortInput");
const databaseNameInput = document.getElementById("databaseNameInput");
const databaseUsernameInput = document.getElementById("databaseUsernameInput");
const databasePasswordInput = document.getElementById("databasePasswordInput");
const databaseSslInput = document.getElementById("databaseSslInput");
const databaseSqlInput = document.getElementById("databaseSqlInput");
const databaseParameterList = document.getElementById("databaseParameterList");
const addDatabaseParameterButton = document.getElementById("addDatabaseParameterButton");
const databaseTimeoutInput = document.getElementById("databaseTimeoutInput");
const outputSettingsPanel = document.getElementById("outputSettingsPanel");
const outputVariableSelect = document.getElementById("outputVariableSelect");
const outputFormatSelect = document.getElementById("outputFormatSelect");
const outputCustomValueField = document.getElementById("outputCustomValueField");
const outputCustomValueInput = document.getElementById("outputCustomValueInput");
const outputTableSettings = document.getElementById("outputTableSettings");
const outputTableColumnList = document.getElementById("outputTableColumnList");
const addOutputTableColumnButton = document.getElementById("addOutputTableColumnButton");
const edgeSourceInput = document.getElementById("edgeSourceInput");
const edgeTargetInput = document.getElementById("edgeTargetInput");
const edgePortInput = document.getElementById("edgePortInput");
const applyEdgeButton = document.getElementById("applyEdgeButton");
const manualFieldDialog = document.getElementById("manualFieldDialog");
const manualFieldForm = document.getElementById("manualFieldForm");
const manualFieldDialogTitle = document.getElementById("manualFieldDialogTitle");
const closeManualFieldDialogButton = document.getElementById("closeManualFieldDialogButton");
const cancelManualFieldButton = document.getElementById("cancelManualFieldButton");
const manualFieldTypeList = document.getElementById("manualFieldTypeList");
const manualFieldNameInput = document.getElementById("manualFieldNameInput");
const manualFieldLabelInput = document.getElementById("manualFieldLabelInput");
const manualFieldDescriptionInput = document.getElementById("manualFieldDescriptionInput");
const manualFieldOptionsInput = document.getElementById("manualFieldOptionsInput");
const manualFieldRequiredInput = document.getElementById("manualFieldRequiredInput");
const manualFieldDateOnlyField = document.getElementById("manualFieldDateOnlyField");
const manualFieldDateOnlyInput = document.getElementById("manualFieldDateOnlyInput");
const manualFieldDefaultInput = document.getElementById("manualFieldDefaultInput");
const agentToolDialog = document.getElementById("agentToolDialog");
const agentToolForm = document.getElementById("agentToolForm");
const agentToolDialogTitle = document.getElementById("agentToolDialogTitle");
const closeAgentToolDialogButton = document.getElementById("closeAgentToolDialogButton");
const cancelAgentToolButton = document.getElementById("cancelAgentToolButton");
const deleteAgentToolButton = document.getElementById("deleteAgentToolButton");
const agentToolTypeDisplay = document.getElementById("agentToolTypeDisplay");
const agentToolNameInput = document.getElementById("agentToolNameInput");
const agentToolPurposeInput = document.getElementById("agentToolPurposeInput");
const agentToolResourceInput = document.getElementById("agentToolResourceInput");
const agentToolGuardrailsInput = document.getElementById("agentToolGuardrailsInput");
const agentCurrentTimeToolFields = document.getElementById("agentCurrentTimeToolFields");
const agentCurrentTimeModeInput = document.getElementById("agentCurrentTimeModeInput");
const agentCurrentTimeTimeZoneField = document.getElementById("agentCurrentTimeTimeZoneField");
const agentCurrentTimeTimeZoneInput = document.getElementById("agentCurrentTimeTimeZoneInput");
const agentCurrentTimeFormatInput = document.getElementById("agentCurrentTimeFormatInput");
const agentHttpToolFields = document.getElementById("agentHttpToolFields");
const agentHttpMethodInput = document.getElementById("agentHttpMethodInput");
const agentHttpTimeoutInput = document.getElementById("agentHttpTimeoutInput");
const agentHttpRetryInput = document.getElementById("agentHttpRetryInput");
const agentHttpUrlInput = document.getElementById("agentHttpUrlInput");
const addAgentHttpQueryButton = document.getElementById("addAgentHttpQueryButton");
const addAgentHttpHeaderButton = document.getElementById("addAgentHttpHeaderButton");
const agentHttpQueryList = document.getElementById("agentHttpQueryList");
const agentHttpHeaderList = document.getElementById("agentHttpHeaderList");
const agentHttpBodyInput = document.getElementById("agentHttpBodyInput");
const agentWebCrawlerToolFields = document.getElementById("agentWebCrawlerToolFields");
const agentWebUrlInput = document.getElementById("agentWebUrlInput");
const agentWebUserAgentInput = document.getElementById("agentWebUserAgentInput");
const agentWebTimeoutInput = document.getElementById("agentWebTimeoutInput");
const agentWebRetryInput = document.getElementById("agentWebRetryInput");
const agentWebMaxLengthInput = document.getElementById("agentWebMaxLengthInput");
const agentWebSummaryInput = document.getElementById("agentWebSummaryInput");
const agentDatabaseToolFields = document.getElementById("agentDatabaseToolFields");
const agentDatabaseProviderInput = document.getElementById("agentDatabaseProviderInput");
const agentDatabasePortInput = document.getElementById("agentDatabasePortInput");
const agentDatabaseTimeoutInput = document.getElementById("agentDatabaseTimeoutInput");
const agentDatabaseHostInput = document.getElementById("agentDatabaseHostInput");
const agentDatabaseNameInput = document.getElementById("agentDatabaseNameInput");
const agentDatabaseUsernameInput = document.getElementById("agentDatabaseUsernameInput");
const agentDatabasePasswordInput = document.getElementById("agentDatabasePasswordInput");
const agentDatabaseSslInput = document.getElementById("agentDatabaseSslInput");
const agentDatabaseModeInput = document.getElementById("agentDatabaseModeInput");
const agentDatabaseSqlInput = document.getElementById("agentDatabaseSqlInput");
const addAgentDatabaseParameterButton = document.getElementById("addAgentDatabaseParameterButton");
const agentDatabaseParameterList = document.getElementById("agentDatabaseParameterList");
const initialLogRange = createDefaultLogRange();

const chineseNodeNames = {
    "trigger.manual": "用户输入",
    "trigger.schedule": "定时触发",
    "data.template": "输出",
    "utility.current-time": "时间",
    "integration.http-request": "HTTP 请求",
    "integration.mail-read": "邮件读取",
    "flow.for-each": "For Each",
    "integration.web-crawler": "网页抓取",
    "integration.wecom-message": "企业微信群消息推送",
    "integration.database": "Database",
    "ai.agent": "Agent",
    "ai.llm-chat": "LLM",
    "ai.knowledge-retrieval": "知识检索",
    "ai.question-classifier": "问题分类器"
};

const palettePriority = [
    "trigger.manual",
    "ai.agent",
    "ai.llm-chat",
    "ai.knowledge-retrieval",
    "ai.question-classifier",
    "utility.current-time",
    "integration.mail-read",
    "flow.for-each",
    "data.template",
    "integration.web-crawler",
    "integration.wecom-message"
];

const legacyDefaultNames = {
    "trigger.manual": ["手动触发", "手动开始", "Manual Trigger", "Manual start"],
    "ai.agent": ["Agent", "AI Agent"],
    "ai.llm-chat": ["LLM 对话", "Ask LLM", "LLM Chat"],
    "utility.current-time": ["Current Time", "时间", "Get Current Time", "get_current_time"],
    "data.template": ["模板输出", "Output LLM info", "输出 LLM 信息", "输出 LLM 消息"],
    "integration.mail-read": ["邮件读取", "Mail Read", "Read Mail", "Read Email"],
    "flow.for-each": ["For Each", "循环", "遍历", "逐条处理", "Loop"],
    "integration.wecom-message": ["企业微信消息"]
};
const nodeIcons = {
    "trigger.manual": '<path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M5 21h14"/>',
    "ai.agent": '<path d="M12 3a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h1V7a4 4 0 0 1 4-4Z"/><path d="M9 12h6"/><path d="M12 9v6"/>',
    "ai.llm-chat": '<path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5Z"/><path d="m5 15-.8 2.2L2 18l2.2.8L5 21l.8-2.2L8 18l-2.2-.8Z"/><path d="m19 14-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8Z"/>',
    "utility.current-time": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M12 3v2"/><path d="M21 12h-2"/>',
    "integration.mail-read": '<path d="M3 7h18v10H3z"/><path d="m4 8 8 6 8-6"/>',
    "flow.for-each": '<path d="M7 7h11"/><path d="m14 4 4 3-4 3"/><path d="M17 17H6"/><path d="m10 14-4 3 4 3"/>',
    "data.template": '<path d="M9 11 5 15l4 4"/><path d="m15 11 4 4-4 4"/><path d="M12 3v12"/>',
    "trigger.schedule": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "integration.http-request": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/>',
    "integration.database": '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
    "ai.question-classifier": '<path d="M4 5h6"/><path d="M4 12h6"/><path d="M4 19h6"/><path d="m14 5 2 2 4-4"/><path d="m14 12 2 2 4-4"/><path d="m14 19 2 2 4-4"/>'
};

const variableDescriptions = {
    question: "当前工作流接收到的主问题或主输入文本。",
    files: "用户上传的文件列表，通常用于多模态或文档处理。",
    scheduledAt: "定时触发节点本次触发的时间。",
    triggerNodeId: "触发本次执行的触发节点 ID。",
    agentReply: "Agent 节点最终输出的回答文本。",
    agentProvider: "Agent 节点实际使用的模型供应商。",
    agentModel: "Agent 节点实际使用的模型名称。",
    agentExecutionMode: "Agent 执行模式，通常为 native-tools 或 react。",
    agentTrace: "Agent 的执行轨迹，包含工具调用和最终回答过程。",
    llmText: "LLM 节点返回的文本内容。",
    llmProvider: "LLM 节点实际使用的模型供应商。",
    llmModel: "LLM 节点实际使用的模型名称。",
    currentTime: "按节点配置格式化后的当前时间。",
    currentTimeIso: "ISO 8601 格式的当前时间。",
    currentTimeUtc: "UTC 时区下的当前时间。",
    currentTimeZone: "当前时间对应的时区 ID 或名称。",
    currentUnixTimeSeconds: "当前 Unix 时间戳，单位为秒。",
    mailProtocol: "本次邮件读取使用的协议，例如 imap 或 pop3。",
    mailFolder: "本次读取的邮箱文件夹，POP3 通常等价于收件箱。",
    mailCount: "本次实际读取到的邮件数量。",
    mailFetchedCount: "本次从服务器取回并检查过的邮件数量，包含已忽略邮件。",
    mailSkippedCount: "本次因命中内置邮件指纹库而跳过处理的邮件数量。",
    mailItems: "本次实际处理的邮件对象数组，可配合 For Each 节点逐条遍历。",
    mailMessages: "本次读取到的完整邮件列表，每项包含主题、发件人、正文、附件等信息。",
    latestMailItem: "最新一封邮件的原始对象。",
    latestMail: "最新一封邮件的完整对象。",
    latestMailText: "最新一封邮件的纯文本正文。",
    latestMailHtml: "最新一封邮件的 HTML 正文。",
    latestMailAttachments: "最新一封邮件的附件列表。",
    forEachCount: "For Each 节点本次遍历的总项目数。",
    knowledgeQuery: "知识检索节点实际执行的查询文本。",
    knowledgeHits: "知识检索命中的片段列表。",
    knowledgeContext: "拼接后的知识上下文文本，适合直接给模型使用。",
    knowledgeHitCount: "知识检索命中的片段数量。",
    questionClassId: "问题分类器命中的分类 ID。",
    questionClassName: "问题分类器命中的分类名称。",
    statusCode: "HTTP 请求节点返回的状态码。",
    responseBody: "HTTP 请求节点返回的响应正文。",
    requestAttempts: "HTTP 请求节点本次执行的请求次数，包含重试。",
    webUrl: "网页抓取节点实际抓取的网页地址。",
    webTitle: "抓取网页的标题。",
    webDescription: "抓取网页的描述信息。",
    webContent: "抓取网页提取出的正文内容。",
    webSummary: "网页抓取节点生成的摘要。",
    webLinks: "网页中提取出的链接列表。",
    webStatusCode: "网页抓取请求返回的状态码。",
    webContentType: "网页响应的 Content-Type。",
    webRequestAttempts: "网页抓取节点本次请求次数，包含重试。",
    databaseRows: "数据库查询返回的数据行列表。",
    affectedRows: "数据库执行写入或更新时影响的行数。",
    text: "输出节点自定义输出的文本结果。",
    "var.workflowId": "当前工作流的 ID。",
    "var.executionId": "当前这次执行的唯一 ID。",
    "var.triggeredAt": "当前执行开始的时间。"
};

const state = {
    workflow: null,
    nodeTypes: [],
    providerConfigs: [],
    knowledgeBases: [],
    rerankModelOptions: [],
    selected: null,
    connectingFrom: null,
    drag: null,
    panelResize: null,
    paletteTab: "nodes",
    canvasScale: 1,
    manualInputFields: [],
    manualFieldType: "text",
    manualFieldEditIndex: null,
    manualFieldDragIndex: null,
    outputTableColumns: [],
    currentView: "design",
    executions: [],
    logFilters: {
        from: initialLogRange.from,
        to: initialLogRange.to,
        keyword: ""
    },
    llmPickerOpen: false,
    llmPickerSearch: "",
    classifierPickerOpen: false,
    classifierPickerSearch: "",
    agentPickerOpen: false,
    agentPickerSearch: "",
    agentTools: [],
    agentToolDialogIndex: null,
    agentToolDraft: null,
    agentToolDraftOriginal: null,
    agentToolPickerOpen: false,
    knowledgeRetrievalBaseIds: [],
    knowledgeRetrievalPickerOpen: false,
    knowledgeRetrievalSearch: ""
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

const agentAutoInstructionSectionStart = "## 自动工具生成部分";
const agentAutoInstructionSectionEnd = "## /自动工具生成部分";

const extensionNodeTypes = new Set(["integration.mail-read", "integration.web-crawler", "integration.wecom-message"]);
const manualFieldTypes = [
    { type: "text", label: "文本输入框", iconSrc: "/assets/png/TextBox.png" },
    { type: "paragraph", label: "段落变量", iconSrc: "/assets/png/RichTextBox.png" },
    { type: "password", label: "密码", iconSrc: "/assets/png/PasswordBox.png" },
    { type: "number", label: "数字输入框", iconSrc: "/assets/png/DomainType.png" },
    { type: "radio", label: "单选框", iconSrc: "/assets/png/RadioButton.png" },
    { type: "checkbox", label: "多选框", iconSrc: "/assets/png/CheckBoxList.png" },
    { type: "single-checkbox", label: "复选框", iconSrc: "/assets/png/CheckBoxChecked.png" },
    { type: "select", label: "下拉列表框", iconSrc: "/assets/png/ComboBox.png" },
    { type: "switch", label: "开关", iconSrc: "/assets/png/ButtonGroup.png" },
    { type: "datetime", label: "时间点", iconSrc: "/assets/png/Calendar.png" },
    { type: "daterange", label: "时间范围", iconSrc: "/assets/png/MonthCalendar.png" },
    { type: "file", label: "文件上传", iconSrc: "/assets/png/FileDestination.png" }
];

setupPublishControls();
designerViewButtons.forEach(button => {
    button.addEventListener("click", () => switchDesignerView(button.dataset.designerView));
});
logsFilterForm?.addEventListener("submit", submitLogFilters);
initializeLogFilterInputs();
llmProviderConfigPicker.addEventListener("click", handleLlmPickerClick);
llmProviderConfigPicker.addEventListener("input", handleLlmPickerSearch);
classifierProviderConfigPicker?.addEventListener("click", handleClassifierPickerClick);
classifierProviderConfigPicker?.addEventListener("input", handleClassifierPickerSearch);
agentProviderConfigPicker?.addEventListener("click", handleAgentPickerClick);
agentProviderConfigPicker?.addEventListener("input", handleAgentPickerSearch);
saveButton.addEventListener("click", togglePublishMenu);
runTestButton.hidden = false;
runTestButton.addEventListener("click", openRunTest);
systemVariablesButton.addEventListener("click", openSystemVariablesDialog);
saveUpdateButton?.addEventListener("click", async () => {
    publishMenu.hidden = true;
    publishMenuButton.setAttribute("aria-expanded", "false");
    saveButton.setAttribute("aria-expanded", "false");
    await saveWorkflow();
});
runButton?.addEventListener("click", saveAndRunWorkflow);
closeVariablesDialogButton.addEventListener("click", () => systemVariablesDialog.close());
document.addEventListener("click", () => {
    publishMenu.hidden = true;
    publishMenuButton.setAttribute("aria-expanded", "false");
    saveButton.setAttribute("aria-expanded", "false");
});
contextFitButton.addEventListener("click", () => {
    hideCanvasContextMenu();
    fitCanvas();
});
contextDeleteButton.addEventListener("click", () => {
    hideCanvasContextMenu();
    deleteSelected();
});
nodeForm.addEventListener("submit", event => event.preventDefault());
applyEdgeButton.addEventListener("click", applyEdgeSettings);
llmFileInput.addEventListener("change", addBuiltInFiles);
addClassifierClassButton.addEventListener("click", addClassifierClass);
addKnowledgeRetrievalBaseButton.addEventListener("click", toggleKnowledgeRetrievalBasePicker);
knowledgeRetrievalBasePicker.addEventListener("click", addKnowledgeRetrievalBase);
knowledgeRetrievalBasePicker.addEventListener("input", searchKnowledgeRetrievalBases);
knowledgeRetrievalBaseList.addEventListener("click", removeKnowledgeRetrievalBase);
knowledgeRetrievalThresholdEnabledInput.addEventListener("change", updateKnowledgeRetrievalThresholdVisibility);
addManualFieldButton.addEventListener("click", openManualFieldDialog);
manualFieldForm.addEventListener("submit", saveManualInputField);
closeManualFieldDialogButton.addEventListener("click", closeManualFieldDialog);
cancelManualFieldButton.addEventListener("click", closeManualFieldDialog);
addHttpQueryButton.addEventListener("click", addHttpQueryParameter);
addHttpHeaderButton.addEventListener("click", addHttpHeader);
addDatabaseParameterButton.addEventListener("click", addDatabaseParameter);
databaseProviderSelect.addEventListener("change", updateDatabaseDefaultPort);
mailProtocolSelect?.addEventListener("change", () => {
    updateMailReadFieldsVisibility();
    updateMailDefaultPort();
});
mailSecuritySelect?.addEventListener("change", updateMailDefaultPort);
addAgentHttpQueryButton?.addEventListener("click", addAgentHttpQueryParameter);
addAgentHttpHeaderButton?.addEventListener("click", addAgentHttpHeader);
addAgentDatabaseParameterButton?.addEventListener("click", addAgentDatabaseParameter);
agentDatabaseProviderInput?.addEventListener("change", updateAgentDatabaseDefaultPort);
agentProviderConfigSelect?.addEventListener("change", syncAgentToolDraftFromForm);
agentMessageInput?.addEventListener("input", syncAgentToolDraftFromForm);
agentInstructionInput?.addEventListener("input", syncAgentToolDraftFromForm);
agentMaxIterationsInput?.addEventListener("input", syncAgentToolDraftFromForm);
agentTimeoutInput?.addEventListener("input", syncAgentToolDraftFromForm);
addAgentToolButton?.addEventListener("click", toggleAgentToolPicker);
agentToolPicker?.addEventListener("click", handleAgentToolPickerClick);
agentToolList?.addEventListener("click", handleAgentToolListClick);
agentToolForm?.addEventListener("submit", saveAgentToolDialog);
closeAgentToolDialogButton?.addEventListener("click", closeAgentToolDialog);
cancelAgentToolButton?.addEventListener("click", closeAgentToolDialog);
deleteAgentToolButton?.addEventListener("click", deleteCurrentAgentTool);
agentToolForm?.addEventListener("input", syncAgentToolDialogDraft);
agentToolForm?.addEventListener("change", syncAgentToolDialogDraft);
agentCurrentTimeModeInput?.addEventListener("change", updateAgentCurrentTimeFieldsVisibility);
agentToolDialog?.addEventListener("cancel", event => {
    event.preventDefault();
    closeAgentToolDialog();
});
outputVariableSelect.addEventListener("change", updateOutputCustomValueVisibility);
outputFormatSelect.addEventListener("change", updateOutputTableSettingsVisibility);
addOutputTableColumnButton.addEventListener("click", addOutputTableColumn);
scheduleTypeSelect.addEventListener("change", updateScheduleFieldsVisibility);
currentTimeModeSelect?.addEventListener("change", updateCurrentTimeFieldsVisibility);
paletteTabs.forEach(tab => tab.addEventListener("click", () => selectPaletteTab(tab.dataset.paletteTab)));
addNodeMenuButton?.addEventListener("click", toggleFloatingNodePalette);
zoomInButton?.addEventListener("click", () => setCanvasScale(state.canvasScale + 0.1));
zoomOutButton?.addEventListener("click", () => setCanvasScale(state.canvasScale - 0.1));
rightPanelResizer.addEventListener("pointerdown", event => startPanelResize(event, "right"));
window.addEventListener("pointermove", resizePanel);
window.addEventListener("pointerup", stopPanelResize);
window.addEventListener("pointercancel", stopPanelResize);
window.addEventListener("resize", positionFloatingNodePalette);
window.addEventListener("resize", positionAgentToolPicker);
propertyPanel?.addEventListener("scroll", positionAgentToolPicker, { passive: true });

canvasViewport.addEventListener("dragover", event => event.preventDefault());
canvasViewport.addEventListener("drop", dropNewNode);
canvasViewport.addEventListener("click", selectNodeFromCanvasClick);
canvasViewport.addEventListener("contextmenu", openCanvasContextMenu);
canvasViewport.addEventListener("pointermove", dragSelectedNode);
canvasViewport.addEventListener("pointerup", stopDraggingNode);
canvasViewport.addEventListener("pointercancel", stopDraggingNode);
canvasViewport.addEventListener("scroll", positionFloatingNodePalette);
document.addEventListener("click", hideCanvasContextMenu);
document.addEventListener("click", closeFloatingNodePalette);
document.addEventListener("click", closeLlmPickerFromOutside);
document.addEventListener("click", closeClassifierPickerFromOutside);
document.addEventListener("click", closeAgentPickerFromOutside);
document.addEventListener("click", closeAgentToolPickerFromOutside);
document.addEventListener("click", closeKnowledgeRetrievalPickerFromOutside);
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        hideCanvasContextMenu();
        closeFloatingNodePalette();
        closeKnowledgeRetrievalPicker();
        if (state.llmPickerOpen) {
            state.llmPickerOpen = false;
            state.llmPickerSearch = "";
            renderLlmProviderPicker();
        }
        if (state.agentPickerOpen) {
            state.agentPickerOpen = false;
            state.agentPickerSearch = "";
            renderAgentProviderPicker();
        }
        closeAgentToolPicker();
    }
});

restorePanelWidths();
setCanvasScale(state.canvasScale);
renderManualFieldTypes();
loadDesigner();

function switchDesignerView(view) {
    state.currentView = view === "logs" ? "logs" : "design";
    const showingLogs = state.currentView === "logs";
    designerShell.classList.toggle("logs-mode", showingLogs);
    designerLogsView.hidden = !showingLogs;
    designerViewButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.designerView === state.currentView);
    });

    if (showingLogs) {
        loadExecutionLogs();
    } else {
        requestAnimationFrame(() => {
            fitCanvas();
            renderEdges();
        });
    }
}

async function submitLogFilters(event) {
    event.preventDefault();
    const range = validateLogDateRange(logsStartInput, logsEndInput);
    if (!range) return;

    state.logFilters.from = logsStartInput.value;
    state.logFilters.to = logsEndInput.value;
    state.logFilters.keyword = logsKeywordInput.value.trim();
    await loadExecutionLogs();
}

async function loadExecutionLogs() {
    if (!workflowId) return;

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

    logsTableBody.innerHTML = "";
    logsEmpty.hidden = false;
    logsEmpty.textContent = "正在加载执行记录...";

    try {
        const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/executions?${params.toString()}`, {
            cache: "no-store"
        });
        if (!response.ok) throw new Error(await response.text());
        state.executions = await response.json();
        renderExecutionLogs();
    } catch (error) {
        state.executions = [];
        renderExecutionLogs(`日志加载失败：${error.message}`);
    }
}

function renderExecutionLogs(errorMessage = "") {
    if (errorMessage) {
        logsTableBody.innerHTML = "";
        logsEmpty.hidden = false;
        logsEmpty.textContent = errorMessage;
        return;
    }

    logsTableBody.innerHTML = state.executions.map(renderExecutionLogRow).join("");
    logsEmpty.hidden = state.executions.length > 0;
    logsEmpty.textContent = "暂无执行记录";
}

function renderExecutionLogRow(execution) {
    const nodes = Array.isArray(execution.nodeExecutions) ? execution.nodeExecutions : [];
    const nodeSummary = nodes.length
        ? nodes.map(node => `${node.nodeName || node.nodeId} · ${workflowStatusLabel(node.status)}`).join("\n")
        : "暂无节点执行信息";
    const resultSummary = formatExecutionResult(execution, nodes);

    return `<tr>
        <td>${escapeHtml(formatLogDateTime(execution.startedAt))}</td>
        <td>${renderWorkflowStatusBadge(execution.status)}</td>
        <td>${escapeHtml(execution.id || "-")}</td>
        <td>${escapeHtml(nodeSummary)}</td>
        <td>${escapeHtml(resultSummary)}</td>
        <td>${escapeHtml(formatLogDuration(execution.startedAt, execution.finishedAt))}</td>
    </tr>`;
}

function formatExecutionResult(execution, nodes) {
    if (execution.error) return execution.error;

    const results = nodes
        .filter(node => node.error || (node.output && Object.keys(node.output).length))
        .map(node => {
            const value = node.error || JSON.stringify(node.output);
            return `${node.nodeName || node.nodeId}：${value}`;
        });

    return truncateLogText(results.join("\n") || "无输出信息", 1200);
}

function renderWorkflowStatusBadge(status) {
    const normalized = String(status || "").toLowerCase();
    return `<span class="logs-status-badge ${escapeAttribute(normalized)}">${escapeHtml(workflowStatusLabel(status))}</span>`;
}

function workflowStatusLabel(status) {
    const labels = {
        running: "运行中",
        succeeded: "成功",
        failed: "失败",
        skipped: "已跳过",
        cancelled: "已终止",
        timedout: "已超时"
    };
    return labels[String(status || "").toLowerCase()] || status || "-";
}

function formatLogDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const parts = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ];
    const time = [
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0"),
        String(date.getSeconds()).padStart(2, "0")
    ];
    return `${parts.join("-")} ${time.join(":")}`;
}

function formatLogDuration(startedAt, finishedAt) {
    const started = new Date(startedAt).getTime();
    const finished = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    if (!Number.isFinite(started) || !Number.isFinite(finished)) return "-";

    const milliseconds = Math.max(0, finished - started);
    if (milliseconds < 1000) return `${milliseconds}毫秒`;
    const seconds = Math.floor(milliseconds / 1000);
    const remainder = milliseconds % 1000;
    if (seconds < 60) return remainder ? `${seconds}秒${remainder}毫秒` : `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds ? `${minutes}分${remainingSeconds}秒` : `${minutes}分`;
}

function truncateLogText(value, maxLength) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function initializeLogFilterInputs() {
    logsStartInput.value = state.logFilters.from;
    logsEndInput.value = state.logFilters.to;
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
    if (!match) return null;

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

function setupPublishControls() {
    saveButton.classList.remove("publish-button");
    saveButton.classList.add("save-dropdown-button", "is-single");
    saveButton.setAttribute("aria-expanded", "false");
    saveButton.setAttribute("aria-haspopup", "menu");
    saveButton.innerHTML = '<span>保存</span><span class="dropdown-arrow" aria-hidden="true"><img src="/assets/down.svg" alt=""></span>';

    publishMenuButton.classList.remove("publish-menu-button");
    publishMenuButton.classList.add("save-menu-toggle-button");
    publishMenuButton.setAttribute("aria-expanded", "false");
    publishMenuButton.setAttribute("aria-label", "保存菜单");
    publishMenuButton.setAttribute("title", "保存菜单");
    publishMenuButton.innerHTML = '<span class="dropdown-arrow" aria-hidden="true"><img src="/assets/down.svg" alt=""></span>';
    publishMenuButton.hidden = true;

    publishMenu.classList.remove("publish-menu");
    publishMenu.classList.add("save-menu");
    publishMenu.innerHTML = `
        <div class="save-menu-history">
            <div>
                <span>最近保存</span>
                <strong id="workflowLastSavedText">尚未保存</strong>
            </div>
        </div>
        <button id="saveUpdateButton" class="save-update-button" type="button">保存更新</button>
        <div class="save-menu-divider"></div>
        <button id="runButton" class="run-menu-button" type="button">
            <span class="run-icon" aria-hidden="true">▶</span>
            <span>运行</span>
            <span class="run-arrow" aria-hidden="true">→</span>
        </button>
    `;
    saveUpdateButton = document.getElementById("saveUpdateButton");
    runButton = document.getElementById("runButton");
}
function togglePublishMenu(event) {
    event.stopPropagation();
    updateSaveMenu();
    publishMenu.hidden = !publishMenu.hidden;
    publishMenuButton.setAttribute("aria-expanded", String(!publishMenu.hidden));
    saveButton.setAttribute("aria-expanded", String(!publishMenu.hidden));
}

function restorePanelWidths() {
    const rightWidth = Number.parseInt(localStorage.getItem("easegpt:designer:right-width"), 10);
    if (Number.isFinite(rightWidth)) setPanelWidth("right", rightWidth);
}

function startPanelResize(event, side) {
    if (window.innerWidth <= 1100) return;
    event.preventDefault();
    const propertyName = side === "left" ? "--left-panel-width" : "--right-panel-width";
    const currentWidth = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(propertyName));
    state.panelResize = { side, startX: event.clientX, startWidth: currentWidth };
    event.currentTarget.classList.add("active");
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing-panels");
}

function resizePanel(event) {
    if (!state.panelResize) return;
    const delta = event.clientX - state.panelResize.startX;
    const width = state.panelResize.side === "left"
        ? state.panelResize.startWidth + delta
        : state.panelResize.startWidth - delta;
    setPanelWidth(state.panelResize.side, width);
}

function stopPanelResize() {
    if (!state.panelResize) return;
    const side = state.panelResize.side;
    const propertyName = side === "left" ? "--left-panel-width" : "--right-panel-width";
    const width = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(propertyName));
    localStorage.setItem(`easegpt:designer:${side}-width`, String(Math.round(width)));
    state.panelResize = null;
    rightPanelResizer.classList.remove("active");
    document.body.classList.remove("resizing-panels");
    renderEdges();
}

function setPanelWidth(side, value) {
    const minimum = side === "left" ? 220 : 280;
    const maximum = side === "left" ? 520 : 600;
    const width = Math.min(maximum, Math.max(minimum, value));
    const propertyName = side === "left" ? "--left-panel-width" : "--right-panel-width";
    const resizer = rightPanelResizer;
    document.documentElement.style.setProperty(propertyName, `${width}px`);
    resizer?.setAttribute("aria-valuenow", String(Math.round(width)));
    resizer?.setAttribute("aria-valuemin", String(minimum));
    resizer?.setAttribute("aria-valuemax", String(maximum));
}

async function loadDesigner() {
    if (!workflowId) {
        setStatus("工作流编号缺失");
        return;
    }

    try {
        const [
            workflowResponse,
            nodeTypesResponse,
            providerConfigsResponse,
            knowledgeBasesResponse,
            knowledgeConfigResponse
        ] = await Promise.all([
            fetch(`/api/workflows/${encodeURIComponent(workflowId)}`, { cache: "no-store" }),
            fetch("/api/nodes", { cache: "no-store" }),
            fetch("/api/llm-provider-configs", { cache: "no-store" }),
            fetch("/api/knowledge-bases", { cache: "no-store" }),
            fetch("/api/knowledge-bases/config-options", { cache: "no-store" })
        ]);

        if (!workflowResponse.ok) throw new Error(await workflowResponse.text());
        if (!nodeTypesResponse.ok) throw new Error(await nodeTypesResponse.text());
        if (!providerConfigsResponse.ok) throw new Error(await providerConfigsResponse.text());
        if (!knowledgeBasesResponse.ok) throw new Error(await knowledgeBasesResponse.text());
        if (!knowledgeConfigResponse.ok) throw new Error(await knowledgeConfigResponse.text());

        state.workflow = await workflowResponse.json();
        state.nodeTypes = await nodeTypesResponse.json();
        state.providerConfigs = await providerConfigsResponse.json();
        state.knowledgeBases = await knowledgeBasesResponse.json();
        const knowledgeConfig = await knowledgeConfigResponse.json();
        state.rerankModelOptions = [
            { value: "", label: "使用知识库设置" },
            ...(Array.isArray(knowledgeConfig.rerankModels) ? knowledgeConfig.rerankModels : [])
        ];
        workflowTitle.textContent = state.workflow.name;
        renderWorkflowSummary();
        normalizeWorkflow();
        renderPalette();
        renderAll();
        fitCanvas();
        updateSaveMenu();
        setStatus("设计器已加载");
    } catch (error) {
        setStatus(`加载失败：${error.message}`);
        saveButton.disabled = true;
    }
}

function normalizeWorkflow() {
    state.workflow.nodes ??= [];
    state.workflow.edges ??= [];
    for (let index = 0; index < state.workflow.nodes.length; index += 1) {
        const node = state.workflow.nodes[index];
        node.position ??= { x: 80 + index * 260, y: 160 };
        node.settings ??= {};
        if (legacyDefaultNames[node.type]?.includes(node.name)) {
            node.name = chineseNodeNames[node.type];
        }
    }
}

function renderPalette() {
    nodePalette.innerHTML = "";

    const visibleNodeTypes = state.nodeTypes.filter(nodeType =>
        state.paletteTab === "extensions"
            ? extensionNodeTypes.has(nodeType.type)
            : !extensionNodeTypes.has(nodeType.type));
    const sortedNodeTypes = visibleNodeTypes.sort((left, right) => {
        const leftPriority = palettePriority.indexOf(left.type);
        const rightPriority = palettePriority.indexOf(right.type);
        const leftOrder = leftPriority < 0 ? Number.MAX_SAFE_INTEGER : leftPriority;
        const rightOrder = rightPriority < 0 ? Number.MAX_SAFE_INTEGER : rightPriority;

        return leftOrder - rightOrder
            || getNodeDisplayName(left, left.type).localeCompare(
                getNodeDisplayName(right, right.type),
                "zh-CN");
    });

    for (const nodeType of sortedNodeTypes) {
        const item = document.createElement("div");
        item.className = "palette-node";
        item.draggable = true;
        item.innerHTML = `
            <span class="node-icon">${renderNodeIcon(nodeType.type)}</span>
            <span class="palette-node-copy">
                <strong>${escapeHtml(getNodeDisplayName(nodeType, nodeType.type))}</strong>
            </span>
        `;
        item.addEventListener("dragstart", event => {
            event.dataTransfer.setData("application/easegpt-node-type", nodeType.type);
        });
        item.addEventListener("click", event => {
            event.preventDefault();
            addNodeToCanvas(nodeType.type, getViewportTopCenterPoint());
            closeFloatingNodePalette();
        });
        nodePalette.appendChild(item);
    }
}

function toggleFloatingNodePalette(event) {
    event.stopPropagation();
    floatingNodePalette.hidden = !floatingNodePalette.hidden;
    addNodeMenuButton.setAttribute("aria-expanded", String(!floatingNodePalette.hidden));
    addNodeMenuButton.classList.toggle("active", !floatingNodePalette.hidden);
    positionFloatingNodePalette();
}

function positionFloatingNodePalette() {
    if (!floatingNodePalette || floatingNodePalette.hidden || !addNodeMenuButton) return;

    const buttonRect = addNodeMenuButton.getBoundingClientRect();
    const viewportRect = canvasViewport.getBoundingClientRect();
    const paletteRect = floatingNodePalette.getBoundingClientRect();
    const gap = 10;
    const inset = 10;
    const maximumLeft = viewportRect.right - paletteRect.width - inset;
    const left = Math.max(
        viewportRect.left + inset,
        Math.min(buttonRect.right + gap, maximumLeft));
    const maximumTop = window.innerHeight - paletteRect.height - inset;
    const top = Math.max(
        viewportRect.top + inset,
        Math.min(buttonRect.top, maximumTop));

    floatingNodePalette.style.left = `${Math.round(left)}px`;
    floatingNodePalette.style.top = `${Math.round(top)}px`;
}

function closeFloatingNodePalette(event) {
    if (!floatingNodePalette || floatingNodePalette.hidden) return;
    if (event?.target && (floatingNodePalette.contains(event.target) || addNodeMenuButton.contains(event.target))) return;
    floatingNodePalette.hidden = true;
    addNodeMenuButton.setAttribute("aria-expanded", "false");
    addNodeMenuButton.classList.remove("active");
}

function selectPaletteTab(tabName) {
    state.paletteTab = tabName === "extensions" ? "extensions" : "nodes";
    paletteTabs.forEach(tab => {
        const active = tab.dataset.paletteTab === state.paletteTab;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    });
    renderPalette();
}

function setCanvasScale(value) {
    state.canvasScale = Math.min(1.6, Math.max(0.5, Number(value.toFixed(2))));
    canvasWorld?.style.setProperty("--canvas-scale", String(state.canvasScale));
    if (state.workflow) renderEdges();
}

function renderAll() {
    renderWorkflowSummary();
    renderNodes();
    renderEdges();
    renderProperties();
}

function renderWorkflowSummary() {
    if (!state.workflow) return;
    workflowTitle.textContent = state.workflow.name || "未命名工作流";
    workflowDescription.textContent = state.workflow.description || "暂无工作流描述";
    const icon = state.workflow.icon || "/assets/easegpt.svg";
    workflowIcon.classList.toggle("has-custom-image", isImageIcon(icon));
    workflowIcon.innerHTML = isImageIcon(icon)
        ? `<img src="${escapeAttribute(icon)}" alt="">`
        : escapeHtml((state.workflow.name || "W").slice(0, 1).toUpperCase());
}

function renderNodes() {
    canvas.innerHTML = "";

    for (const node of state.workflow.nodes) {
        const isClassifier = node.type === "ai.question-classifier";
        const classes = Array.isArray(node.settings?.classes) ? node.settings.classes : [];
        const element = document.createElement("div");
        element.className = `workflow-node${isSelectedNode(node.id) ? " selected" : ""}`;
        element.dataset.nodeId = node.id;
        element.style.left = `${node.position.x}px`;
        element.style.top = `${node.position.y}px`;
        element.innerHTML = `
            <button class="port input" type="button" title="输入端口" aria-label="输入端口"></button>
            <span class="node-icon">${renderNodeIcon(node.type)}</span>
            <span class="workflow-node-copy">
                <strong>${escapeHtml(getNodeUiName(node))}</strong>
            </span>
            ${isClassifier ? `
                <div class="classifier-port-list">
                    ${classes.map(item => `
                        <div class="classifier-port-row">
                            <span>${escapeHtml(item.name || item.id)}</span>
                            <button class="port output${isConnectingFrom(node.id, item.id) ? " active" : ""}" data-port="${escapeHtml(item.id)}" type="button" title="${escapeHtml(item.id)} 输出端口" aria-label="${escapeHtml(item.id)} 输出端口"></button>
                        </div>`).join("")}
                </div>` : `
                <button class="port output${isConnectingFrom(node.id, "main") ? " active" : ""}" data-port="main" type="button" title="输出端口" aria-label="输出端口"></button>`}
        `;

        element.addEventListener("pointerdown", event => startDraggingNode(event, node));
        element.addEventListener("click", event => {
            if (event.target.classList.contains("port")) return;
            selectNode(node.id);
        });

        element.querySelectorAll(".port.output").forEach(port => {
            port.addEventListener("click", event => {
                event.stopPropagation();
                const sourcePort = port.dataset.port || "main";
                state.connectingFrom = { nodeId: node.id, sourcePort };
                document.body.classList.add("connecting");
                selectNode(node.id);
                setStatus(`已选择 ${node.name} 的 ${sourcePort} 输出端口，请点击目标节点输入端口`);
            });
        });

        element.querySelector(".port.input").addEventListener("click", event => {
            event.stopPropagation();
            connectToNode(node.id);
        });

        canvas.appendChild(element);
    }
}

function renderEdges() {
    edgeLayer.innerHTML = "";

    for (let index = 0; index < state.workflow.edges.length; index += 1) {
        const edge = state.workflow.edges[index];
        const source = findNode(edge.sourceNodeId);
        const target = findNode(edge.targetNodeId);
        if (!source || !target) continue;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", buildPath(source, target, edge.sourcePort ?? "main"));
        path.classList.add("edge-path");
        if (state.selected?.kind === "edge" && state.selected.index === index) {
            path.classList.add("selected");
        }
        path.addEventListener("click", event => {
            event.stopPropagation();
            selectEdge(index);
        });
        edgeLayer.appendChild(path);
    }
}

function renderProperties() {
    const node = state.selected?.kind === "node" ? findNode(state.selected.id) : null;
    const edge = state.selected?.kind === "edge" ? state.workflow.edges[state.selected.index] : null;

    propertyEmpty.hidden = Boolean(node || edge);
    nodeForm.hidden = !node;
    edgeForm.hidden = !edge;
    propertyTitle.textContent = node
        ? getNodeDisplayName(state.nodeTypes.find(item => item.type === node.type), node.type)
        : edge
            ? "连线"
            : "配置";

    if (node) {
        nodeNameInput.value = node.settings?.description ?? "";
        const isAgentNode = node.type === "ai.agent";
        const canRenderAgentSettings = supportsAgentSettingsUi();
        const isLlmNode = node.type === "ai.llm-chat";
        const isKnowledgeRetrievalNode = node.type === "ai.knowledge-retrieval";
        const isClassifierNode = node.type === "ai.question-classifier";
        const isManualNode = node.type === "trigger.manual";
        const isOutputNode = node.type === "data.template";
        const isForEachNode = node.type === "flow.for-each";
        const isHttpNode = node.type === "integration.http-request";
        const isMailReadNode = node.type === "integration.mail-read";
        const isWebCrawlerNode = node.type === "integration.web-crawler";
        const isWeComNode = node.type === "integration.wecom-message";
        const isDatabaseNode = node.type === "integration.database";
        const isScheduleNode = node.type === "trigger.schedule";
        const isCurrentTimeNode = node.type === "utility.current-time";
        if (!isLlmNode) {
            state.llmPickerOpen = false;
            state.llmPickerSearch = "";
        }
        if (!isClassifierNode) {
            state.classifierPickerOpen = false;
            state.classifierPickerSearch = "";
        }
        if (!isAgentNode) {
            state.agentPickerOpen = false;
            state.agentPickerSearch = "";
            closeAgentToolPicker();
            resetAgentToolDialogState();
            if (agentToolDialog?.open) agentToolDialog.close();
        }
        genericSettingsPanel.hidden = (isAgentNode && canRenderAgentSettings) || isLlmNode || isKnowledgeRetrievalNode || isClassifierNode || isManualNode || isOutputNode || isForEachNode || isHttpNode || isMailReadNode || isWebCrawlerNode || isWeComNode || isDatabaseNode || isScheduleNode || isCurrentTimeNode;
        manualSettingsPanel.hidden = !isManualNode;
        if (agentSettingsPanel) {
            agentSettingsPanel.hidden = !isAgentNode || !canRenderAgentSettings;
        }
        llmSettingsPanel.hidden = !isLlmNode;
        knowledgeRetrievalSettingsPanel.hidden = !isKnowledgeRetrievalNode;
        scheduleSettingsPanel.hidden = !isScheduleNode;
        currentTimeSettingsPanel.hidden = !isCurrentTimeNode;
        forEachSettingsPanel.hidden = !isForEachNode;
        classifierSettingsPanel.hidden = !isClassifierNode;
        httpSettingsPanel.hidden = !isHttpNode;
        mailReadSettingsPanel.hidden = !isMailReadNode;
        webCrawlerSettingsPanel.hidden = !isWebCrawlerNode;
        wecomSettingsPanel.hidden = !isWeComNode;
        databaseSettingsPanel.hidden = !isDatabaseNode;
        outputSettingsPanel.hidden = !isOutputNode;

        try {
            if (isManualNode) {
                renderManualSettings(node);
            } else if (isAgentNode && canRenderAgentSettings) {
                renderAgentSettings(node);
            } else if (isLlmNode) {
                renderLlmSettings(node);
            } else if (isKnowledgeRetrievalNode) {
                renderKnowledgeRetrievalSettings(node);
            } else if (isClassifierNode) {
                renderClassifierSettings(node);
            } else if (isForEachNode) {
                renderForEachSettings(node);
            } else if (isOutputNode) {
                renderOutputSettings(node);
            } else if (isHttpNode) {
                renderHttpSettings(node);
            } else if (isMailReadNode) {
                renderMailReadSettings(node);
            } else if (isWebCrawlerNode) {
                renderWebCrawlerSettings(node);
            } else if (isWeComNode) {
                renderWeComSettings(node);
            } else if (isDatabaseNode) {
                renderDatabaseSettings(node);
            } else if (isScheduleNode) {
                renderScheduleSettings(node);
            } else if (isCurrentTimeNode) {
                renderCurrentTimeSettings(node);
            } else {
                nodeSettingsInput.value = JSON.stringify(node.settings ?? {}, null, 2);
            }
        } catch (error) {
            genericSettingsPanel.hidden = false;
            manualSettingsPanel.hidden = true;
            if (agentSettingsPanel) agentSettingsPanel.hidden = true;
            llmSettingsPanel.hidden = true;
            knowledgeRetrievalSettingsPanel.hidden = true;
            scheduleSettingsPanel.hidden = true;
            currentTimeSettingsPanel.hidden = true;
            forEachSettingsPanel.hidden = true;
            classifierSettingsPanel.hidden = true;
            httpSettingsPanel.hidden = true;
            mailReadSettingsPanel.hidden = true;
            webCrawlerSettingsPanel.hidden = true;
            wecomSettingsPanel.hidden = true;
            databaseSettingsPanel.hidden = true;
            outputSettingsPanel.hidden = true;
            nodeSettingsInput.value = JSON.stringify(node.settings ?? {}, null, 2);
            console.error("Failed to render node settings panel, fallback to JSON editor.", error);
        }
    }

    if (edge) {
        const sourceNode = findNode(edge.sourceNodeId);
        const sourcePort = normalizeEdgeSourcePort(edge.sourcePort);
        const sourceClass = sourceNode?.type === "ai.question-classifier"
            ? sourceNode.settings?.classes?.find(item => item.id === sourcePort || item.name === sourcePort)
            : null;
        edgeSourceInput.value = edge.sourceNodeId;
        edgeTargetInput.value = edge.targetNodeId;
        edgePortInput.value = sourceClass?.name ?? sourcePort;
        edgePortInput.dataset.sourcePortValue = sourceClass?.id ?? sourcePort;
        edgePortInput.readOnly = sourceNode?.type === "ai.question-classifier";
    }
}

function supportsAgentSettingsUi() {
    return Boolean(
        agentSettingsPanel
        && agentProviderConfigPicker
        && agentProviderConfigSelect
        && agentMessageInput
        && agentInstructionInput
        && agentMaxIterationsInput
        && addAgentToolButton
        && agentToolPicker
        && agentToolList
        && agentTimeoutInput
        && agentToolDialog
        && agentToolForm);
}

function renderForEachSettings(node) {
    const settings = node.settings ?? {};
    forEachItemsVariableInput.value = settings.itemsVariable ?? "";
    forEachItemVariableInput.value = settings.itemVariableName ?? "currentItem";
    forEachIndexVariableInput.value = settings.indexVariableName ?? "currentIndex";
}

function renderScheduleSettings(node) {
    const settings = node.settings ?? {};
    scheduleTypeSelect.value = settings.scheduleType ?? "interval";
    scheduleIntervalInput.value = settings.intervalSeconds ?? 60;
    scheduleCronInput.value = settings.cronExpression ?? "0 9 * * 1-5";
    scheduleTimeZoneSelect.value = settings.timeZone ?? "Asia/Shanghai";
    updateScheduleFieldsVisibility();
}

function renderCurrentTimeSettings(node) {
    const settings = node.settings ?? {};
    currentTimeModeSelect.value = settings.mode ?? "local";
    currentTimeTimeZoneInput.value = settings.timeZone ?? "";
    currentTimeFormatInput.value = settings.format ?? "yyyy-MM-dd HH:mm:ss zzz";
    updateCurrentTimeFieldsVisibility();
}

function updateScheduleFieldsVisibility() {
    const isCron = scheduleTypeSelect.value === "cron";
    scheduleIntervalField.hidden = isCron;
    scheduleCronFields.hidden = !isCron;
}

function updateCurrentTimeFieldsVisibility() {
    if (!currentTimeTimeZoneField || !currentTimeModeSelect) return;
    currentTimeTimeZoneField.hidden = currentTimeModeSelect.value !== "custom";
}

function renderManualFieldTypes() {
    manualFieldTypeList.innerHTML = manualFieldTypes.map(item => `
        <button class="manual-field-type${item.type === state.manualFieldType ? " active" : ""}" type="button" data-type="${escapeHtml(item.type)}">
            <span>${manualFieldIconHtml(item)}</span>
            <strong>${escapeHtml(item.label)}</strong>
        </button>
    `).join("");

    manualFieldTypeList.querySelectorAll("[data-type]").forEach(button => {
        button.addEventListener("click", () => selectManualFieldType(button.dataset.type));
    });
}

function selectManualFieldType(type) {
    state.manualFieldType = manualFieldTypes.some(item => item.type === type) ? type : "text";
    renderManualFieldTypes();
    manualFieldOptionsInput.closest("label").hidden = !["radio", "checkbox", "select"].includes(state.manualFieldType);
    manualFieldDateOnlyField.hidden = !["datetime", "daterange"].includes(state.manualFieldType);
    if (manualFieldDateOnlyField.hidden) manualFieldDateOnlyInput.checked = false;
}

function renderManualSettings(node) {
    state.manualInputFields = normalizeManualInputFields(node.settings?.fields);
    renderManualFieldList();
}

function renderAgentSettings(node) {
    if (!supportsAgentSettingsUi()) {
        return;
    }

    const settings = node.settings ?? {};
    renderAgentProviderConfigOptions(settings.providerConfigId);
    agentMessageInput.value = settings.message ?? "{{question}}";
    agentMaxIterationsInput.value = settings.maxIterations ?? 5;
    agentTimeoutInput.value = settings.timeoutSeconds ?? 180;
    state.agentTools = normalizeAgentTools(settings.tools);
    closeAgentToolPicker();
    resetAgentToolDialogState();
    if (agentToolDialog?.open) agentToolDialog.close();
    agentInstructionInput.value = mergeAgentInstructionWithAutoSection(settings.instruction ?? "", state.agentTools);
    renderAgentToolList(state.agentTools);
    syncAgentToolDraftFromForm();
}

function normalizeAgentTools(tools) {
    const source = Array.isArray(tools) ? tools : [];
    return source
        .map(tool => {
        const toolType = agentToolCatalog.some(item => item.type === tool?.toolType)
            ? String(tool.toolType).toLowerCase()
            : "http";
        const meta = agentToolCatalog.find(item => item.type === toolType);
        const normalized = {
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
        return isLegacyEmptyAgentTool(tool, normalized) ? null : normalized;
    })
        .filter(tool => tool?.toolType);
}

function isLegacyEmptyAgentTool(rawTool, normalizedTool) {
    if (!rawTool || rawTool.enabled !== false) {
        return false;
    }

    const meta = agentToolCatalog.find(item => item.type === normalizedTool.toolType);
    const hasText = [normalizedTool.name, normalizedTool.purpose, normalizedTool.resource, normalizedTool.guardrails]
        .some(value => String(value || "").trim() && String(value || "").trim() !== String(meta?.label || "").trim());
    const hasHttpConfig = [normalizedTool.http.url, normalizedTool.http.body]
        .some(value => String(value || "").trim())
        || normalizedTool.http.queryParametersJson !== "[]"
        || normalizedTool.http.headersJson !== "[]";
    const hasWebConfig = [normalizedTool.webCrawler.url, normalizedTool.webCrawler.userAgent]
        .some(value => String(value || "").trim());
    const hasDbConfig = [normalizedTool.database.host, normalizedTool.database.database, normalizedTool.database.username, normalizedTool.database.password, normalizedTool.database.sql]
        .some(value => String(value || "").trim())
        || normalizedTool.database.parametersJson !== "[]";
    const hasTimeConfig = normalizedTool.currentTime.mode !== "local"
        || String(normalizedTool.currentTime.timeZone || "").trim()
        || normalizedTool.currentTime.format !== "yyyy-MM-dd HH:mm:ss zzz";

    return !hasText && !hasHttpConfig && !hasWebConfig && !hasDbConfig && !hasTimeConfig;
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
    if (!agentToolList) return;
    if (!tools.length) {
        agentToolList.innerHTML = '<div class="agent-selection-empty">暂未添加工具，请先添加一个 Agent 工具。</div>';
        return;
    }

    agentToolList.innerHTML = tools.map((tool, index) => {
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
        return tool.http?.url || `${tool.http?.method || "GET"} 请求`;
    }
    if (tool.toolType === "web-crawler") {
        return tool.webCrawler?.url || "网页内容抓取";
    }
    if (tool.toolType === "database") {
        const databaseName = tool.database?.database?.trim();
        return databaseName ? `${tool.database?.provider || "sqlserver"} · ${databaseName}` : `${tool.database?.provider || "sqlserver"} 查询`;
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
    return renderNodeIcon(nodeType);
}

function updateAgentCurrentTimeFieldsVisibility() {
    if (!agentCurrentTimeTimeZoneField || !agentCurrentTimeModeInput) return;
    agentCurrentTimeTimeZoneField.hidden = agentCurrentTimeModeInput.value !== "custom";
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

function renderAgentHttpQueryParameters(parameters) {
    renderHttpKeyValueRows(
        agentHttpQueryList,
        parameters,
        "暂无请求参数",
        "参数名",
        "参数值，支持 {{变量}}",
        removeAgentHttpQueryParameter);
}

function renderAgentHttpHeaders(headers) {
    renderHttpKeyValueRows(
        agentHttpHeaderList,
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
    return collectAgentHttpKeyValueRows(agentHttpQueryList);
}

function collectAgentHttpHeaders() {
    return collectAgentHttpKeyValueRows(agentHttpHeaderList);
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
    agentDatabaseParameterList.innerHTML = "";
    if (parameters.length === 0) {
        agentDatabaseParameterList.innerHTML = '<div class="empty-state">暂无 SQL 参数</div>';
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
        agentDatabaseParameterList.appendChild(row);
    });
}

function collectAgentDatabaseParameters() {
    return Array.from(agentDatabaseParameterList.querySelectorAll(".database-parameter-item"))
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
    if (!agentDatabasePortInput || !agentDatabaseProviderInput) {
        return;
    }
    if (!overwrite && String(agentDatabasePortInput.value || "").trim()) {
        return;
    }
    agentDatabasePortInput.value = getDatabaseDefaultPort(agentDatabaseProviderInput.value);
}

function syncAgentToolDraftFromForm(event) {
    if (!supportsAgentSettingsUi() || agentSettingsPanel?.hidden) return;
    if (event?.target === agentInstructionInput || event?.target === agentMessageInput) {
        return;
    }
    agentInstructionInput.value = mergeAgentInstructionWithAutoSection(agentInstructionInput.value, collectAgentTools());
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
    if (!supportsAgentSettingsUi()) return;
    event?.stopPropagation?.();
    state.agentToolPickerOpen = !state.agentToolPickerOpen;
    renderAgentToolPicker();
}

function closeAgentToolPicker() {
    if (!agentToolPicker) return;
    state.agentToolPickerOpen = false;
    agentToolPicker.hidden = true;
    agentToolPicker.style.left = "";
    agentToolPicker.style.top = "";
}

function closeAgentToolPickerFromOutside(event) {
    if (!state.agentToolPickerOpen || event.target.closest(".agent-tool-picker-anchor")) return;
    closeAgentToolPicker();
}

function renderAgentToolPicker() {
    if (!agentToolPicker) return;
    agentToolPicker.hidden = !state.agentToolPickerOpen;
    if (!state.agentToolPickerOpen) {
        agentToolPicker.innerHTML = "";
        return;
    }

    agentToolPicker.innerHTML = agentToolCatalog.map(item => `
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

function positionAgentToolPicker() {
    if (!state.agentToolPickerOpen || !agentToolPicker || !addAgentToolButton) return;

    const buttonRect = addAgentToolButton.getBoundingClientRect();
    const viewportInset = 12;
    const preferredWidth = Math.min(420, window.innerWidth - viewportInset * 2);
    agentToolPicker.style.width = `${preferredWidth}px`;

    const pickerRect = agentToolPicker.getBoundingClientRect();
    const pickerWidth = pickerRect.width || preferredWidth;
    const left = Math.max(
        viewportInset,
        Math.min(buttonRect.right - pickerWidth, window.innerWidth - pickerWidth - viewportInset));
    const top = Math.min(
        buttonRect.bottom + 8,
        window.innerHeight - pickerRect.height - viewportInset);

    agentToolPicker.style.left = `${Math.round(left)}px`;
    agentToolPicker.style.top = `${Math.round(Math.max(viewportInset, top))}px`;
}

function handleAgentToolPickerClick(event) {
    const option = event.target.closest("[data-agent-tool-option]");
    if (!option) return;
    const toolType = option.dataset.agentToolOption;
    state.agentTools.push(createAgentTool(toolType));
    closeAgentToolPicker();
    renderAgentToolList(state.agentTools);
    syncAgentToolDraftFromForm();
    openAgentToolDialog(state.agentTools.length - 1);
}

function openAgentToolDialog(index) {
    const tool = state.agentTools[index];
    if (!tool || !agentToolDialog) return;

    state.agentToolDialogIndex = index;
    state.agentToolDraftOriginal = structuredClone(tool);
    state.agentToolDraft = structuredClone(tool);
    renderAgentToolDialog();
    agentToolDialog.showModal();
    window.setTimeout(() => agentToolNameInput?.focus(), 0);
}

function renderAgentToolDialog() {
    const tool = state.agentToolDraft;
    if (!tool) return;

    const meta = agentToolCatalog.find(item => item.type === tool.toolType);
    agentToolDialogTitle.textContent = `${meta?.label ?? "工具"}配置`;
    agentToolTypeDisplay.value = meta?.label ?? tool.toolType;
    agentToolNameInput.value = tool.name ?? "";
    agentToolPurposeInput.value = tool.purpose ?? "";
    agentToolResourceInput.value = tool.resource ?? "";
    agentToolGuardrailsInput.value = tool.guardrails ?? "";

    agentCurrentTimeModeInput.value = tool.currentTime.mode;
    agentCurrentTimeTimeZoneInput.value = tool.currentTime.timeZone;
    agentCurrentTimeFormatInput.value = tool.currentTime.format;
    updateAgentCurrentTimeFieldsVisibility();

    agentHttpMethodInput.value = tool.http.method;
    agentHttpTimeoutInput.value = tool.http.timeoutSeconds;
    agentHttpRetryInput.value = tool.http.retryCount;
    agentHttpUrlInput.value = tool.http.url;
    agentHttpBodyInput.value = tool.http.body;
    renderAgentHttpQueryParameters(parseAgentHttpItems(tool.http.queryParametersJson));
    renderAgentHttpHeaders(parseAgentHttpItems(tool.http.headersJson));

    agentWebUrlInput.value = tool.webCrawler.url;
    agentWebUserAgentInput.value = tool.webCrawler.userAgent;
    agentWebTimeoutInput.value = tool.webCrawler.timeoutSeconds;
    agentWebRetryInput.value = tool.webCrawler.retryCount;
    agentWebMaxLengthInput.value = tool.webCrawler.maxContentLength;
    agentWebSummaryInput.checked = !!tool.webCrawler.generateSummary;

    agentDatabaseProviderInput.value = tool.database.provider;
    agentDatabasePortInput.value = tool.database.port;
    agentDatabaseTimeoutInput.value = tool.database.timeoutSeconds;
    agentDatabaseHostInput.value = tool.database.host;
    agentDatabaseNameInput.value = tool.database.database;
    agentDatabaseUsernameInput.value = tool.database.username;
    agentDatabasePasswordInput.value = tool.database.password;
    agentDatabaseSslInput.checked = !!tool.database.useSsl;
    agentDatabaseModeInput.value = tool.database.mode;
    agentDatabaseSqlInput.value = tool.database.sql;
    renderAgentDatabaseParameters(parseAgentDatabaseParameters(tool.database.parametersJson));
    updateAgentDatabaseDefaultPort(false);

    agentCurrentTimeToolFields.hidden = tool.toolType !== "current-time";
    agentHttpToolFields.hidden = tool.toolType !== "http";
    agentWebCrawlerToolFields.hidden = tool.toolType !== "web-crawler";
    agentDatabaseToolFields.hidden = tool.toolType !== "database";
}

function syncAgentToolDialogDraft() {
    if (!state.agentToolDraft) return;

    state.agentToolDraft = {
        ...state.agentToolDraft,
        name: agentToolNameInput.value.trim(),
        purpose: agentToolPurposeInput.value.trim(),
        resource: agentToolResourceInput.value.trim(),
        guardrails: agentToolGuardrailsInput.value.trim(),
        currentTime: {
            mode: agentCurrentTimeModeInput.value || "local",
            timeZone: agentCurrentTimeTimeZoneInput.value.trim(),
            format: agentCurrentTimeFormatInput.value.trim() || "yyyy-MM-dd HH:mm:ss zzz"
        },
        http: {
            method: agentHttpMethodInput.value || "GET",
            url: agentHttpUrlInput.value.trim(),
            body: agentHttpBodyInput.value,
            queryParametersJson: JSON.stringify(collectAgentHttpQueryParameters()),
            headersJson: JSON.stringify(collectAgentHttpHeaders()),
            timeoutSeconds: clampInteger(agentHttpTimeoutInput.value, 30, 1, 300),
            retryCount: clampInteger(agentHttpRetryInput.value, 0, 0, 5)
        },
        webCrawler: {
            url: agentWebUrlInput.value.trim(),
            userAgent: agentWebUserAgentInput.value.trim()
                || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.1000.0 Safari/537.36",
            generateSummary: !!agentWebSummaryInput.checked,
            timeoutSeconds: clampInteger(agentWebTimeoutInput.value, 30, 1, 300),
            retryCount: clampInteger(agentWebRetryInput.value, 0, 0, 5),
            maxContentLength: clampInteger(agentWebMaxLengthInput.value, 100000, 1000, 500000)
        },
        database: {
            provider: agentDatabaseProviderInput.value || "sqlserver",
            host: agentDatabaseHostInput.value.trim(),
            port: clampInteger(agentDatabasePortInput.value, 1433, 1, 65535),
            database: agentDatabaseNameInput.value.trim(),
            username: agentDatabaseUsernameInput.value.trim(),
            password: agentDatabasePasswordInput.value,
            useSsl: !!agentDatabaseSslInput.checked,
            mode: agentDatabaseModeInput.value || "query",
            sql: agentDatabaseSqlInput.value,
            parametersJson: JSON.stringify(collectAgentDatabaseParameters()),
            timeoutSeconds: clampInteger(agentDatabaseTimeoutInput.value, 30, 1, 300)
        }
    };
}

function saveAgentToolDialog(event) {
    event.preventDefault();
    if (state.agentToolDialogIndex == null || !state.agentToolDraft) return;
    syncAgentToolDialogDraft();
    state.agentTools[state.agentToolDialogIndex] = structuredClone(state.agentToolDraft);
    renderAgentToolList(state.agentTools);
    syncAgentToolDraftFromForm();
    closeAgentToolDialog(true);
}

function deleteCurrentAgentTool() {
    if (state.agentToolDialogIndex == null) return;
    const index = state.agentToolDialogIndex;
    closeAgentToolDialog(false);
    removeAgentTool(index);
}

function closeAgentToolDialog(keepChanges = false) {
    if (!keepChanges && state.agentToolDialogIndex != null && state.agentToolDraftOriginal) {
        state.agentTools[state.agentToolDialogIndex] = structuredClone(state.agentToolDraftOriginal);
    }
    if (agentToolDialog?.open) {
        agentToolDialog.close();
    }
    resetAgentToolDialogState();
}

function resetAgentToolDialogState() {
    state.agentToolDialogIndex = null;
    state.agentToolDraft = null;
    state.agentToolDraftOriginal = null;
}

function removeAgentTool(index) {
    if (!supportsAgentSettingsUi()) return;
    state.agentTools.splice(index, 1);
    renderAgentToolList(state.agentTools);
    syncAgentToolDraftFromForm();
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
    if (!text) return "[]";
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? JSON.stringify(parsed) : "[]";
    } catch {
        return text;
    }
}

function mergeAgentInstructionWithAutoSection(instruction, tools) {
    const manualSection = stripAgentAutoInstructionSection(instruction);
    const autoSection = buildAgentToolInstructionSection(tools);
    return [manualSection, autoSection].filter(Boolean).join("\n\n").trim();
}

function stripAgentAutoInstructionSection(instruction) {
    const text = String(instruction || "").trim();
    if (!text) return "";
    const start = text.indexOf(agentAutoInstructionSectionStart);
    const end = text.indexOf(agentAutoInstructionSectionEnd);
    if (start === -1 || end === -1 || end < start) {
        return text;
    }
    const before = text.slice(0, start).trim();
    const after = text.slice(end + agentAutoInstructionSectionEnd.length).trim();
    return [before, after].filter(Boolean).join("\n\n").trim();
}

function buildAgentToolInstructionSection(tools) {
    const body = buildAgentToolInstruction(tools);
    return `${agentAutoInstructionSectionStart}\n${body}\n${agentAutoInstructionSectionEnd}`.trim();
}

function buildAgentToolInstruction(tools) {
    const configuredTools = (Array.isArray(tools) ? tools : []).filter(tool => tool.toolType);
    if (configuredTools.length === 0) {
        return "当前未添加任何 Agent 工具。";
    }

    const lines = [
        "以下为当前 Agent 节点声明的外部能力边界与回答约束：",
        "- 只可基于已提供的消息以及下列能力边界组织回答。",
        "- 如果问题超出这些边界，请直接说明当前节点未配置对应工具或执行能力。",
        "- 不要虚构任何网页结果、接口返回、数据库记录或工具执行结果。",
        ""
    ];

    configuredTools.forEach((tool, index) => {
        const meta = agentToolCatalog.find(item => item.type === tool.toolType);
        lines.push(`${index + 1}. ${meta?.label ?? tool.toolType}`);
        if (tool.name) lines.push(`工具名称：${tool.name}`);
        if (tool.purpose) lines.push(`适用场景：${tool.purpose}`);
        if (tool.resource) lines.push(`资源范围：${tool.resource}`);
        if (tool.guardrails) lines.push(`使用约束：${tool.guardrails}`);
        const args = detectAgentToolArgumentNames(tool);
        lines.push(`可提取参数：${args.length ? args.join(", ") : "无"}`);
        lines.push("");
    });

    lines.push("当你无法确认事实时，应明确说明缺少实际工具执行结果。");
    return lines.join("\n").trim();
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
            if (name.startsWith("var.")) name = name.slice(4);
            if (name.startsWith("input.")) continue;
            if (name) names.add(name);
        }
    }
    return Array.from(names.values()).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function renderManualFieldList() {
    manualFieldList.innerHTML = "";
    if (state.manualInputFields.length === 0) {
        manualFieldList.innerHTML = '<div class="manual-field-empty-spacer" aria-hidden="true"></div>';
        return;
    }

    state.manualInputFields.forEach((field, index) => {
        const typeMeta = manualFieldTypes.find(item => item.type === field.type);
        const dateOnlyText = field.dateOnly ? " · 仅日期" : "";
        const item = document.createElement("div");
        item.className = "manual-field-item";
        item.dataset.fieldIndex = String(index);
        item.innerHTML = `
            <span class="manual-field-drag-handle" draggable="true" title="拖动调整顺序" aria-label="拖动调整顺序">
                <span aria-hidden="true"></span>
            </span>
            <span class="manual-field-icon">${manualFieldIconHtml(typeMeta)}</span>
            <span class="manual-field-copy">
                <strong>${escapeHtml(field.label || field.name)}</strong>
                <small>{{${escapeHtml(field.name)}}} · ${escapeHtml(typeMeta?.label ?? field.type)}${field.required ? " · 必填" : ""}${dateOnlyText}</small>
            </span>
            <span class="manual-field-actions">
                <button class="manual-field-action-button edit" type="button" title="修改变量" aria-label="修改变量">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg>
                </button>
                <button class="manual-field-action-button delete" type="button" title="删除变量" aria-label="删除变量">
                    <img src="/assets/delete.svg" alt="" aria-hidden="true">
                </button>
            </span>
        `;
        const dragHandle = item.querySelector(".manual-field-drag-handle");
        dragHandle.addEventListener("dragstart", event => startManualFieldDrag(event, index));
        dragHandle.addEventListener("dragend", finishManualFieldDrag);
        item.addEventListener("dragover", event => dragOverManualField(event, index));
        item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
        item.addEventListener("drop", event => dropManualField(event, index));
        item.querySelector(".manual-field-action-button.edit")
            .addEventListener("click", () => openManualFieldEditor(index));
        item.querySelector(".manual-field-action-button.delete")
            .addEventListener("click", () => removeManualInputField(index));
        manualFieldList.appendChild(item);
    });
}

function manualFieldIconHtml(typeMeta) {
    if (!typeMeta?.iconSrc) {
        return "{}";
    }
    return `<img src="${escapeAttribute(typeMeta.iconSrc)}" alt="" aria-hidden="true">`;
}

function normalizeManualInputFields(fields) {
    if (!Array.isArray(fields)) return [];
    return fields
        .map(field => ({
            id: field.id || createManualFieldId(field.name),
            name: String(field.name ?? "").trim(),
            label: String(field.label ?? "").trim(),
            description: String(field.description ?? "").trim(),
            type: manualFieldTypes.some(item => item.type === field.type) ? field.type : "text",
            required: Boolean(field.required),
            dateOnly: Boolean(field.dateOnly),
            defaultValue: field.defaultValue ?? "",
            options: Array.isArray(field.options) ? field.options.map(option => String(option)).filter(Boolean) : []
        }))
        .filter(field => field.name);
}

function openManualFieldDialog() {
    state.manualFieldEditIndex = null;
    manualFieldForm.reset();
    manualFieldDialogTitle.textContent = "新增变量";
    selectManualFieldType("text");
    manualFieldDialog.showModal();
    window.setTimeout(() => manualFieldNameInput.focus(), 0);
}

function openManualFieldEditor(index) {
    const field = state.manualInputFields[index];
    if (!field) return;

    state.manualFieldEditIndex = index;
    manualFieldForm.reset();
    manualFieldDialogTitle.textContent = "修改变量";
    selectManualFieldType(field.type);
    manualFieldNameInput.value = field.name;
    manualFieldLabelInput.value = field.label;
    manualFieldDescriptionInput.value = field.description;
    manualFieldOptionsInput.value = field.options.join("\n");
    manualFieldRequiredInput.checked = field.required;
    manualFieldDateOnlyInput.checked = field.dateOnly;
    manualFieldDefaultInput.value = field.defaultValue == null ? "" : String(field.defaultValue);
    manualFieldDialog.showModal();
    window.setTimeout(() => manualFieldNameInput.focus(), 0);
}

function closeManualFieldDialog() {
    if (manualFieldDialog.open) manualFieldDialog.close();
    state.manualFieldEditIndex = null;
}

function saveManualInputField(event) {
    event.preventDefault();
    const name = manualFieldNameInput.value.trim();
    if (!name) {
        manualFieldNameInput.focus();
        return;
    }

    if (!/^[A-Za-z_][A-Za-z0-9_./-]*$/.test(name)) {
        setStatus("输入名只能包含字母、数字、下划线、点、斜杠和短横线，且不能以数字开头");
        manualFieldNameInput.focus();
        return;
    }

    if (state.manualInputFields.some((field, index) =>
        index !== state.manualFieldEditIndex
        && field.name.toLowerCase() === name.toLowerCase())) {
        setStatus("输入名不能重复");
        manualFieldNameInput.focus();
        return;
    }

    const type = state.manualFieldType;
    const options = manualFieldOptionsInput.value
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);

    if (["radio", "checkbox", "select"].includes(type) && options.length === 0) {
        setStatus("单选框、多选框或下拉列表框至少需要一个选项");
        manualFieldOptionsInput.focus();
        return;
    }

    const existingField = state.manualFieldEditIndex == null
        ? null
        : state.manualInputFields[state.manualFieldEditIndex];
    const savedField = {
        id: existingField?.id ?? createManualFieldId(name),
        name,
        label: manualFieldLabelInput.value.trim(),
        description: manualFieldDescriptionInput.value.trim(),
        type,
        required: manualFieldRequiredInput.checked,
        dateOnly: ["datetime", "daterange"].includes(type) && manualFieldDateOnlyInput.checked,
        defaultValue: manualFieldDefaultInput.value,
        options
    };

    if (existingField) {
        state.manualInputFields[state.manualFieldEditIndex] = savedField;
    } else {
        state.manualInputFields.push(savedField);
    }
    renderManualFieldList();
    closeManualFieldDialog();
}

function startManualFieldDrag(event, index) {
    state.manualFieldDragIndex = index;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    event.currentTarget.closest(".manual-field-item")?.classList.add("dragging");
}

function dragOverManualField(event, index) {
    if (state.manualFieldDragIndex == null || state.manualFieldDragIndex === index) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    event.currentTarget.classList.add("drag-over");
}

function dropManualField(event, targetIndex) {
    event.preventDefault();
    const sourceIndex = state.manualFieldDragIndex;
    if (sourceIndex == null || sourceIndex === targetIndex) {
        finishManualFieldDrag();
        return;
    }

    const [field] = state.manualInputFields.splice(sourceIndex, 1);
    state.manualInputFields.splice(targetIndex, 0, field);
    finishManualFieldDrag();
    renderManualFieldList();
}

function finishManualFieldDrag() {
    state.manualFieldDragIndex = null;
    manualFieldList.querySelectorAll(".manual-field-item").forEach(item => {
        item.classList.remove("dragging", "drag-over");
    });
}

function removeManualInputField(index) {
    state.manualInputFields.splice(index, 1);
    renderManualFieldList();
}

function applyManualSettings(node) {
    node.settings = {
        ...(node.settings ?? {}),
        fields: normalizeManualInputFields(state.manualInputFields)
    };
}

function createManualFieldId(name) {
    const slug = String(name || "field")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${slug || "field"}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderWeComSettings(node) {
    const settings = node.settings ?? {};
    wecomWebhookUrlInput.value = settings.webhookUrl ?? "";
    wecomContentInput.value = settings.content ?? "{{question}}";
    wecomMentionedListInput.value = settings.mentionedList ?? "";
    wecomMentionedMobileListInput.value = settings.mentionedMobileList ?? "";
}

function renderDatabaseSettings(node) {
    const settings = node.settings ?? {};
    databaseProviderSelect.value = settings.provider ?? "sqlserver";
    databaseModeSelect.value = settings.mode ?? "query";
    databaseHostInput.value = settings.host ?? "";
    databasePortInput.value = settings.port ?? getDatabaseDefaultPort(databaseProviderSelect.value);
    databaseNameInput.value = settings.database ?? "";
    databaseUsernameInput.value = settings.username ?? "";
    databasePasswordInput.value = settings.password ?? "";
    databaseSslInput.checked = settings.useSsl ?? false;
    databaseSqlInput.value = settings.sql ?? "";
    databaseTimeoutInput.value = settings.timeoutSeconds ?? 30;
    renderDatabaseParameters(Array.isArray(settings.parameters) ? settings.parameters : []);
}

function renderDatabaseParameters(parameters) {
    databaseParameterList.innerHTML = "";
    if (parameters.length === 0) {
        databaseParameterList.innerHTML = '<div class="empty-state">暂无 SQL 参数</div>';
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
        row.querySelector("button").addEventListener("click", () => removeDatabaseParameter(index));
        databaseParameterList.appendChild(row);
    });
}

function collectDatabaseParameters() {
    return Array.from(databaseParameterList.querySelectorAll(".database-parameter-item"))
        .map(row => ({
            name: row.querySelector('[data-field="name"]').value.trim(),
            type: row.querySelector('[data-field="type"]').value,
            value: row.querySelector('[data-field="value"]').value
        }))
        .filter(parameter => parameter.name);
}

function addDatabaseParameter() {
    const parameters = collectDatabaseParameters();
    parameters.push({ name: "", type: "string", value: "" });
    renderDatabaseParameters(parameters);
}

function removeDatabaseParameter(index) {
    const parameters = collectDatabaseParameters();
    parameters.splice(index, 1);
    renderDatabaseParameters(parameters);
}

function updateDatabaseDefaultPort() {
    databasePortInput.value = getDatabaseDefaultPort(databaseProviderSelect.value);
}

function getDatabaseDefaultPort(provider) {
    if (provider === "mysql") return 3306;
    if (provider === "postgresql") return 5432;
    return 1433;
}

function renderHttpSettings(node) {
    const settings = node.settings ?? {};
    httpMethodSelect.value = settings.method ?? "GET";
    httpUrlInput.value = settings.url ?? "";
    httpBodyInput.value = settings.body ?? "";
    httpTimeoutInput.value = settings.timeoutSeconds ?? 30;
    httpRetryInput.value = settings.retryCount ?? 0;
    renderHttpQueryParameters(Array.isArray(settings.queryParameters) ? settings.queryParameters : []);
    renderHttpHeaders(Array.isArray(settings.headers) ? settings.headers : []);
}

function renderMailReadSettings(node) {
    const settings = node.settings ?? {};
    mailProtocolSelect.value = settings.protocol ?? "imap";
    mailSecuritySelect.value = settings.security ?? "ssl";
    mailHostInput.value = settings.host ?? "";
    mailPortInput.value = settings.port ?? getMailDefaultPort(mailProtocolSelect.value, mailSecuritySelect.value);
    mailUsernameInput.value = settings.username ?? "";
    mailPasswordInput.value = settings.password ?? "";
    mailFolderInput.value = settings.folder ?? "INBOX";
    mailMaxMessagesInput.value = settings.maxMessages ?? 10;
    mailTimeoutInput.value = settings.timeoutSeconds ?? 60;
    mailMaxAttachmentBytesInput.value = settings.maxAttachmentBytes ?? 5242880;
    mailUnreadOnlyInput.checked = settings.unreadOnly ?? false;
    mailIgnoreKnownInput.checked = settings.ignoreKnownMessages ?? true;
    mailMarkAsReadInput.checked = settings.markAsRead ?? false;
    mailPopDeleteInput.checked = settings.popDeleteAfterRead ?? false;
    mailIncludeAttachmentsInput.checked = settings.includeAttachments ?? true;
    updateMailReadFieldsVisibility();
}

function updateMailReadFieldsVisibility() {
    const isImap = mailProtocolSelect.value === "imap";
    if (mailFolderField) {
        mailFolderField.hidden = !isImap;
    }
    mailUnreadOnlyInput.closest("label").hidden = !isImap;
    mailMarkAsReadInput.closest("label").hidden = !isImap;
    if (mailPopDeleteField) {
        mailPopDeleteField.hidden = isImap;
    }
    if (!isImap) {
        mailUnreadOnlyInput.checked = false;
        mailMarkAsReadInput.checked = false;
    } else {
        mailPopDeleteInput.checked = false;
    }
}

function updateMailDefaultPort() {
    mailPortInput.value = getMailDefaultPort(mailProtocolSelect.value, mailSecuritySelect.value);
}

function getMailDefaultPort(protocol, security) {
    if (protocol === "pop3") {
        return security === "ssl" ? 995 : 110;
    }
    return security === "ssl" ? 993 : 143;
}

function renderKnowledgeRetrievalSettings(node) {
    const settings = node.settings ?? {};
    state.knowledgeRetrievalBaseIds = normalizeKnowledgeRetrievalBaseIds(settings.knowledgeBaseIds);
    state.knowledgeRetrievalPickerOpen = false;
    state.knowledgeRetrievalSearch = "";
    knowledgeRetrievalQueryInput.value = settings.query ?? "{{question}}";
    knowledgeRetrievalTopKInput.value = settings.topK ?? 4;
    knowledgeRetrievalThresholdEnabledInput.checked = settings.scoreThresholdEnabled ?? false;
    knowledgeRetrievalThresholdInput.value = settings.scoreThreshold ?? 0;

    const rerankModel = settings.rerankModel ?? "";
    const options = [...state.rerankModelOptions];
    if (rerankModel && !options.some(option => option.value === rerankModel)) {
        options.push({ value: rerankModel, label: rerankModel });
    }
    knowledgeRetrievalRerankSelect.innerHTML = options
        .map(option => `<option value="${escapeHtml(option.value ?? "")}">${escapeHtml(option.label ?? option.value ?? "")}</option>`)
        .join("");
    knowledgeRetrievalRerankSelect.value = rerankModel;

    renderKnowledgeRetrievalBases();
    updateKnowledgeRetrievalThresholdVisibility();
}

function normalizeKnowledgeRetrievalBaseIds(ids) {
    if (!Array.isArray(ids)) return [];
    return ids
        .map(id => String(id ?? "").trim())
        .filter(Boolean)
        .filter((id, index, values) => values.indexOf(id) === index);
}

function toggleKnowledgeRetrievalBasePicker() {
    state.knowledgeRetrievalPickerOpen = !state.knowledgeRetrievalPickerOpen;
    state.knowledgeRetrievalSearch = "";
    renderKnowledgeRetrievalBases();
}

function addKnowledgeRetrievalBase(event) {
    const button = event.target.closest("[data-add-knowledge-base]");
    if (!button) return;
    const id = button.dataset.addKnowledgeBase;
    if (!id || state.knowledgeRetrievalBaseIds.includes(id)) return;
    state.knowledgeRetrievalBaseIds.push(id);
    state.knowledgeRetrievalPickerOpen = false;
    state.knowledgeRetrievalSearch = "";
    renderKnowledgeRetrievalBases();
}

function searchKnowledgeRetrievalBases(event) {
    if (!event.target.matches("[data-knowledge-retrieval-search]")) return;
    state.knowledgeRetrievalSearch = event.target.value;
    renderKnowledgeRetrievalBases();
    window.setTimeout(() => {
        const input = knowledgeRetrievalBasePicker.querySelector("[data-knowledge-retrieval-search]");
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
    }, 0);
}

function removeKnowledgeRetrievalBase(event) {
    const button = event.target.closest("[data-remove-knowledge-base]");
    if (!button) return;
    state.knowledgeRetrievalBaseIds = state.knowledgeRetrievalBaseIds
        .filter(id => id !== button.dataset.removeKnowledgeBase);
    renderKnowledgeRetrievalBases();
}

function renderKnowledgeRetrievalBases() {
    const selected = state.knowledgeRetrievalBaseIds.map(id => {
        const knowledgeBase = state.knowledgeBases.find(item => item.id === id);
        return knowledgeBase ?? { id, name: "知识库不可用", indexMode: "" };
    });
    const normalizedSearch = state.knowledgeRetrievalSearch.trim().toLowerCase();
    const available = state.knowledgeBases.filter(item =>
        !state.knowledgeRetrievalBaseIds.includes(item.id)
        && (!normalizedSearch
            || [item.name, item.description, getKnowledgeIndexModeLabel(item.indexMode)]
                .join(" ")
                .toLowerCase()
                .includes(normalizedSearch)));

    knowledgeRetrievalBaseList.innerHTML = selected.length
        ? selected.map(item => `
            <article class="knowledge-retrieval-base-card">
                <span class="knowledge-retrieval-base-main">
                    <span class="knowledge-retrieval-base-icon">
                        <img src="/assets/knowledge.svg" alt="">
                    </span>
                    <strong>${escapeHtml(item.name || "未命名知识库")}</strong>
                </span>
                <span class="knowledge-retrieval-base-meta">
                    <span class="knowledge-retrieval-index-chip">${escapeHtml(getKnowledgeIndexModeLabel(item.indexMode))}</span>
                    <button class="knowledge-retrieval-remove" type="button"
                            data-remove-knowledge-base="${escapeHtml(item.id)}"
                            title="移除知识库" aria-label="移除知识库">移除</button>
                </span>
            </article>
        `).join("")
        : '<div class="knowledge-retrieval-empty">暂未添加知识库</div>';

    knowledgeRetrievalBasePicker.hidden = !state.knowledgeRetrievalPickerOpen;
    knowledgeRetrievalBasePicker.innerHTML = `
        <div class="knowledge-retrieval-picker-search">
            <input type="search" data-knowledge-retrieval-search
                   value="${escapeHtml(state.knowledgeRetrievalSearch)}"
                   placeholder="搜索知识库">
        </div>
        ${available.length
            ? available.map(item => `
            <button type="button" data-add-knowledge-base="${escapeHtml(item.id)}">
                <span class="knowledge-retrieval-base-main">
                    <span class="knowledge-retrieval-base-icon">
                        <img src="/assets/knowledge.svg" alt="">
                    </span>
                    <span>
                        <strong>${escapeHtml(item.name || "未命名知识库")}</strong>
                        <small>${escapeHtml(getKnowledgeIndexModeLabel(item.indexMode))}</small>
                    </span>
                </span>
            </button>
        `).join("")
            : '<div class="knowledge-retrieval-empty">没有找到可添加的知识库</div>'}
    `;
    addKnowledgeRetrievalBaseButton.classList.toggle("is-open", state.knowledgeRetrievalPickerOpen);
    addKnowledgeRetrievalBaseButton.setAttribute(
        "aria-expanded",
        String(state.knowledgeRetrievalPickerOpen));

    if (state.knowledgeRetrievalPickerOpen && !state.knowledgeRetrievalSearch) {
        window.setTimeout(() =>
            knowledgeRetrievalBasePicker
                .querySelector("[data-knowledge-retrieval-search]")
                ?.focus(), 0);
    }
}

function closeKnowledgeRetrievalPickerFromOutside(event) {
    if (!state.knowledgeRetrievalPickerOpen) return;
    if (event.target.closest(".knowledge-retrieval-picker-anchor")) return;
    closeKnowledgeRetrievalPicker();
}

function closeKnowledgeRetrievalPicker() {
    if (!state.knowledgeRetrievalPickerOpen) return;
    state.knowledgeRetrievalPickerOpen = false;
    state.knowledgeRetrievalSearch = "";
    renderKnowledgeRetrievalBases();
}

function getKnowledgeIndexModeLabel(indexMode) {
    const labels = {
        hybrid: "混合检索",
        vector: "向量检索",
        "full-text": "全文检索"
    };
    return labels[String(indexMode || "").toLowerCase()] ?? "混合检索";
}

function updateKnowledgeRetrievalThresholdVisibility() {
    knowledgeRetrievalThresholdField.hidden = !knowledgeRetrievalThresholdEnabledInput.checked;
}

function renderWebCrawlerSettings(node) {
    const settings = node.settings ?? {};
    webCrawlerUrlInput.value = settings.url ?? "";
    webCrawlerUserAgentInput.value = settings.userAgent
        ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.1000.0 Safari/537.36";
    webCrawlerGenerateSummaryInput.checked = settings.generateSummary ?? true;
    webCrawlerTimeoutInput.value = settings.timeoutSeconds ?? 30;
    webCrawlerRetryInput.value = settings.retryCount ?? 0;
    webCrawlerMaxLengthInput.value = settings.maxContentLength ?? 100000;
}

function renderHttpQueryParameters(parameters) {
    renderHttpKeyValueRows(
        httpQueryList,
        parameters,
        "暂无请求参数",
        "参数名",
        "参数值，支持 {{变量}}",
        removeHttpQueryParameter);
}

function renderHttpHeaders(headers) {
    renderHttpKeyValueRows(
        httpHeaderList,
        headers,
        "暂无自定义请求头",
        "Header 名称",
        "Header 值，支持 {{变量}}",
        removeHttpHeader);
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

function collectHttpKeyValueRows(container) {
    return Array.from(container.querySelectorAll(".http-key-value-item"))
        .map(row => ({
            name: row.querySelector('[data-field="name"]').value.trim(),
            value: row.querySelector('[data-field="value"]').value
        }))
        .filter(header => header.name);
}

function collectHttpHeaders() {
    return collectHttpKeyValueRows(httpHeaderList);
}

function collectHttpQueryParameters() {
    return collectHttpKeyValueRows(httpQueryList);
}

function addHttpQueryParameter() {
    const parameters = collectHttpQueryParameters();
    parameters.push({ name: "", value: "" });
    renderHttpQueryParameters(parameters);
}

function removeHttpQueryParameter(index) {
    const parameters = collectHttpQueryParameters();
    parameters.splice(index, 1);
    renderHttpQueryParameters(parameters);
}

function addHttpHeader() {
    const headers = collectHttpHeaders();
    headers.push({ name: "", value: "" });
    renderHttpHeaders(headers);
}

function removeHttpHeader(index) {
    const headers = collectHttpHeaders();
    headers.splice(index, 1);
    renderHttpHeaders(headers);
}

function renderOutputSettings(node) {
    const settings = node.settings ?? {};
    const selectedVariable = settings.variable ?? inferLegacyOutputVariable(settings);
    state.outputTableColumns = normalizeOutputTableColumns(settings.tableColumns);
    outputVariableSelect.innerHTML = '<option value="">全部变量</option>';

    for (const item of collectWorkflowVariables(node.id)) {
        const option = document.createElement("option");
        option.value = item.name;
        option.textContent = item.source ? `${item.name}（${item.source}）` : item.name;
        outputVariableSelect.appendChild(option);
    }

    const customOption = document.createElement("option");
    customOption.value = "__custom__";
    customOption.textContent = "自定义内容";
    outputVariableSelect.appendChild(customOption);

    if (selectedVariable && !Array.from(outputVariableSelect.options).some(option => option.value === selectedVariable)) {
        const option = document.createElement("option");
        option.value = selectedVariable;
        option.textContent = selectedVariable;
        outputVariableSelect.appendChild(option);
    }

    outputVariableSelect.value = selectedVariable;
    outputFormatSelect.value = settings.outputFormat === "table" ? "table" : "json";
    outputCustomValueInput.value = settings.customValue ?? "";
    renderOutputTableColumns();
    updateOutputCustomValueVisibility();
    updateOutputTableSettingsVisibility();
}

function updateOutputCustomValueVisibility() {
    outputCustomValueField.hidden = outputVariableSelect.value !== "__custom__";
}

function updateOutputTableSettingsVisibility() {
    const isTable = outputFormatSelect.value === "table";
    outputTableSettings.hidden = !isTable;
    if (isTable && state.outputTableColumns.length === 0) {
        state.outputTableColumns = [createOutputTableColumn()];
        renderOutputTableColumns();
    }
}

function normalizeOutputTableColumns(columns) {
    if (!Array.isArray(columns)) return [];
    return columns.map(column => ({
        id: String(column.id || createManualFieldId("column")),
        title: String(column.title ?? ""),
        path: String(column.path ?? "")
    }));
}

function createOutputTableColumn() {
    return {
        id: createManualFieldId("column"),
        title: "",
        path: ""
    };
}

function collectOutputTableColumns() {
    return Array.from(outputTableColumnList.querySelectorAll("[data-output-column-id]")).map(item => ({
        id: item.dataset.outputColumnId,
        title: item.querySelector('[data-field="title"]').value.trim(),
        path: item.querySelector('[data-field="path"]').value.trim()
    }));
}

function renderOutputTableColumns() {
    outputTableColumnList.innerHTML = state.outputTableColumns.map((column, index) => `
        <article class="output-table-column-item" data-output-column-id="${escapeAttribute(column.id)}">
            <div class="output-table-column-heading">
                <strong class="output-table-column-title">
                    <img src="/assets/png/AutoSizeColumn.png" alt="" aria-hidden="true">
                    列 ${index + 1}
                </strong>
                <button class="file-delete-button" type="button" data-remove-output-column="${index}"
                        title="删除表格列" aria-label="删除表格列">
                    <img src="/assets/delete.svg" alt="" aria-hidden="true">
                </button>
            </div>
            <label>
                列标题
                <input data-field="title" type="text" value="${escapeAttribute(column.title)}" placeholder="例如：姓名">
            </label>
            <label>
                JSON 字段路径
                <input data-field="path" type="text" value="${escapeAttribute(column.path)}" placeholder="例如：user.name">
            </label>
        </article>
    `).join("");

    outputTableColumnList.querySelectorAll("[data-remove-output-column]").forEach(button => {
        button.addEventListener("click", () => removeOutputTableColumn(Number(button.dataset.removeOutputColumn)));
    });
}

function addOutputTableColumn() {
    state.outputTableColumns = collectOutputTableColumns();
    state.outputTableColumns.push(createOutputTableColumn());
    renderOutputTableColumns();
}

function removeOutputTableColumn(index) {
    state.outputTableColumns = collectOutputTableColumns();
    state.outputTableColumns.splice(index, 1);
    renderOutputTableColumns();
}

function collectWorkflowVariables(outputNodeId) {
    const variables = new Map();
    const add = (name, source, description = "") => {
        if (name && !variables.has(name)) variables.set(name, { name, source, description });
    };
    const knownOutputs = {
        "trigger.manual": ["question", "files"],
        "trigger.schedule": ["scheduledAt", "triggerNodeId"],
        "ai.agent": ["agentReply", "agentProvider", "agentModel", "agentExecutionMode", "agentTrace"],
        "ai.llm-chat": ["llmText", "llmProvider", "llmModel"],
        "utility.current-time": [
            "currentTime",
            "currentTimeIso",
            "currentTimeUtc",
            "currentTimeZone",
            "currentUnixTimeSeconds"
        ],
        "integration.mail-read": [
            "mailProtocol",
            "mailFolder",
            "mailCount",
            "mailFetchedCount",
            "mailSkippedCount",
            "mailItems",
            "mailMessages",
            "latestMailItem",
            "latestMail",
            "latestMailText",
            "latestMailHtml",
            "latestMailAttachments"
        ],
        "ai.knowledge-retrieval": [
            "knowledgeQuery",
            "knowledgeHits",
            "knowledgeContext",
            "knowledgeHitCount"
        ],
        "ai.question-classifier": ["questionClassId", "questionClassName"],
        "flow.for-each": ["forEachCount"],
        "integration.http-request": ["statusCode", "responseBody", "requestAttempts"],
        "integration.web-crawler": [
            "webUrl",
            "webTitle",
            "webDescription",
            "webContent",
            "webSummary",
            "webLinks",
            "webStatusCode",
            "webContentType",
            "webRequestAttempts"
        ],
        "integration.database": ["databaseRows", "affectedRows"]
    };

    for (const node of state.workflow.nodes) {
        if (node.id === outputNodeId) continue;
        for (const name of knownOutputs[node.type] ?? []) add(name, node.name, describeWorkflowVariable(name, node.type));
        if (node.type === "trigger.manual") {
            for (const field of normalizeManualInputFields(node.settings?.fields)) {
                add(field.name, node.name, field.description || `用户输入字段：${field.label || field.name}`);
            }
        }
        if (node.type === "flow.for-each") {
            add(node.settings?.itemVariableName || "currentItem", node.name, "For Each 当前项变量");
            add(node.settings?.indexVariableName || "currentIndex", node.name, "For Each 当前索引变量");
        }
        if (node.type === "data.template") {
            const outputVariable = node.settings?.variable ?? inferLegacyOutputVariable(node.settings ?? {});
            add(
                outputVariable === "__custom__" ? "text" : outputVariable,
                node.name,
                outputVariable === "__custom__"
                    ? describeWorkflowVariable("text", node.type)
                    : `输出节点生成的变量：${outputVariable}`);
        }

        const settingsJson = JSON.stringify(node.settings ?? {});
        for (const match of settingsJson.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
            add(match[1], node.name, describeWorkflowVariable(match[1], node.type));
        }
    }

    add("var.workflowId", "系统", describeWorkflowVariable("var.workflowId"));
    add("var.executionId", "系统", describeWorkflowVariable("var.executionId"));
    add("var.triggeredAt", "系统", describeWorkflowVariable("var.triggeredAt"));
    return Array.from(variables.values());
}

function describeWorkflowVariable(name, nodeType = "") {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
        return "";
    }

    if (variableDescriptions[normalizedName]) {
        return variableDescriptions[normalizedName];
    }

    if (normalizedName.startsWith("var.")) {
        return "系统级运行变量。";
    }

    if (nodeType === "trigger.manual") {
        return "用户输入节点产生的表单变量。";
    }

    return "可在后续节点中引用的工作流变量。";
}

function inferLegacyOutputVariable(settings) {
    const match = String(settings?.template ?? "").match(/^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/);
    return match?.[1] ?? "";
}

function renderProviderConfigOptions(select, selectedId) {
    select.innerHTML = "";
    for (const config of state.providerConfigs) {
        const option = document.createElement("option");
        option.value = config.id;
        option.textContent = config.name;
        option.disabled = !config.enabled;
        select.appendChild(option);
    }
    select.value = selectedId ?? "";
}

function renderAgentProviderConfigOptions(selectedId) {
    const options = llmProviderPickerOptions();
    agentProviderConfigSelect.innerHTML = options
        .map(option => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
    agentProviderConfigSelect.value = options.some(option => option.value === selectedId)
        ? selectedId
        : options[0]?.value ?? "";
    renderAgentProviderPicker();
}

function renderClassifierProviderConfigOptions(selectedId) {
    const options = llmProviderPickerOptions();
    classifierProviderConfigSelect.innerHTML = options
        .map(option => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
    classifierProviderConfigSelect.value = options.some(option => option.value === selectedId)
        ? selectedId
        : options[0].value;
    renderClassifierProviderPicker();
}

function renderClassifierProviderPicker() {
    if (!classifierProviderConfigPicker) return;

    const options = llmProviderPickerOptions();
    const selected = options.find(option => option.value === classifierProviderConfigSelect.value) || options[0];
    const query = state.classifierPickerSearch.trim().toLowerCase();
    const filtered = query
        ? options.filter(option =>
            [option.modelName, option.providerName, option.label].join(" ").toLowerCase().includes(query))
        : options;
    const groups = new Map();
    filtered.forEach(option => {
        const groupName = option.providerName || "其他";
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName).push(option);
    });

    classifierProviderConfigPicker.innerHTML = `
        <button type="button" class="floating-model-trigger${state.classifierPickerOpen ? " is-open" : ""}" data-classifier-picker-trigger>
            <span class="floating-model-selected">
                ${providerLogoHtml(selected.providerId)}
                <span class="floating-model-selected-copy">
                    <strong>${escapeHtml(selected.modelName)}</strong>
                </span>
            </span>
            <span class="floating-model-caret" aria-hidden="true"><img src="/assets/down.svg" alt=""></span>
        </button>
        <div class="floating-model-panel${state.classifierPickerOpen ? " is-open" : ""}">
            <div class="floating-model-search-row">
                <input type="search" class="floating-model-search" data-classifier-picker-search
                       value="${escapeAttribute(state.classifierPickerSearch)}" placeholder="搜索模型">
            </div>
            <div class="floating-model-options">
                ${groups.size ? Array.from(groups.entries()).map(([groupName, items]) => `
                    <section class="floating-model-group">
                        <header>${escapeHtml(groupName)}</header>
                        ${items.map(item => `
                            <button type="button"
                                    class="floating-model-option${item.value === selected.value ? " is-selected" : ""}"
                                    data-classifier-picker-option="${escapeAttribute(item.value)}">
                                ${providerLogoHtml(item.providerId)}
                                <span class="floating-model-option-copy">
                                    <strong>${escapeHtml(item.modelName)}</strong>
                                </span>
                            </button>
                        `).join("")}
                    </section>
                `).join("") : '<div class="floating-model-empty">没有找到匹配的模型</div>'}
            </div>
        </div>
    `;

    if (state.classifierPickerOpen) {
        window.setTimeout(() => classifierProviderConfigPicker.querySelector("[data-classifier-picker-search]")?.focus(), 0);
    }
}

function handleClassifierPickerClick(event) {
    if (event.target.closest("[data-classifier-picker-trigger]")) {
        event.stopPropagation();
        state.classifierPickerOpen = !state.classifierPickerOpen;
        if (state.classifierPickerOpen) state.classifierPickerSearch = "";
        renderClassifierProviderPicker();
        event.preventDefault();
        return;
    }

    const option = event.target.closest("[data-classifier-picker-option]");
    if (!option) return;
    event.stopPropagation();
    classifierProviderConfigSelect.value = option.dataset.classifierPickerOption;
    state.classifierPickerOpen = false;
    state.classifierPickerSearch = "";
    renderClassifierProviderPicker();
    event.preventDefault();
}

function handleClassifierPickerSearch(event) {
    if (!event.target.matches("[data-classifier-picker-search]")) return;
    state.classifierPickerSearch = event.target.value;
    renderClassifierProviderPicker();
}

function closeClassifierPickerFromOutside(event) {
    if (!state.classifierPickerOpen || event.target.closest("#classifierProviderConfigPicker")) return;
    state.classifierPickerOpen = false;
    state.classifierPickerSearch = "";
    renderClassifierProviderPicker();
}

function renderAgentProviderPicker() {
    if (!agentProviderConfigPicker) return;

    const options = llmProviderPickerOptions();
    const selected = options.find(option => option.value === agentProviderConfigSelect.value) || options[0];
    const query = state.agentPickerSearch.trim().toLowerCase();
    const filtered = query
        ? options.filter(option =>
            [option.modelName, option.providerName, option.label].join(" ").toLowerCase().includes(query))
        : options;
    const groups = new Map();
    filtered.forEach(option => {
        const groupName = option.providerName || "其他";
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName).push(option);
    });

    agentProviderConfigPicker.innerHTML = `
        <button type="button" class="floating-model-trigger${state.agentPickerOpen ? " is-open" : ""}" data-agent-picker-trigger>
            <span class="floating-model-selected">
                ${providerLogoHtml(selected?.providerId)}
                <span class="floating-model-selected-copy">
                    <strong>${escapeHtml(selected?.modelName ?? "请选择模型")}</strong>
                </span>
            </span>
            <span class="floating-model-caret" aria-hidden="true"><img src="/assets/down.svg" alt=""></span>
        </button>
        <div class="floating-model-panel${state.agentPickerOpen ? " is-open" : ""}">
            <div class="floating-model-search-row">
                <input type="search" class="floating-model-search" data-agent-picker-search
                       value="${escapeAttribute(state.agentPickerSearch)}" placeholder="搜索模型">
            </div>
            <div class="floating-model-options">
                ${groups.size ? Array.from(groups.entries()).map(([groupName, items]) => `
                    <section class="floating-model-group">
                        <header>${escapeHtml(groupName)}</header>
                        ${items.map(item => `
                            <button type="button"
                                    class="floating-model-option${item.value === selected?.value ? " is-selected" : ""}"
                                    data-agent-picker-option="${escapeAttribute(item.value)}">
                                ${providerLogoHtml(item.providerId)}
                                <span class="floating-model-option-copy">
                                    <strong>${escapeHtml(item.modelName)}</strong>
                                </span>
                            </button>
                        `).join("")}
                    </section>
                `).join("") : '<div class="floating-model-empty">没有找到匹配的模型</div>'}
            </div>
        </div>
    `;

    if (state.agentPickerOpen) {
        window.setTimeout(() => agentProviderConfigPicker.querySelector("[data-agent-picker-search]")?.focus(), 0);
    }
}

function handleAgentPickerClick(event) {
    if (event.target.closest("[data-agent-picker-trigger]")) {
        event.stopPropagation();
        state.agentPickerOpen = !state.agentPickerOpen;
        if (state.agentPickerOpen) state.agentPickerSearch = "";
        renderAgentProviderPicker();
        event.preventDefault();
        return;
    }

    const option = event.target.closest("[data-agent-picker-option]");
    if (!option) return;
    event.stopPropagation();
    agentProviderConfigSelect.value = option.dataset.agentPickerOption;
    state.agentPickerOpen = false;
    state.agentPickerSearch = "";
    renderAgentProviderPicker();
    event.preventDefault();
}

function handleAgentPickerSearch(event) {
    if (!event.target.matches("[data-agent-picker-search]")) return;
    state.agentPickerSearch = event.target.value;
    renderAgentProviderPicker();
}

function closeAgentPickerFromOutside(event) {
    if (!state.agentPickerOpen || event.target.closest("#agentProviderConfigPicker")) return;
    state.agentPickerOpen = false;
    state.agentPickerSearch = "";
    renderAgentProviderPicker();
}

function llmProviderPickerOptions() {
    const options = state.providerConfigs
        .filter(config => config.enabled)
        .filter(config => !config.modelType || String(config.modelType).toLowerCase() === "llm")
        .map(config => ({
            value: config.id,
            label: config.model || config.name,
            providerId: String(config.provider || config.name || "system").toLowerCase(),
            providerName: config.provider || config.name,
            modelName: config.model || config.name
        }));

    return options.length
        ? options
        : [{
            value: "",
            label: "暂无可用模型配置",
            providerId: "system",
            providerName: "系统",
            modelName: "暂无可用模型配置"
        }];
}

function renderLlmProviderConfigOptions(selectedId) {
    const options = llmProviderPickerOptions();
    llmProviderConfigSelect.innerHTML = options
        .map(option => `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`)
        .join("");
    llmProviderConfigSelect.value = options.some(option => option.value === selectedId)
        ? selectedId
        : options[0].value;
    renderLlmProviderPicker();
}

function renderLlmProviderPicker() {
    const options = llmProviderPickerOptions();
    const selected = options.find(option => option.value === llmProviderConfigSelect.value) || options[0];
    const query = state.llmPickerSearch.trim().toLowerCase();
    const filtered = query
        ? options.filter(option =>
            [option.modelName, option.providerName, option.label].join(" ").toLowerCase().includes(query))
        : options;
    const groups = new Map();
    filtered.forEach(option => {
        const groupName = option.providerName || "其他";
        if (!groups.has(groupName)) groups.set(groupName, []);
        groups.get(groupName).push(option);
    });

    llmProviderConfigPicker.innerHTML = `
        <button type="button" class="floating-model-trigger${state.llmPickerOpen ? " is-open" : ""}" data-llm-picker-trigger>
            <span class="floating-model-selected">
                ${providerLogoHtml(selected.providerId)}
                <span class="floating-model-selected-copy">
                    <strong>${escapeHtml(selected.modelName)}</strong>
                </span>
            </span>
            <span class="floating-model-caret" aria-hidden="true"><img src="/assets/down.svg" alt=""></span>
        </button>
        <div class="floating-model-panel${state.llmPickerOpen ? " is-open" : ""}">
            <div class="floating-model-search-row">
                <input type="search" class="floating-model-search" data-llm-picker-search
                       value="${escapeAttribute(state.llmPickerSearch)}" placeholder="搜索模型">
            </div>
            <div class="floating-model-options">
                ${groups.size ? Array.from(groups.entries()).map(([groupName, items]) => `
                    <section class="floating-model-group">
                        <header>${escapeHtml(groupName)}</header>
                        ${items.map(item => `
                            <button type="button"
                                    class="floating-model-option${item.value === selected.value ? " is-selected" : ""}"
                                    data-llm-picker-option="${escapeAttribute(item.value)}">
                                ${providerLogoHtml(item.providerId)}
                                <span class="floating-model-option-copy">
                                    <strong>${escapeHtml(item.modelName)}</strong>
                                </span>
                            </button>
                        `).join("")}
                    </section>
                `).join("") : '<div class="floating-model-empty">没有找到匹配的模型</div>'}
            </div>
        </div>
    `;

    if (state.llmPickerOpen) {
        window.setTimeout(() => llmProviderConfigPicker.querySelector("[data-llm-picker-search]")?.focus(), 0);
    }
}

function handleLlmPickerClick(event) {
    if (event.target.closest("[data-llm-picker-trigger]")) {
        event.stopPropagation();
        state.llmPickerOpen = !state.llmPickerOpen;
        if (state.llmPickerOpen) state.llmPickerSearch = "";
        renderLlmProviderPicker();
        event.preventDefault();
        return;
    }

    const option = event.target.closest("[data-llm-picker-option]");
    if (!option) return;
    event.stopPropagation();
    llmProviderConfigSelect.value = option.dataset.llmPickerOption;
    state.llmPickerOpen = false;
    state.llmPickerSearch = "";
    renderLlmProviderPicker();
    event.preventDefault();
}

function handleLlmPickerSearch(event) {
    if (!event.target.matches("[data-llm-picker-search]")) return;
    state.llmPickerSearch = event.target.value;
    renderLlmProviderPicker();
}

function closeLlmPickerFromOutside(event) {
    if (!state.llmPickerOpen || event.target.closest("#llmProviderConfigPicker")) return;
    state.llmPickerOpen = false;
    state.llmPickerSearch = "";
    renderLlmProviderPicker();
}

function providerLogoHtml(providerId) {
    const source = providerLogoSrc(providerId);
    if (source) {
        return `<span class="floating-model-logo has-image"><img src="${escapeAttribute(source)}" alt=""></span>`;
    }

    const fallback = {
        system: "系",
        deepseek: "D",
        gemini: "G",
        hunyuan: "混",
        ollama: "O",
        openai: "O",
        qwen: "Q",
        doubao: "豆",
        vllm: "V",
        zhipu: "Z",
        volcengine: "豆"
    };
    return `<span class="floating-model-logo">${escapeHtml(fallback[providerId] || "?")}</span>`;
}

function providerLogoSrc(providerId) {
    const logos = {
        system: "/assets/setting.svg",
        deepseek: "/assets/deepseek.svg",
        gemini: "/assets/gemini.svg",
        hunyuan: "/assets/tencent.png",
        ollama: "/assets/Ollama.svg",
        openai: "/assets/OpenAI.svg",
        qwen: "/assets/tongyi.svg",
        doubao: "/assets/Volcengine.svg",
        vllm: "/assets/vLLM.svg",
        zhipu: "/assets/ZHIPU.svg",
        volcengine: "/assets/Volcengine.svg"
    };
    return logos[String(providerId || "").toLowerCase()] || "";
}

function renderLlmSettings(node) {
    const settings = node.settings ?? {};
    const messages = Array.isArray(settings.messages) ? settings.messages : [];
    const systemMessage = messages.find(message => message.role === "system");
    const legacyDefaultPrompt = "You are a concise and reliable Chinese assistant.";

    renderLlmProviderConfigOptions(settings.providerConfigId);
    llmSystemPromptInput.value = systemMessage?.content === legacyDefaultPrompt ? "" : systemMessage?.content ?? "";
    llmUserPromptInput.value = messages.find(message => message.role === "user")?.content ?? "{{question}}";
    llmTimeoutInput.value = settings.timeoutSeconds ?? 120;
    llmFileInput.value = "";
    renderBuiltInFiles(settings.files ?? []);
}

function renderClassifierSettings(node) {
    const settings = node.settings ?? {};
    renderClassifierProviderConfigOptions(settings.providerConfigId);
    classifierInput.value = settings.input ?? "{{question}}";
    classifierInstruction.value = settings.instruction ?? "";
    classifierClassList.innerHTML = "";

    const classes = Array.isArray(settings.classes) ? settings.classes : [];
    classes.forEach((item, index) => {
        const className = `分类${index + 1}`;
        const row = document.createElement("div");
        row.className = "classifier-class-item";
        row.innerHTML = `
            <strong>${className}</strong>
            <button class="file-delete-button" type="button" title="删除分类" aria-label="删除分类">×</button>
            <textarea data-field="description" rows="3" placeholder="描述该分类覆盖的问题和典型表达">${escapeHtml(item.description ?? "")}</textarea>
        `;
        row.querySelector("button").addEventListener("click", () => removeClassifierClass(index));
        classifierClassList.appendChild(row);
    });
}

function addClassifierClass() {
    const node = state.selected?.kind === "node" ? findNode(state.selected.id) : null;
    if (!node || node.type !== "ai.question-classifier") return;
    node.settings.classes ??= [];
    collectClassifierClasses(node);
    const index = node.settings.classes.length + 1;
    node.settings.classes.push({ id: `class-${index}`, name: `分类${index}`, description: "" });
    renderClassifierSettings(node);
}

function removeClassifierClass(index) {
    const node = state.selected?.kind === "node" ? findNode(state.selected.id) : null;
    if (!node || node.type !== "ai.question-classifier") return;
    collectClassifierClasses(node);
    node.settings.classes.splice(index, 1);
    renderClassifierSettings(node);
    renderNodes();
    renderEdges();
}

function collectClassifierClasses(node) {
    node.settings.classes = Array.from(classifierClassList.querySelectorAll(".classifier-class-item")).map((row, index) => ({
        id: `class-${index + 1}`,
        name: `分类${index + 1}`,
        description: row.querySelector('[data-field="description"]').value.trim()
    }));
}

function renderBuiltInFiles(files) {
    llmFileList.innerHTML = "";

    if (files.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "暂未添加内置文件";
        llmFileList.appendChild(empty);
        return;
    }

    files.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "built-in-file";
        item.innerHTML = `
            <div>
                <strong>${escapeHtml(file.name ?? "file")}</strong>
                <span>${escapeHtml(file.mimeType ?? "application/octet-stream")} · ${formatBytes(file.size ?? estimateFileSize(file))}</span>
            </div>
            <button class="file-delete-button" type="button" title="删除文件" aria-label="删除文件">×</button>
        `;
        item.querySelector("button").addEventListener("click", () => removeBuiltInFile(index));
        llmFileList.appendChild(item);
    });
}

async function addBuiltInFiles() {
    const node = state.selected?.kind === "node" ? findNode(state.selected.id) : null;
    if (!node || node.type !== "ai.llm-chat") return;

    const selectedFiles = Array.from(llmFileInput.files ?? []);
    if (selectedFiles.length === 0) return;

    try {
        setStatus("正在读取内置文件...");
        const files = node.settings.files ?? [];
        for (const file of selectedFiles) {
            files.push(await serializeBuiltInFile(file));
        }

        node.settings.files = files;
        llmFileInput.value = "";
        renderBuiltInFiles(files);
        setStatus(`已添加 ${selectedFiles.length} 个内置文件`);
    } catch (error) {
        setStatus(`读取文件失败：${error.message}`);
    }
}

function removeBuiltInFile(index) {
    const node = state.selected?.kind === "node" ? findNode(state.selected.id) : null;
    if (!node || node.type !== "ai.llm-chat") return;

    const files = node.settings.files ?? [];
    files.splice(index, 1);
    node.settings.files = files;
    renderBuiltInFiles(files);
    setStatus("内置文件已删除");
}

async function serializeBuiltInFile(file) {
    const result = {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size
    };

    if (isTextFile(file)) {
        result.text = await readFileAsText(file);
    } else {
        result.base64 = await readFileAsBase64(file);
        if (file.type.startsWith("image/")) {
            result.detail = "high";
        }
    }

    return result;
}

function dropNewNode(event) {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/easegpt-node-type");
    if (!type) return;

    addNodeToCanvas(type, toCanvasPoint(event.clientX, event.clientY));
}

function addNodeToCanvas(type, point) {
    const descriptor = state.nodeTypes.find(item => item.type === type);
    const node = {
        id: createNodeId(type),
        type,
        name: getNodeDisplayName(descriptor, type),
        position: { x: snap(point.x - 95), y: snap(point.y - 40) },
        settings: createDefaultSettings(type)
    };

    state.workflow.nodes.push(node);
    state.selected = { kind: "node", id: node.id };
    renderAll();
    setStatus(`已添加节点：${node.name}`);
}

function getNodeDisplayName(descriptor, type) {
    if (type === "integration.web-crawler") return chineseNodeNames[type];
    return descriptor?.displayName
        ?? descriptor?.name
        ?? chineseNodeNames[type]
        ?? type;
}

function getNodeUiName(node) {
    return node.type === "integration.web-crawler"
        ? chineseNodeNames[node.type]
        : node.name;
}

function renderNodeIcon(type) {
    if (type === "integration.wecom-message") {
        return '<img src="/assets/wechat.svg" alt="" aria-hidden="true">';
    }
    if (type === "integration.web-crawler") {
        return '<img src="/assets/webcra.svg" alt="" aria-hidden="true">';
    }
    if (type === "ai.knowledge-retrieval") {
        return '<img src="/assets/knowledge.svg" alt="" aria-hidden="true">';
    }

    const paths = nodeIcons[type] ?? '<circle cx="12" cy="12" r="8"/><path d="M12 8v4"/><path d="M12 16h.01"/>';
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

function createDefaultSettings(type) {
    if (type === "ai.agent") {
        return {
            providerConfigId: state.providerConfigs.find(config => config.enabled)?.id ?? "",
            message: "{{question}}",
            instruction: "",
            maxIterations: 5,
            tools: [],
            timeoutSeconds: 180
        };
    }

    if (type === "ai.llm-chat") {
        return {
            providerConfigId: "doubao-default",
            messages: [
                { role: "user", content: "{{question}}" }
            ],
            files: [],
            filesInputKey: "files",
            imageDetail: "high",
            stream: true
        };
    }

    if (type === "ai.question-classifier") {
        return {
            providerConfigId: state.providerConfigs.find(config => config.enabled)?.id ?? "",
            input: "{{question}}",
            instruction: "",
            classes: [
                { id: "class-1", name: "分类1", description: "描述分类1覆盖的问题" },
                { id: "class-2", name: "分类2", description: "描述分类2覆盖的问题" }
            ]
        };
    }

    if (type === "flow.for-each") {
        return {
            itemsVariable: "",
            itemVariableName: "currentItem",
            indexVariableName: "currentIndex"
        };
    }

    if (type === "data.template") {
        return { variable: "", outputFormat: "json", tableColumns: [] };
    }

    if (type === "integration.http-request") {
        return {
            method: "GET",
            url: "",
            queryParameters: [],
            headers: [],
            body: "",
            timeoutSeconds: 30,
            retryCount: 0
        };
    }

    if (type === "integration.mail-read") {
        return {
            protocol: "imap",
            host: "",
            port: 993,
            security: "ssl",
            username: "",
            password: "",
            folder: "INBOX",
            unreadOnly: false,
            ignoreKnownMessages: true,
            markAsRead: false,
            popDeleteAfterRead: false,
            maxMessages: 10,
            includeAttachments: true,
            maxAttachmentBytes: 5242880,
            timeoutSeconds: 60
        };
    }

    if (type === "ai.knowledge-retrieval") {
        return {
            query: "{{question}}",
            knowledgeBaseIds: [],
            rerankModel: "",
            topK: 4,
            scoreThresholdEnabled: false,
            scoreThreshold: 0
        };
    }

    if (type === "integration.web-crawler") {
        return {
            url: "",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.1000.0 Safari/537.36",
            generateSummary: true,
            timeoutSeconds: 30,
            retryCount: 0,
            maxContentLength: 100000
        };
    }

    if (type === "integration.wecom-message") {
        return {
            webhookUrl: "",
            content: "{{question}}",
            mentionedList: "",
            mentionedMobileList: ""
        };
    }

    if (type === "integration.database") {
        return {
            provider: "sqlserver",
            mode: "query",
            host: "",
            port: 1433,
            database: "",
            username: "",
            password: "",
            useSsl: false,
            sql: "",
            parameters: [],
            timeoutSeconds: 30
        };
    }

    if (type === "trigger.schedule") {
        return {
            scheduleType: "interval",
            intervalSeconds: 60,
            cronExpression: "0 9 * * 1-5",
            timeZone: "Asia/Shanghai"
        };
    }

    if (type === "utility.current-time") {
        return {
            mode: "local",
            timeZone: "",
            format: "yyyy-MM-dd HH:mm:ss zzz"
        };
    }

    return {};
}

function startDraggingNode(event, node) {
    if (event.target.classList.contains("port")) return;

    event.preventDefault();
    const point = toCanvasPoint(event.clientX, event.clientY);
    state.drag = {
        nodeId: node.id,
        offsetX: point.x - node.position.x,
        offsetY: point.y - node.position.y
    };
    canvasViewport.setPointerCapture?.(event.pointerId);
    selectNode(node.id);
}

function dragSelectedNode(event) {
    if (!state.drag) return;

    const node = findNode(state.drag.nodeId);
    if (!node) return;

    const point = toCanvasPoint(event.clientX, event.clientY);
    node.position.x = snap(point.x - state.drag.offsetX);
    node.position.y = snap(point.y - state.drag.offsetY);
    renderNodes();
    renderEdges();
}

function stopDraggingNode(event) {
    if (state.drag) {
        try {
            canvasViewport.releasePointerCapture?.(event?.pointerId);
        } catch {
            // Pointer capture may already be released by the browser.
        }
    }
    state.drag = null;
}

function selectNodeFromCanvasClick(event) {
    if (event.target.classList.contains("port")) return;
    const nodeElement = event.target.closest?.(".workflow-node");
    if (!nodeElement?.dataset.nodeId) return;
    selectNode(nodeElement.dataset.nodeId);
}

function connectToNode(targetNodeId) {
    if (!persistCurrentSelectionBeforeChange()) return;
    const sourceNodeId = state.connectingFrom?.nodeId;
    const sourcePort = state.connectingFrom?.sourcePort ?? "main";
    if (!sourceNodeId || sourceNodeId === targetNodeId) {
        clearConnecting();
        return;
    }

    const exists = state.workflow.edges.some(edge =>
        edge.sourceNodeId === sourceNodeId
        && edge.sourcePort === sourcePort
        && edge.targetNodeId === targetNodeId);

    if (!exists) {
        state.workflow.edges.push({ sourceNodeId, sourcePort, targetNodeId });
    }

    clearConnecting();
    selectEdge(state.workflow.edges.length - 1);
    setStatus("连线已创建");
}

function clearConnecting() {
    state.connectingFrom = null;
    document.body.classList.remove("connecting");
}

function selectNode(nodeId) {
    if (state.selected?.kind === "node" && state.selected.id === nodeId) return;
    if (!persistCurrentSelectionBeforeChange()) return;
    state.selected = { kind: "node", id: nodeId };
    renderAll();
}

function selectEdge(index) {
    if (state.selected?.kind === "edge" && state.selected.index === index) return;
    if (!persistCurrentSelectionBeforeChange()) return;
    state.selected = { kind: "edge", index };
    renderAll();
}

function isSelectedNode(nodeId) {
    return state.selected?.kind === "node" && state.selected.id === nodeId;
}

function applyCurrentSelectionSettings(options = {}) {
    const { render = false, notify = false } = options;
    if (state.selected?.kind === "node") {
        applySelectedNodeSettings();
    } else if (state.selected?.kind === "edge") {
        applySelectedEdgeSettings();
    } else {
        return;
    }

    if (render) renderAll();
    if (notify) setStatus("配置已保存到当前工作流");
}

function persistCurrentSelectionBeforeChange() {
    if (!state.selected) return true;
    try {
        applyCurrentSelectionSettings();
        return true;
    } catch (error) {
        setStatus(`请先修正当前配置：${error.message}`);
        return false;
    }
}

function applySelectedNodeSettings() {
    const node = state.selected?.kind === "node" ? findNode(state.selected.id) : null;
    if (!node) return;

    if (node.type === "ai.agent") {
        applyAgentSettings(node);
    } else if (node.type === "ai.llm-chat") {
        applyLlmSettings(node);
    } else if (node.type === "ai.knowledge-retrieval") {
        applyKnowledgeRetrievalSettings(node);
    } else if (node.type === "ai.question-classifier") {
        applyClassifierSettings(node);
    } else if (node.type === "flow.for-each") {
        applyForEachSettings(node);
    } else if (node.type === "data.template") {
        applyOutputSettings(node);
    } else if (node.type === "integration.http-request") {
        applyHttpSettings(node);
    } else if (node.type === "integration.mail-read") {
        applyMailReadSettings(node);
    } else if (node.type === "integration.web-crawler") {
        applyWebCrawlerSettings(node);
    } else if (node.type === "integration.wecom-message") {
        applyWeComSettings(node);
    } else if (node.type === "integration.database") {
        applyDatabaseSettings(node);
    } else if (node.type === "trigger.schedule") {
        applyScheduleSettings(node);
    } else if (node.type === "utility.current-time") {
        applyCurrentTimeSettings(node);
    } else if (node.type === "trigger.manual") {
        applyManualSettings(node);
    } else {
        node.settings = JSON.parse(nodeSettingsInput.value || "{}");
    }

    const description = nodeNameInput.value.trim();
    if (description) {
        node.settings.description = description;
    } else {
        delete node.settings.description;
    }
}

function applyScheduleSettings(node) {
    const scheduleType = scheduleTypeSelect.value;
    const cronExpression = scheduleCronInput.value.trim();
    if (scheduleType === "cron" && cronExpression.split(/\s+/).length !== 5) {
        throw new Error("Cron 表达式必须使用 5 段格式");
    }

    node.settings = {
        scheduleType,
        intervalSeconds: Math.min(86400, Math.max(1, Number.parseInt(scheduleIntervalInput.value, 10) || 60)),
        cronExpression: cronExpression || "0 9 * * 1-5",
        timeZone: scheduleTimeZoneSelect.value
    };
}

function applyCurrentTimeSettings(node) {
    const mode = currentTimeModeSelect.value || "local";
    const timeZone = currentTimeTimeZoneInput.value.trim();
    const format = currentTimeFormatInput.value.trim();
    if (mode === "custom" && !timeZone) {
        throw new Error("指定时区时，时区 ID 不能为空");
    }
    if (!format) {
        throw new Error("输出格式不能为空");
    }

    node.settings = {
        mode,
        timeZone,
        format
    };
}

function applyForEachSettings(node) {
    const itemsVariable = forEachItemsVariableInput.value.trim();
    if (!itemsVariable) {
        throw new Error("数组变量不能为空");
    }

    node.settings = {
        itemsVariable,
        itemVariableName: forEachItemVariableInput.value.trim() || "currentItem",
        indexVariableName: forEachIndexVariableInput.value.trim() || "currentIndex"
    };
}

function applyWeComSettings(node) {
    const webhookUrl = wecomWebhookUrlInput.value.trim();
    if (!webhookUrl) throw new Error("机器人 Webhook 地址不能为空");

    node.settings = {
        webhookUrl,
        content: wecomContentInput.value || "{{question}}",
        mentionedList: wecomMentionedListInput.value.trim(),
        mentionedMobileList: wecomMentionedMobileListInput.value.trim()
    };
}

function applyDatabaseSettings(node) {
    const host = databaseHostInput.value.trim();
    const database = databaseNameInput.value.trim();
    const username = databaseUsernameInput.value.trim();
    const sql = databaseSqlInput.value.trim();
    if (!host) throw new Error("数据库地址不能为空");
    if (!database) throw new Error("数据库名称不能为空");
    if (!username) throw new Error("用户名不能为空");
    if (!sql) throw new Error("SQL 不能为空");

    node.settings = {
        provider: databaseProviderSelect.value,
        mode: databaseModeSelect.value,
        host,
        port: Math.min(65535, Math.max(1, Number.parseInt(databasePortInput.value, 10) || getDatabaseDefaultPort(databaseProviderSelect.value))),
        database,
        username,
        password: databasePasswordInput.value,
        useSsl: databaseSslInput.checked,
        sql,
        parameters: collectDatabaseParameters(),
        timeoutSeconds: Math.min(300, Math.max(1, Number.parseInt(databaseTimeoutInput.value, 10) || 30))
    };
}

function applyHttpSettings(node) {
    const timeoutSeconds = Math.min(300, Math.max(1, Number.parseInt(httpTimeoutInput.value, 10) || 30));
    const retryCount = Math.min(5, Math.max(0, Number.parseInt(httpRetryInput.value, 10) || 0));
    const url = httpUrlInput.value.trim();
    if (!url) throw new Error("请求地址不能为空");

    node.settings = {
        method: httpMethodSelect.value,
        url,
        queryParameters: collectHttpQueryParameters(),
        headers: collectHttpHeaders(),
        body: httpBodyInput.value,
        timeoutSeconds,
        retryCount
    };
}

function applyMailReadSettings(node) {
    const host = mailHostInput.value.trim();
    const username = mailUsernameInput.value.trim();
    if (!host) throw new Error("邮件服务器地址不能为空");
    if (!username) throw new Error("邮箱账号不能为空");

    node.settings = {
        protocol: mailProtocolSelect.value,
        host,
        port: Math.min(65535, Math.max(1, Number.parseInt(mailPortInput.value, 10) || getMailDefaultPort(mailProtocolSelect.value, mailSecuritySelect.value))),
        security: mailSecuritySelect.value,
        username,
        password: mailPasswordInput.value,
        folder: mailFolderInput.value.trim() || "INBOX",
        unreadOnly: mailProtocolSelect.value === "imap" && mailUnreadOnlyInput.checked,
        ignoreKnownMessages: mailIgnoreKnownInput.checked,
        markAsRead: mailProtocolSelect.value === "imap" && mailMarkAsReadInput.checked,
        popDeleteAfterRead: mailProtocolSelect.value === "pop3" && mailPopDeleteInput.checked,
        maxMessages: Math.min(100, Math.max(1, Number.parseInt(mailMaxMessagesInput.value, 10) || 10)),
        includeAttachments: mailIncludeAttachmentsInput.checked,
        maxAttachmentBytes: Math.min(26214400, Math.max(1024, Number.parseInt(mailMaxAttachmentBytesInput.value, 10) || 5242880)),
        timeoutSeconds: Math.min(300, Math.max(5, Number.parseInt(mailTimeoutInput.value, 10) || 60))
    };
}

function applyAgentSettings(node) {
    if (!supportsAgentSettingsUi()) {
        node.settings = JSON.parse(nodeSettingsInput.value || "{}");
        return;
    }

    const providerConfigId = agentProviderConfigSelect.value;
    const message = agentMessageInput.value.trim() || "{{question}}";

    node.settings = {
        providerConfigId,
        message,
        instruction: agentInstructionInput.value.trim(),
        maxIterations: Math.min(12, Math.max(1, Number.parseInt(agentMaxIterationsInput.value, 10) || 5)),
        tools: collectAgentTools(),
        timeoutSeconds: Math.min(600, Math.max(1, Number.parseInt(agentTimeoutInput.value, 10) || 180))
    };
}

function applyKnowledgeRetrievalSettings(node) {
    const query = knowledgeRetrievalQueryInput.value.trim();
    if (!query) throw new Error("查询文本不能为空");
    if (state.knowledgeRetrievalBaseIds.length === 0) {
        throw new Error("请至少添加一个知识库");
    }

    node.settings = {
        query,
        knowledgeBaseIds: [...state.knowledgeRetrievalBaseIds],
        rerankModel: knowledgeRetrievalRerankSelect.value,
        topK: Math.min(12, Math.max(1, Number.parseInt(knowledgeRetrievalTopKInput.value, 10) || 4)),
        scoreThresholdEnabled: knowledgeRetrievalThresholdEnabledInput.checked,
        scoreThreshold: Math.min(
            1,
            Math.max(0, Number.parseFloat(knowledgeRetrievalThresholdInput.value) || 0))
    };
}

function applyWebCrawlerSettings(node) {
    const url = webCrawlerUrlInput.value.trim();
    if (!url) throw new Error("网页链接不能为空");

    node.settings = {
        url,
        userAgent: webCrawlerUserAgentInput.value.trim()
            || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.1000.0 Safari/537.36",
        generateSummary: webCrawlerGenerateSummaryInput.checked,
        timeoutSeconds: Math.min(300, Math.max(1, Number.parseInt(webCrawlerTimeoutInput.value, 10) || 30)),
        retryCount: Math.min(5, Math.max(0, Number.parseInt(webCrawlerRetryInput.value, 10) || 0)),
        maxContentLength: Math.min(
            500000,
            Math.max(1000, Number.parseInt(webCrawlerMaxLengthInput.value, 10) || 100000))
    };
}

function applyOutputSettings(node) {
    const variable = outputVariableSelect.value;
    const outputFormat = outputFormatSelect.value === "table" ? "table" : "json";
    const tableColumns = collectOutputTableColumns();
    if (outputFormat === "table") {
        if (tableColumns.length === 0) throw new Error("表格输出至少需要一列");
        if (tableColumns.some(column => !column.title || !column.path)) {
            throw new Error("请填写完整的表格列标题和 JSON 字段路径");
        }
    }

    state.outputTableColumns = tableColumns;
    node.settings = { variable, outputFormat };
    if (variable === "__custom__") {
        node.settings.customValue = outputCustomValueInput.value;
    }
    if (outputFormat === "table") {
        node.settings.tableColumns = tableColumns;
    }
}

function applyClassifierSettings(node) {
    collectClassifierClasses(node);
    const classes = node.settings.classes;
    if (classes.length < 2) throw new Error("问题分类器至少需要两个分类");
    if (classes.some(item => !item.id || !item.name)) throw new Error("分类 ID 和分类名称不能为空");
    if (new Set(classes.map(item => item.id.toLowerCase())).size !== classes.length) {
        throw new Error("分类 ID 不能重复");
    }

    node.settings = {
        providerConfigId: classifierProviderConfigSelect.value,
        input: classifierInput.value.trim() || "{{question}}",
        instruction: classifierInstruction.value.trim(),
        classes
    };

    const validPorts = new Set(classes.map(item => item.id));
    state.workflow.edges = state.workflow.edges.filter(edge =>
        edge.sourceNodeId !== node.id || validPorts.has(edge.sourcePort));
}

function applyLlmSettings(node) {
    const settings = node.settings ?? {};
    const { systemPrompt: _, prompt: __, messages: ___, ...otherSettings } = settings;
    const messages = [];
    const systemPrompt = llmSystemPromptInput.value.trim();
    const userPrompt = llmUserPromptInput.value.trim();

    if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({ role: "user", content: userPrompt || "{{question}}" });

    node.settings = {
        ...otherSettings,
        providerConfigId: llmProviderConfigSelect.value,
        messages,
        files: settings.files ?? [],
        filesInputKey: settings.filesInputKey || "files",
        imageDetail: settings.imageDetail || "high",
        stream: settings.stream ?? true,
        timeoutSeconds: Math.min(600, Math.max(1, Number.parseInt(llmTimeoutInput.value, 10) || 120))
    };
}

function applyEdgeSettings() {
    try {
        applySelectedEdgeSettings();
        renderAll();
        setStatus("连线配置已应用");
    } catch (error) {
        setStatus(`连线配置失败：${error.message}`);
    }
}

function applySelectedEdgeSettings() {
    const edge = state.selected?.kind === "edge" ? state.workflow.edges[state.selected.index] : null;
    if (!edge) return;

    const sourceNode = findNode(edge.sourceNodeId);
    edge.sourcePort = sourceNode?.type === "ai.question-classifier"
        ? normalizeEdgeSourcePort(edgePortInput.dataset.sourcePortValue)
        : normalizeEdgeSourcePort(edgePortInput.value);
}

function normalizeEdgeSourcePort(value) {
    return String(value || "").trim() || "main";
}

function deleteSelected() {
    if (!state.selected) return;

    if (state.selected.kind === "node") {
        const nodeId = state.selected.id;
        state.workflow.nodes = state.workflow.nodes.filter(node => node.id !== nodeId);
        state.workflow.edges = state.workflow.edges.filter(edge =>
            edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId);
        setStatus("节点已删除");
    }

    if (state.selected.kind === "edge") {
        state.workflow.edges.splice(state.selected.index, 1);
        setStatus("连线已删除");
    }

    state.selected = null;
    renderAll();
}

function openCanvasContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();

    const nodeElement = event.target.closest?.(".workflow-node");
    if (nodeElement?.dataset.nodeId && !isSelectedNode(nodeElement.dataset.nodeId)) {
        selectNode(nodeElement.dataset.nodeId);
    }

    contextDeleteButton.disabled = !state.selected;
    canvasContextMenu.hidden = false;
    const menuWidth = canvasContextMenu.offsetWidth;
    const menuHeight = canvasContextMenu.offsetHeight;
    canvasContextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - menuWidth - 8)}px`;
    canvasContextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - menuHeight - 8)}px`;
}

function hideCanvasContextMenu() {
    canvasContextMenu.hidden = true;
}

function openRunTest() {
    if (!state.workflow?.id) return;
    window.open(`/workflow-run/${encodeURIComponent(state.workflow.id)}`, "_blank", "noopener");
}

function openWorkflowRunner() {
    if (!state.workflow?.id) return;
    window.open(`/ai/${encodeURIComponent(state.workflow.id)}`, "_blank", "noopener");
}

async function saveAndRunWorkflow() {
    publishMenu.hidden = true;
    publishMenuButton.setAttribute("aria-expanded", "false");
    saveButton.setAttribute("aria-expanded", "false");
    if (await saveWorkflow()) {
        openWorkflowRunner();
    }
}

function updateSaveMenu() {
    const lastSavedText = document.getElementById("workflowLastSavedText");
    if (!lastSavedText) return;
    lastSavedText.textContent = state.workflow?.updatedAt
        ? formatRelativeTime(state.workflow.updatedAt)
        : "尚未保存";
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

function openSystemVariablesDialog() {
    const variables = collectWorkflowVariables(null);
    systemVariablesList.innerHTML = variables.length
        ? variables.map(variable => `
            <div class="system-variable-item">
                <code>{{${escapeHtml(variable.name)}}}</code>
                <p>${escapeHtml(variable.description || "可在后续节点中引用的工作流变量。")}</p>
                <span>${escapeHtml(variable.source || "系统")}</span>
            </div>
        `).join("")
        : '<div class="empty-state">暂无可用变量</div>';
    systemVariablesDialog.showModal();
}

async function saveWorkflow() {
    try {
        applyCurrentSelectionSettings();
        validateWorkflow();
        saveButton.disabled = true;
        setStatus("正在保存...");

        const response = await fetch(`/api/workflows/${encodeURIComponent(state.workflow.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(state.workflow)
        });

        if (!response.ok) throw new Error(await response.text());

        state.workflow = await response.json();
        normalizeWorkflow();
        renderAll();
        updateSaveMenu();
        setStatus("保存成功");
        return true;
    } catch (error) {
        setStatus(`保存失败：${error.message}`);
        return false;
    } finally {
        saveButton.disabled = false;
    }
}

function validateWorkflow() {
    const nodeIds = new Set(state.workflow.nodes.map(node => node.id));
    for (const edge of state.workflow.edges) {
        if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
            throw new Error("存在指向不存在节点的连线");
        }
    }
}

function fitCanvas() {
    const nodes = state.workflow?.nodes ?? [];
    if (nodes.length === 0) return;

    const minX = Math.min(...nodes.map(node => node.position.x));
    const minY = Math.min(...nodes.map(node => node.position.y));
    canvasViewport.scrollLeft = Math.max(0, minX - 120);
    canvasViewport.scrollTop = Math.max(0, minY - 120);
}

function buildPath(source, target, sourcePort) {
    const sourceElement = canvas.querySelector(`[data-node-id="${CSS.escape(source.id)}"]`);
    const targetElement = canvas.querySelector(`[data-node-id="${CSS.escape(target.id)}"]`);
    const sourcePortElement = sourceElement?.querySelector(`.port.output[data-port="${CSS.escape(sourcePort)}"]`)
        ?? sourceElement?.querySelector(".port.output");
    const targetPortElement = targetElement?.querySelector(".port.input");
    const sourcePoint = getPortCanvasPoint(sourcePortElement, {
        x: source.position.x + 190,
        y: source.position.y + 41
    });
    const targetPoint = getPortCanvasPoint(targetPortElement, {
        x: target.position.x,
        y: target.position.y + 41
    });
    const sourceX = sourcePoint.x;
    const sourceY = sourcePoint.y;
    const targetX = targetPoint.x;
    const targetY = targetPoint.y;
    const gap = Math.max(90, Math.abs(targetX - sourceX) / 2);

    return `M ${sourceX} ${sourceY} C ${sourceX + gap} ${sourceY}, ${targetX - gap} ${targetY}, ${targetX} ${targetY}`;
}

function getPortCanvasPoint(port, fallback) {
    if (!port) return fallback;

    const portRect = port.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
        x: (portRect.left + portRect.width / 2 - canvasRect.left) / state.canvasScale,
        y: (portRect.top + portRect.height / 2 - canvasRect.top) / state.canvasScale
    };
}

function isConnectingFrom(nodeId, sourcePort) {
    return state.connectingFrom?.nodeId === nodeId && state.connectingFrom?.sourcePort === sourcePort;
}

function getViewportTopCenterPoint() {
    const viewportRect = canvasViewport.getBoundingClientRect();
    return toCanvasPoint(
        viewportRect.left + viewportRect.width / 2,
        viewportRect.top + 100);
}

function toCanvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) / state.canvasScale,
        y: (clientY - rect.top) / state.canvasScale
    };
}

function createNodeId(type) {
    const prefix = type.split(".").at(-1).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    let index = state.workflow.nodes.length + 1;
    let id = `${prefix}-${index}`;

    while (findNode(id)) {
        index += 1;
        id = `${prefix}-${index}`;
    }

    return id;
}

function findNode(nodeId) {
    return state.workflow.nodes.find(node => node.id === nodeId);
}

function snap(value) {
    return Math.max(24, Math.round(value / 24) * 24);
}

function isTextFile(file) {
    return file.type.startsWith("text/")
        || file.type === "application/json"
        || /\.(txt|md|json|csv|log|xml|html|css|js|ts|cs)$/i.test(file.name);
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("读取文本文件失败"));
        reader.readAsText(file);
    });
}

function readFileAsBase64(file) {
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

function estimateFileSize(file) {
    if (file.text) return new Blob([file.text]).size;
    if (file.base64) return Math.floor(file.base64.length * 0.75);
    return 0;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clampInteger(value, fallback, minimum, maximum) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    const normalized = Number.isFinite(parsed) ? parsed : fallback;
    return Math.min(maximum, Math.max(minimum, normalized));
}

function setStatus(message) {
    if (statusText) {
        statusText.textContent = message;
    }

    if (designerToast && message) {
        window.clearTimeout(setStatus.toastTimer);
        designerToast.textContent = message;
        designerToast.hidden = false;
        designerToast.classList.add("show");
        setStatus.toastTimer = window.setTimeout(() => {
            designerToast.classList.remove("show");
            designerToast.hidden = true;
        }, 1800);
    }
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



