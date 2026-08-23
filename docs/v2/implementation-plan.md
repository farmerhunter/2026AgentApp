# V2 实施计划

**状态：Current / Living document。** 本文只规定纵向切片顺序和验收边界；负责人、实时状态和具体任务以 GitHub Project、Epic 和 Issue 为准。

## 实施原则

- 每个切片都要产生可运行、可验证的用户路径。
- 保持 `main` 尽量可运行；fixture 和静态降级在真实链路稳定前继续保留。
- 当前切片可以写具体实现计划，未来切片只保留目标，避免提前锁死文件结构。
- 达到规定复杂度的当前 Epic 可以维护一份独立设计文档，并从 Epic Issue 和 V2 入口链接；见 [Epic 设计文档规范](../epic-design-guidelines.md)。
- 只有出现可复现的复杂度时才引入新框架或新抽象。

## 切片 0：V2 基线

目标：确认 V1 代码和数据能够作为 V2 起点，而不是仅凭源码推断可运行。

验收：

- 依赖安装完成；
- demo data validation、Web build、fixture smoke 和 API/SQLite 初始化得到真实验证；
- 开发入口、环境变量和已知限制可被下一位开发者复现。

## 切片 1：持久化 API

目标：用 SQLite + REST API 保存并查询学习 session、finding、memory decision、note、weekly report 和 Hermes job 状态。

关键失败路径：无效输入、记录不存在、重复写入和数据库写入失败必须返回稳定错误，不能留下半完成数据。

验收：API contract 有自动验证，样例数据可导入，关键写入重启后仍存在。

## 切片 2：Web API 优先

目标：Web UI 使用 API 完成主要查询和写入；API 不可用时清楚显示降级或错误状态。

关键失败路径：静态 fallback 只能提供只读演示，不得让用户误以为真实修改已经保存。

验收：API、loading、empty、failed 和 static fallback 状态都能被人工走通或自动测试覆盖。

## 切片 3：真实 Hermes 纵向闭环

目标：先用一个真实 LLM Provider 跑通 `learning_insight_update`。

关键路径：

```text
确认材料 -> 创建 job -> Provider 推理 -> 校验 -> 原子写入 -> 人工确认待确定记忆
```

验收：fixture/real 可切换；模型错误不会污染数据；结果保留 source references、版本 metadata 和 trace id；Provider 可以通过 Adapter 替换。

## 切片 4：完整 V2 与部署

目标：补齐 `textbook_summary`、`weekly_report`、consolidation 和稳定 VPS 运行。

验收：从学习材料到周报的完整链路可重复运行；API 和 Web 可恢复；真实数据不暴露在公开静态目录；部署和回滚步骤得到验证。

## 需要重新讨论的触发条件

- 需要接触真实学生数据或改变隐私边界；
- 引入付费 Provider、云资源或新的账号权限；
- 需要破坏现有 API/data contract 或执行不可逆数据迁移；
- 固定 job 已无法表达真实必要流程，需要自主规划、动态工具或通用 Agent 框架。
