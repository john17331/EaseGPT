# 变更日志

本文件记录 EaseGPT 各版本的重要变更。版本格式遵循语义化版本规范。

## [Unreleased]

### Added

- Apache License 2.0 开源许可及社区治理文件。
- EaseGPT 名称和 Logo 使用规则。
- 模块化依赖注册、统一 SSE 基础设施和架构说明。

### Changed

- 工作流节点和 LLM Provider 改为依赖注入扩展。
- 外部 HTTP 请求统一交由 `IHttpClientFactory` 管理。
- 知识库配置统一使用 Options 模式。
- API 请求契约从控制器实现中分离。

### Removed

- 未使用的旧工作流运行页面、脚本和静态素材。
- 临时诊断代码对主项目编译的污染。
- Agent Designer 中被覆盖的重复函数。

### Security

- 运行数据库、上传文件、向量数据和本地配置不再进入默认发布产物。
- 覆盖 JiebaNet.Segmenter 传递引入的易受攻击 Newtonsoft.Json 版本。
