# 项目文档

这里是学途智伴工程文档的唯一入口。文档从 V2 开始采用轻量风格：只保存会影响后续开发的产品边界、系统契约、架构决策和运行要求；普通实现细节留在代码、测试、GitHub Issue 和 PR 中。

## 当前阅读顺序

1. [给 David 的 V2 一页开发说明](v2/development-guide.md)：最快理解 V2 要做什么、先后顺序和 MVP 门槛。
2. [路线图](roadmap.md)：了解版本、E1–E6 和当前交付方向。
3. [V2 架构](v2/architecture.md)：了解双线数据流、模块职责和失败边界。
4. [E5 核心能力设计：从错题分析到学习周报](v2/epics/e5-hermes-learning-analysis.md)：面向 David 和评委，解释两个关键 Skill 的价值、策略、记忆作用和设计取舍。
5. [Hermes 运行与 Skill 设计](v2/hermes-runtime-and-skills.md)：了解 Hermes/DeepSeek 边界和 Skill 迭代方法。
6. [V2 实施计划](v2/implementation-plan.md)：了解 Epic 依赖和终评 R1 约束。
7. [架构决策记录](decisions/architecture-decisions.md)：了解需要长期保持的技术选择。
8. [Epic 设计文档规范](epic-design-guidelines.md)：Epic 启动后判断是否需要独立设计文档。
9. [Epic 自主交付与质量复核规范](epic-collaboration-protocol.md)：共同维护者端到端设计、实现、验证、合并、部署和收尾的轻量流程。

## 版本文档

- [V1：静态全链路演示版](v1/README.md)——已完成。保留 V1 时代的产品、系统、Hermes 和终评材料，作为历史基线。
- [V2：VPS 双线能力展示版](v2/README.md)——当前开发方向。真实主线与静态兜底隔离运行。
- [V3：多用户真实场景版](v3/README.md)——未来方向，并明确记录 V2 裁剪的能力。

## 文档状态约定

- **Current**：当前开发必须遵守。
- **Planned**：已确定方向，但尚未通过实现验证。
- **Historical**：用于理解 V1 或历史决策，不是当前实现依据。
- **Superseded**：已被其他文档替代，必须链接到替代文档。

V1 时代文档不逐份重写；其目录位置和 V1 入口负责说明历史属性。V2 及以后如与历史材料冲突，以当前版本文档和最新 ADR 为准。

## 什么时候更新文档

发生以下变化时更新相应文档：

- 产品能力边界或主要用户流程变化；
- Hermes 领域语义、模块职责或 Provider 边界变化；
- API、数据 contract、存储、隐私或权限边界变化；
- 部署、恢复、数据迁移或重大失败处理变化；
- 做出会约束未来实现的不可逆或高成本决定。

当一个 Epic 涉及跨模块边界、持久化、migration、API/data contract、重大失败恢复、隐私安全或多人/多 Agent 交接时，可以按 [Epic 设计文档规范](epic-design-guidelines.md)建立独立设计文档。

普通重构、小型 UI 调整、局部 bug 修复和临时实现步骤无需新增设计文档。
