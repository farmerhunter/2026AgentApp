# 学途智伴路线图

> 本文是产品版本和顶层 Epic 的统一入口。实时状态、负责人和具体任务以 GitHub Project 与 Issue 为准。

## 1. 版本总览

| 版本 | Milestone | 状态 | 能力目标 |
|---|---|---|---|
| V1 | v1.0 Static Demo | 已完成 | 脱敏静态 JSON + Web UI，完整展示学习闭环 |
| V2 | v2.0 Real AI + API | 进行中 | 单 VPS 双线：冻结静态兜底 + 数学真实处理主线 |
| V3 | v3.0 Multi-user Production | 未启动 | 多用户、生产安全、云基础设施和 V2 延后能力 |

## 2. V2 的两条线

- `/demo`：V1 静态完整流程，只读、脱敏、无外部依赖。
- `/app`：真实图片上传、腾讯 OCR、人工错题确认、Hermes 分析/记忆/周报、API/SQLite 持久化。

两条线在数据源和写入逻辑上隔离。真实主线失败时可以展示静态线或已保存真实结果，但 `/app` 不静默 fallback 到 demo 数据。

## 3. V2 Epic

```text
E0 #85  已完成：V2 基线与协作启用
 └─ E1 #63  已完成：持久化学习数据 API
      ├─ E2 #68：双线入口与稳定真实工作台
      ├─ E3 #87：教材知识底图与扩展边界
      └─ E4 #88：练习/试卷图片导入与错题确认
             E3 + E4 ─> E5 #13：Hermes 分析、记忆与周报
      E2 + E3 + E4 + E5 ─> E6 #69：VPS 双线部署与端到端验收
```

### E0：V2 基线与协作启用（[#85](https://github.com/farmerhunter/2026AgentApp/issues/85)，Done）

验证 V1 Web、demo data、fixture job、SQLite/API 初始骨架和开发文档，为 V2 提供可复现起点。该 Epic 是历史基线，不重新打开。

### E1：持久化学习数据 API（[#63](https://github.com/farmerhunter/2026AgentApp/issues/63)，Done）

已实现 Session、Confirmation、Finding、Memory、Note、Report 和 Hermes job 的 SQLite/REST API 基础，并验证 contract、事务失败和跨重启持久化。后续 Epic 只做必要兼容扩展。

### E2：双线入口与稳定真实工作台（[#68](https://github.com/farmerhunter/2026AgentApp/issues/68)）

隔离 `/demo` 与 `/app`，尽早冻结真实主线四页 UI 骨架和主要状态。目标是 UI 先稳定，后续 OCR/Hermes 可在同一交互壳中接入。

### E3：教材知识底图与扩展边界（[#87](https://github.com/farmerhunter/2026AgentApp/issues/87)）

把人教版八年级下册数学教材线下处理为版本化、只读知识地图。V2 只做一科一本教材，但保留以后扩展的 subject/book/version 边界。

### E4：练习/试卷图片导入与错题确认（[#88](https://github.com/farmerhunter/2026AgentApp/issues/88)）

实现一张 JPG/PNG 的私有上传、腾讯 QuestionSplitOCR、题干/学生作答/bbox 保存与展示，以及用户勾选错题。V2 不自动判错。

### E5：Hermes 分析、记忆与周报（[#13](https://github.com/farmerhunter/2026AgentApp/issues/13)）

应用通过非交互 Hermes CLI 调用固定 Skill，生成并保存 findings/actions，提出待确认记忆，并手工生成本周周报。SQLite 是产品记忆权威，DeepSeek 只存在于 Hermes Provider 配置内。

### E6：VPS 双线部署与端到端验收（[#69](https://github.com/farmerhunter/2026AgentApp/issues/69)）

用 Nginx/systemd 在 VPS 激活双线路由、真实 API、私有文件和 Hermes runtime；至少两次跑通真实端到端流程，并验证失败、重启和隐私边界。

## 4. 终评交付

终评交付由独立 Epic [#86](https://github.com/farmerhunter/2026AgentApp/issues/86) 管理，不冒充产品能力，也不能等 E6 完成后才开始。

- PPT、live demo 脚本、易拉宝、演示视频、公开链接和声明并行准备。
- 所有材料使用同一个学生故事、同一组简化数据和一致截图。
- 可靠顺序：PPT -> `/demo` -> `/app` 已保存真实结果 -> 可选现场真实任务。
- 保留一段 60–90 秒真实端到端录屏作为外部服务不稳定时的证据。

## 5. V2 MVP 门槛

- `/demo` 在 API/OCR/Hermes 不可用时仍能独立演示。
- `/app` 真实完成一次上传、OCR、错题确认、Hermes 分析和持久化。
- 至少一份真实生成并保存的周报可稳定打开和浏览器打印。
- 外部服务失败不产生半份领域结果；密钥和真实学生材料不公开。
- 展示数据尽量简单：约 6 题、2 个知识区域、一次重复错误、一次改善、最多 2 条已接受记忆。

## 6. 项目管理原则

- 本路线图只维护顶层 Epic；E2–E6 的内部 issue 在各 Epic 启动设计时再拆分。
- E1 的已完成实现和证据保留，不因 V2 重规划而重做。
- R1 终评风险约束叠加在 E1–E6 上，不替换原有架构和 Epic 粒度。
- GitHub 对齐使用现有 Milestone、Status、Priority、Size 和标签；不为文档概念凭空增加 Project 字段。

## 7. 设计入口与 V3

- [给 David 的一页开发说明](v2/development-guide.md)
- [V2 系统架构](v2/architecture.md)
- [V2 E1–E6 实施计划](v2/implementation-plan.md)
- [Hermes 运行与 Skill 设计](v2/hermes-runtime-and-skills.md)
- [V3 延后能力清单](v3/deferred-capabilities.md)

V3 只在 V2 真实闭环稳定并出现真实需求后启动。V2 已裁剪的在线 PDF、多学科、多用户、生产安全、复杂队列、云数据库、记忆治理增强和大型 Skill 评估都已明确记录，不在 V2 预建。
