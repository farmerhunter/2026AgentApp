# Epic 协作与质量 Gate 规范

本文档适用于项目负责人指定由 David 端到端交付的复杂 Epic。它在 [Epic 设计文档规范](epic-design-guidelines.md) 与 [贡献规则](../CONTRIBUTING.md) 之上，增加独立 Architect Gate 和最终合并 Gate；不要求 David 安装或理解 Agent Foundry。

## 角色与授权

| 角色 | 承担者 | 职责 | 不承担的职责 |
| --- | --- | --- | --- |
| Human Product & Merge Authority | 项目负责人 | 决定产品范围、取舍、隐私、发布风险和 `main` 合并 | 不必亲自完成每个 Epic 的设计或实现 |
| Architect | 项目负责人指定的 Codex Sol 级别独立审查者 | 在实现前审查目标、核心不变量、module boundary、API/data contract、失败处理和验收策略 | 不实现 Epic；不代替项目负责人合并 `main` |
| Implementer / Epic Delivery Owner | David 及其使用的 Codex app、DeepSeek 或其他 agent | 对一个 Epic 的设计提案、实现、self-review、测试和 PR 提交承担端到端责任 | 不绕过 Architect Gate；不自行合并 `main` |
| Final Gate Reviewer | 项目负责人或指定的独立 Codex reviewer | 对照接受的设计审查最终 PR、验证证据与残余风险 | 不把作者 self-review 当成独立审查 |

这些是工作角色，不要求 David 使用 role thread。David 可以在同一个 delivery thread 中完成设计、实现、自检和测试；Architect 与 Final Gate Reviewer 必须使用独立上下文审查。

## 共享事实源与分支

GitHub 是共享事实源：

- Epic issue 保存范围、Design Proposal、Architect Gate、阻塞与未决问题。
- 需要独立设计文档时，按 `docs/v<major>/epics/e<epic-number>-<short-slug>.md` 创建，并从 issue 链接。
- 默认使用 `epic/<issue-number>-<short-slug>` 作为 Epic 工作分支，并提交一个最终 PR 到 `main`。
- PR 保存实际改动、验证证据、Final Gate 结论和 follow-up。

单人 Epic 不预先拆 child branch 或 child PR。只有确有多人并行且边界独立时，才从 Epic branch 建子分支并合回 Epic branch。

## 生命周期

```text
Epic issue
  -> Design Proposal
  -> Architect Gate
  -> implementation + self-review + test
  -> Epic PR
  -> Final Gate
  -> Human merge decision
```

### 1. Design Proposal 与 Architect Gate

Implementer 先在 Epic issue 发布 Design Proposal，并说明是否需要独立 Epic 设计文档；若需要，提案应链接该文档。提案至少包含：

1. 目标和非目标。
2. 拟触及的模块、目录和兼容性影响。
3. API、数据模型、JSON contract、状态或配置变化。
4. 主流程、失败处理和降级行为。
5. 验收标准、自动测试和手工 walkthrough。
6. 需要 Architect 或项目负责人决定的问题。

发布后停止，等待 Architect 结论。正式实现不得在 `accepted` 前开始；只读调研或极小、可丢弃实验是唯一例外，必须在提案中说明。

Architect 的结论只能是 `changes required`、`accepted` 或 `hold`，并说明理由、可开始实现的范围和残余风险。`accepted` 是实施授权，不是合并授权。

### 2. 实现、自检、测试与 PR

Architect 接受后，Implementer 在同一个 delivery thread 中完成实现、self-review 和测试。self-review 是生产者自检，不是独立 review。

提交最终 PR 前，Implementer 必须：

- 说明实现与已接受设计的偏离；必要偏离先回到 issue 请求决定。
- 运行与 acceptance criteria 对应的测试，并提供命令和结果。
- 对用户可见功能提供可复现的手工 walkthrough。
- 记录未覆盖项、已知限制与后续问题。
- 遵守 `CONTRIBUTING.md` 的提交、CHANGELOG、隐私和 Git 上传规则。

不得因为 agent 可以一次性生成代码，就跳过 Design Proposal 或将“代码完成”表述为“Epic 已被接收”。

### 3. Final Gate 与合并

Final Gate Reviewer 用独立上下文审查 issue、接受的设计、PR diff 和验证证据，不重新发明架构。结论只能是：

- `changes required`：列出阻塞合并的具体问题；
- `accepted with follow-ups`：可合并，并明确非阻塞 follow-up；
- `recommend merge`：验证足以支持合并建议。

最终 `main` 合并只由 Human Product & Merge Authority 决定。

## 给 David agent 的最小启动指令

规范替代重复发送长流程 prompt，但不替代具体任务指派。David 每次只需提供 Epic issue 编号或链接，并发送：

```text
你负责 Epic #<number>。先阅读 docs/epic-collaboration-protocol.md，严格按其中 Implementer / Epic Delivery Owner 的流程执行；第一项交付是 issue 中的 Design Proposal，发布后停止并等待 Architect Gate。
```

agent 必须从 issue、关联设计文档、contract 和当前代码补全上下文；不得自行选择或领取另一个 Epic。

## 适用边界

本规范只用于项目负责人指定的复杂 Epic，不为局部 bug 修复、文案或样式调整、低风险单模块重构增加审批。普通工作继续遵守 `CONTRIBUTING.md` 与 issue/PR 流程。
