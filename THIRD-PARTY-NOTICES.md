# 第三方软件声明

EaseGPT 使用了下列直接依赖。每个组件继续适用其自身许可证；本项目的
Apache License 2.0 不会替代这些许可证。

| 组件 | 版本 | 许可证 |
| --- | --- | --- |
| Cronos | 0.13.0 | MIT |
| JiebaNet.Segmenter | 1.0.6 | 待确认，NuGet 包未声明许可证 |
| LiteDB | 5.0.21 | MIT |
| LanceDB | 2.4.1 | Apache-2.0 |
| Microsoft.Data.SqlClient | 7.0.1 | MIT |
| MySqlConnector | 2.6.0 | MIT |
| Newtonsoft.Json | 13.0.4 | MIT |
| Npgsql | 10.0.3 | PostgreSQL |
| Swashbuckle.AspNetCore | 10.2.1 | MIT |

该清单根据项目直接引用包的 NuGet 元数据生成，不包含所有传递依赖。发布版本前
应通过依赖扫描重新生成完整清单，并保留各许可证要求的版权和归属信息。

## 发布阻塞项

`JiebaNet.Segmenter` 1.0.6 的 NuGet 元数据没有 `license` 或 `licenseUrl`
字段。在确认其源代码和词典数据允许再分发之前，不应发布包含该组件的正式版本。

`wwwroot/assets` 及其他目录中的图片、图标、字体和示例内容也必须确认来源。无法
确认来源或再分发授权的资源应替换或移除。
