# V2：真实 AI 和 API 版

**状态：Current / 文档基线已初始化。**

V2 的目标是把 V1 的静态演示闭环变成可以真实生成、写入、查询和重复运行的单用户系统：

```text
真实学习材料
  -> 持久化 API
  -> Hermes task-specific job
  -> 可替换 LLM Provider
  -> contract 与语义校验
  -> finding / 待确定记忆 / 周报
  -> Web UI 查询、确认和降级
```

## 交付范围

- SQLite + REST API 保存学习数据和 Hermes job 状态。
- Web UI 默认使用 API，并在必要时保留静态数据降级。
- Hermes 使用真实 LLM 生成可追溯 finding、待确定记忆、行动建议和周报。
- fixture 与 real 模式共享 contract，用于离线开发、演示和回归。
- VPS 能稳定运行 API 和 Web，真实数据不进入公开静态目录。

具体 Epic 和实时状态见 [路线图](../roadmap.md) 与 GitHub Project。

## 当前文档

- [架构](architecture.md)：V2 的稳定边界、目标数据流和非目标。
- [实施计划](implementation-plan.md)：从 V1 基线推进到 V2 的纵向切片顺序。
- [Epic 设计文档规范](../epic-design-guidelines.md)：复杂 Epic 独立成文的判断、位置、状态和维护规则。
- [架构决策记录](../decisions/architecture-decisions.md)：长期有效的技术决策，尤其是 ADR-019 的 Hermes/LLM Provider 边界。
- [E1 设计文档](epics/e1-persistence-api.md)：E1 持久化 API 的边界、实现映射和验收标准。
- [`data/contracts/`](../../data/contracts/)：机器可校验的数据形状，优先级高于文档中的示例 JSON。

## 轻量文档规则

- 当前 Epic 达到跨模块、持久化、migration、contract、重大失败或多人/多 Agent 交接等复杂度时，可以在 `docs/v2/epics/` 建立独立设计文档；默认一份主文档，具体规则见 [Epic 设计文档规范](../epic-design-guidelines.md)。
- Epic 的实时状态和普通任务仍写在 Issue；设计文档保存稳定边界、关键取舍、失败处理和验收证据，不复制看板。
- 普通实现步骤、局部重构和低风险功能不要求独立设计文档。
- 先实现最小纵向闭环，再为已经出现的复杂度增加抽象；不为假设中的多用户或通用 Agent 提前设计。
- 代码和文档不一致时先确认实际运行行为，再更新过时的一方，不能默默保留冲突。

## 开发自主权

Milestone owner 可以自主选择实现方式、拆分临时任务、提交、合并和部署。只有真实学生数据或隐私、外部费用、账号权限以及不可逆迁移需要产品负责人确认。
