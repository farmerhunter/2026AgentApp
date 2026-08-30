# Epic 自主交付与质量复核规范

本文档适用于 David 或另一位共同维护者端到端交付复杂 Epic。它在 [Epic 设计文档规范](epic-design-guidelines.md) 与 [贡献规则](../CONTRIBUTING.md) 之上，提供轻量、可追踪的交付流程；不要求 David 安装或理解 Agent Foundry。

## 共同维护者与权限

项目负责人和 David 是权限平等的共同维护者。两人都可以独立完成：

- 产品和技术范围取舍；
- 设计、实现、测试和文档维护；
- branch、PR、merge、Issue/Project 状态和 release 管理；
- VPS、Hermes、Nginx/systemd、secret 注入和部署维护；
- 在证据齐全后关闭 Epic，并选择下一项工作。

Codex 或其他 reviewer 是质量支持者，不持有对 David 的授权或放行权。维护者可以主动请求独立架构 review、代码 review 或展示 walkthrough；review finding 应被认真处理或记录接受理由，但 review 本身不是开始、合并、部署或关闭的前置许可。

权限平等不取消工程安全责任。任何维护者执行涉及真实学生数据、secret、外部费用、账号权限、公开服务、数据迁移或难恢复操作时，都应先明确目标和影响，采用最小必要范围，在 Issue/PR 留下脱敏记录，并验证结果和恢复路径。密钥、私有图片和完整敏感响应仍不得进入 GitHub。

## 共享事实源与分支

GitHub 是共享事实源：

- Epic issue 保存范围、关键设计决定、实时状态、阻塞与未决问题。
- 需要独立设计文档时，按 `docs/v<major>/epics/e<epic-number>-<short-slug>.md` 创建，并从 issue 链接。
- 默认使用 `epic/<issue-number>-<short-slug>` 作为 Epic 工作分支，并提交一个最终 PR 到 `main`。
- PR 保存实际改动、验证证据、review 结论和 follow-up。

单人 Epic 不预先拆 child branch 或 child PR。只有确有多人并行且边界独立时，才从 Epic branch 建子分支并合回 Epic branch。

## 生命周期

```text
Epic issue
  -> bounded design / acceptance criteria
  -> implementation + self-review + test
  -> Epic PR
  -> optional independent review when useful
  -> maintainer merge + remote verification + Epic closeout
```

### 1. 设计与开始实现

负责维护者先确认 Epic issue 中的目标、非目标和完成标准，并判断是否需要独立 Epic 设计文档。复杂或高风险 Epic 的计划至少包含：

1. 目标和非目标。
2. 拟触及的模块、目录和兼容性影响。
3. API、数据模型、JSON contract、状态或配置变化。
4. 主流程、失败处理和降级行为。
5. 验收标准、自动测试和手工 walkthrough。
6. 当前未知项、外部依赖和需要协作讨论的问题。

维护者可以在设计足以支撑下一步时自主开始实现。架构 review 可在实现前或实现中按风险请求，用于发现边界和 contract 问题，不作为权限 Gate。

### 2. 实现、自检、测试与 PR

负责维护者在同一个 delivery thread 中完成实现、self-review 和测试，也可以按需邀请独立 reviewer。

提交最终 PR 前，负责维护者必须：

- 说明实现与已记录设计的偏离及理由；重要偏离先同步到 issue，保持事实源一致。
- 运行与 acceptance criteria 对应的测试，并提供命令和结果。
- 对用户可见功能提供可复现的手工 walkthrough。
- 记录未覆盖项、已知限制与后续问题。
- 遵守 `CONTRIBUTING.md` 的提交、CHANGELOG、隐私和 Git 上传规则。

不得因为 agent 可以一次性生成代码，就跳过必要的范围梳理，或将“代码完成”表述为“用户路径已经验证”。

### 3. Review、合并与收尾

需要独立 review 时，reviewer 对照 issue、设计、PR diff 和验证证据检查，不重新发明架构。建议使用清楚的结论；负责维护者据此修复问题，或在 Issue/PR 记录接受风险的理由：

- `changes requested`：列出会影响目标或验收的具体问题；
- `accepted with follow-ups`：当前可完成，并明确非阻塞 follow-up；
- `approved`：当前证据充分，并绑定审查过的完整 commit SHA。

无论是否请求独立 review，负责维护者都可以在完成 self-review 和验收证据后自主执行以下收尾：

1. 在合并前重新读取远端 PR，确认将要合并的 exact head；
2. 确认 PR mergeable/clean，要求的 checks 和验证通过，已知 blocker 已处理；
3. 按仓库允许的方式将 Epic PR 合并到 `main`；
4. 读取远端 `main`，确认合并结果真实存在；
5. 在 PR 和 Epic issue 记录 merge commit、能力摘要、验证结果、未完成范围和残余风险；
6. 同步需要维护的设计文档状态、Issue/Project 状态，并在完成证据齐全后关闭 Epic；
7. 向另一位共同维护者同步最终结果和建议的下一 Epic。

任何一步出现冲突、检查失败、证据不完整或范围意外变化，都应先解决并重新验证。force push、reset、删除数据或其他难恢复操作不是普通收尾步骤；确有必要时，执行维护者必须先解析精确目标、记录影响和恢复方式，再谨慎操作。

删除远端 Epic branch 不是完成 Epic 的必要条件；只有确认不再需要时才清理，不把清理动作混入功能验收。

## 给 David agent 的最小启动指令

规范替代重复发送长流程 prompt，但不替代具体任务指派。David 每次只需提供 Epic issue 编号或链接，并发送：

```text
你独立负责 Epic #<number> 的设计、实现、测试、PR、VPS 验证、合并和收尾。先阅读 issue、关联设计和 docs/epic-collaboration-protocol.md；持续在 issue/PR 留下进度与脱敏证据，遇到真正缺失的信息再提出问题。
```

agent 必须从 issue、关联设计文档、contract 和当前代码补全上下文。一个 Epic 完成后，David 可以根据 roadmap 和依赖关系独立选择下一项维护工作，并在对应 Issue 留下接手记录。

## 适用边界

本规范用于需要跨模块协调的复杂 Epic，不为局部 bug 修复、文案或样式调整、低风险单模块重构增加流程。普通工作继续遵守 `CONTRIBUTING.md` 与 issue/PR 流程。
