# Hermes 运行与 Skill 设计

**状态：Current design / 待 E5 验证。** 本文单独说明 Hermes 在 V2 中为什么存在、如何接入，以及如何高效迭代 Skill。

## 1. Hermes 在系统里的意义

Hermes 不是 DeepSeek 的别名，也不只是一次 `prompt -> model` 包装。它在 V2 中承载三类长期有价值的东西：

- **Skills**：把错题分析、教材知识整理、周报生成的方法固化成可版本化能力。
- **受控上下文**：明确这次允许使用哪些题目、知识节点和已接受记忆。
- **运行边界**：统一调用模型、工具权限、输出 contract 和诊断信息。

DeepSeek 只是 Hermes 当前已经配置好的推理 Provider。应用只认识 Hermes 任务和领域 JSON，不认识 DeepSeek 请求格式。

V2 不强行使用 Hermes ambient memory 来证明“智能”。学生记忆是产品数据，必须可看、可接受/拒绝、可追溯，所以 SQLite 才是权威。

## 2. 两个 profile

### `studyv2-lab`

- 给开发者在 VPS 的 TUI 中人工试验。
- 可以观察输入、输出和 Skill 行为，快速修改并重复运行。
- 允许实验性上下文，但不得连接生产数据库或真实发布目录。

### `studyv2-runtime`

- 给应用通过非交互 CLI 调用。
- 每个 job 使用新会话，只接收应用显式传入的数据。
- 关闭 ambient memory，关闭与任务无关的工具。
- 只加载仓库中已提交、通过最小回放验证的 Skill。

两个 profile 共享仓库内 `.hermes/skills/` 的 Skill 源码，但配置、会话和运行数据彼此隔离。

VPS 上现有名为 `Hermes` 的 tmux session 可以继续作为人工进入 TUI 的方便入口，但它不是产品运行依赖；session 重启或不存在不应影响 `studyv2-runtime` CLI job。

## 3. 应用接入：HermesBridge

```text
API serial job executor
  -> HermesBridge
       -> spawn Hermes CLI with studyv2-runtime
       -> JSON request on stdin
       <- JSON result on stdout
       <- diagnostics on stderr
  -> contract + semantic validation
  -> one SQLite transaction
```

`HermesBridge` 只做五件事：

1. 选择 profile 和固定 Skill；
2. 把 job 输入序列化为 JSON；
3. 启动本地 CLI 子进程并设置超时；
4. 分开读取 stdout/stderr，检查退出码并解析唯一 JSON 结果；
5. 返回标准成功或失败，不直接写领域数据。

禁止项：

- 应用直接调用 DeepSeek API；
- 应用向长期运行的 tmux/TUI `send-keys`；
- 从聊天文本中猜 JSON；
- 把 stderr、思考过程或未校验模型输出写入业务表；
- 把 Hermes 会话记忆当作学生学习记忆。

## 4. 三个粗粒度 Skill

### `textbook-knowledge-map`

离线使用：辅助把教材 PDF/文本整理为章节和知识节点 JSON。允许人工检查和修订，产物提交仓库。它不是线上 job。

### `confirmed-mistake-analysis`

线上使用：输入已由学生确认的错题、OCR 题干/作答、相关知识节点和已接受记忆；输出 findings、memory candidates 和 actions。不得自行决定哪题做错。

### `weekly-learning-report`

线上使用：输入本自然周 findings、actions、记忆决定和必要知识节点；输出简短、有代表性的结构化周报。没有本周数据时不调用 Hermes。

V2 先保持这三个 Skill 粗粒度清晰，不拆成大量微型 Skill 或通用 Agent 工作流。

## 5. 高效迭代方式

Skill 的质量一定需要多轮试验，开发流程应支持快迭代：

1. 在 `studyv2-lab` TUI 用 2–3 个脱敏小样例直接试。
2. 把代表性输入输出加入轻量 replay 样例。
3. 用与产品相同的非交互 CLI 跑一遍，防止“TUI 能用、应用不能用”。
4. 校验 JSON contract 和少量语义规则。
5. 提交 Skill，记录 `skill_version` 或 content hash；`studyv2-runtime` 只使用这份已知版本。

实验阶段修改 Skill 不要求每次先建 issue 或 commit；一旦进入产品 runtime 或用于锁定展示结果，就必须提交并记录版本。V2 不建设大型 eval 平台、A/B 系统或自动进化 Skill。

## 6. 上下文与记忆

每次分析由应用显式传入：

- 当前确认错题及 OCR 结果；
- 相关教材知识节点；
- 最多必要的已接受学生记忆；
- contract、语言和输出限制。

Hermes 返回的 memory candidate 默认 `pending`。用户接受后才成为 SQLite 中可复用的记忆；拒绝后不再使用。V2 不做编辑、合并、去重、自动 consolidation 或长期画像推断。

## 7. 本地、VPS 开发与部署

- 本地：开发 API、SQLite、校验器、fixture/replay 和 HermesBridge 的进程边界。
- VPS 开发区：用独立目录、独立数据库和 `studyv2-lab/runtime` 做真实 Hermes/DeepSeek 验证与 Skill 迭代。
- VPS 生产区：E6 再由 systemd/Nginx 启用固定 runtime 配置，不与开发数据库、tmux 会话或实验 Skill 混用。

因此 E5 负责“能力能真实工作”，E6 负责“这份已经验证的能力以可恢复方式在线运行”。

## 8. 最小验证

- 同一脱敏输入在 TUI 和非交互 CLI 下产生 contract 合法结果。
- 无效 JSON、CLI 非零退出、超时和 Provider 失败都转为 `failed`，数据库无部分领域写入。
- 第二批错题只使用 SQLite 中已接受的记忆，不受之前 TUI/CLI 会话内容影响。
- 周报能表达一次重复错误和一次改善，且展示内容保持简洁。
