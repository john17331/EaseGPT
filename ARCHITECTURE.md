# EaseGPT 架构说明

EaseGPT 采用模块化单体架构。部署保持简单，但代码按业务边界组织，避免控制器、
存储和外部服务互相穿透。

## 模块边界

### Workflows

- `Domain`：工作流、节点、连线和执行记录。
- `Execution`：图执行、运行控制和流式事件。
- `Nodes`：节点扩展点及内置节点实现。
- `Scheduling`：定时触发后台服务。
- `Storage`：工作流和模型配置的 LiteDB 适配器。

新增节点应实现 `IWorkflowNode`，并在 `AddWorkflowEngine` 中注册。节点注册表只负责
按类型索引节点，不负责构造具体实现。

### Knowledge

- 文档解析、分段和关键词生成。
- LiteDB 元数据、文件存储和 LanceDB 向量存储。
- Embedding、Rerank、召回和回答服务。
- 后台摄取队列。

知识库配置统一通过 `IOptions<RagOptions>` 注入。外部模型请求统一使用
`IHttpClientFactory` 管理连接生命周期。

### ConversationAgents

- Agent 定义和执行记录。
- 知识库召回与 LLM 对话编排。
- 预览和正式运行共享同一服务逻辑。

### Controllers

控制器只处理 HTTP 协议、输入验证和应用服务调用。请求契约集中在
`Controllers/Contracts`，流式响应由统一的 SSE 基础设施输出。

### Infrastructure

- 静态页面路由。
- Server-Sent Events 输出协议。
- 后续跨模块基础设施应放在这里，不应包含业务规则。

## 依赖方向

```text
HTTP/UI -> Controllers -> Application services -> Domain abstractions
                                      |
                                      v
                         Storage / HTTP / Vector adapters
```

领域模型和接口不依赖控制器或前端。基础设施实现依赖领域抽象，并在组合根中注册。

## 运行数据

`Data` 和 `TmpDiagnostics` 是运行时目录，不参与源码编译或发布：

- `Data/easegpt.db`：LiteDB 数据库。
- `Data/knowledge-files`：知识库原始文件。
- `Data/lancedb`：向量数据。
- `TmpDiagnostics`：临时诊断输出。

发布包只携带非敏感的 `Data/model-metadata.json`。

## 兼容性原则

- 工作流节点类型字符串是持久化协议，不应随意修改。
- HTTP 路由、JSON 字段和 SSE 事件名称属于公开契约。
- 数据迁移应幂等，不能在每次启动时恢复用户已删除的数据。
- UI 修改工作流元数据时必须使用元数据接口，禁止用陈旧摘要覆盖完整节点定义。
