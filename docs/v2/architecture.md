# V2 系统架构

**状态：Planned。** 本文定义 V2 实现需要保持的稳定边界；具体模块是否已经完成，应以代码、验证结果和 GitHub 状态为准。

## 稳定目标

V2 要把学习证据可靠地转化为可解释、可确认、可持续积累的学习结果：

```text
evidence
  -> finding
  -> memory candidate
  -> short-term memory
  -> consolidation
  -> insight / long-term memory
  -> report / action
```

单次模型输出不能直接成为长期学习画像。finding 必须保留来源和置信度；memory candidate 必须经过人工确认或后续 consolidation。

## 目标分层

```text
Web UI
  -> REST API
  -> Application Service / Hermes Job Runner
  -> Task-specific Skill + Context Assembly
  -> LLM Provider Port
  -> DeepSeek 或其他 Provider Adapter
  -> Contract + Semantic Validation
  -> SQLite + Private File Storage
  -> Domain Result / Job Status
  -> Web UI
```

### Web UI

- 负责输入、展示、确认和重试交互。
- 只消费 API 返回的 job 状态和领域结果，不解析模型原始响应。
- 不保存模型 API Key，不直接调用模型 Provider。
- API 不可用时可以降级到 V1 静态样例，但降级数据不得伪装成真实写入结果。

### REST API 与持久化

- API 是 Web 与领域运行时之间的稳定边界。
- SQLite 保存结构化业务数据和 job metadata；原始文件保存在私有文件目录。
- 公开静态目录只保存脱敏 demo data，不保存真实学生材料。
- 存储实现未来可以替换，但 API 和领域 contract 不应随之重写。

### Hermes Runtime

Hermes 是领域智能运行时，不是另一个模型名称。它负责：

- 选择 `textbook_summary`、`learning_insight_update` 或 `weekly_report` 任务；
- 组装允许使用的证据、历史 finding 和已确认记忆；
- 维护学习语义、记忆升级规则和少量可执行行动；
- 管理 job 生命周期、结果校验和原子写入；
- 向 UI 返回稳定的领域结果与失败状态。

V2 使用确定性任务编排和有边界的 LLM 推理，不引入自由自主 Agent 循环、通用规划器或动态工具市场。

### LLM Provider

- Provider Port 只表达 Hermes 需要的推理能力。
- DeepSeek 是首个可选 Adapter，而不是领域架构中心。
- Provider 专有参数、鉴权和错误映射留在 Adapter 内。
- fixture 和 real Provider 必须产生相同 contract 的输出。

完整决策和替换测试见 [ADR-019](../decisions/architecture-decisions.md#adr-019hermes-是领域智能运行时llm-是可替换的推理-provider)。

## Job 与失败状态

标准生命周期至少包括：

```text
pending -> running -> completed
                   -> failed
                   -> timeout
```

Provider 超时、限流、鉴权失败、网络错误、无效 JSON、contract 不匹配和语义校验失败都必须映射为稳定原因。失败任务不得部分写入 finding、记忆或周报；重试必须可以复用原始输入或明确创建新任务。

## V2 主路径

第一条真实纵向闭环优先选择 `learning_insight_update`：

```text
已确认学习材料
  -> 创建 Hermes job
  -> 调用真实 Provider
  -> 校验 learning_findings contract
  -> 原子写入 finding / memory candidate / action candidate
  -> 用户确认或忽略待确定记忆
```

这条路径验证后，再扩展教材摘要和周报 consolidation。

## 非目标

- 多用户鉴权和家庭/学校角色模型；
- 云数据库和对象存储迁移；
- 自主长循环 Agent 或多 Agent 协作；
- 模型自动写入长期记忆；
- 为所有未来输入源预先建立通用框架。

这些能力属于 V3 或真实需求出现后的新决策。
