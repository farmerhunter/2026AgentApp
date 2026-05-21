# 产品简报

## 名称

面向初中学习的 AI 学习智能体

## 目的

本项目演示一个主动式 AI 学习智能体 Hermes，帮助初中学生把日常学习证据转化为可追溯发现、学习记忆和下一步行动。第一版默认覆盖初中常见核心学科：语文、数学、英语。

## 用户

- 学生：按学科上传作业、试卷、笔记和问题。
- 家长或老师：查看跨学科总览、各学科薄弱点和建议的学习计划。
- 比赛评委：查看演示工作流、Web 前端和最终报告。

## 核心价值

Hermes 不是错题本，也不是聊天机器人，而是把日常学习证据转化为“可追溯发现、学习记忆和下一步行动”的智能体。

学习记忆重点保存可解释的问题模式。例如“遇到反比例函数图像题时规则迁移慢”比单纯记录“反比例函数薄弱”更有价值；但当证据只支持某个知识点不熟时，也可以把“某知识点不熟”作为一种简单问题模式记录下来。

## 核心能力

- 从文本、图片、PDF 或上传事件摄取数据
- 为课本、备注、作业、试卷、重点题和周报记录学科信息
- 基于 Hermes skill 生成 local findings、重点题记录、待确定记忆和行动候选
- 对多个 findings 进行阶段性 consolidation，形成周报中的 insights
- 生成少量、具体、适合中学生执行的后续行动
- 在 Web 前端中展示跨学科周报、重点题、学习发现、待确定记忆、学习建议和后续行动

## 大版本发布计划

Hermes 的工程阶段可以继续使用现有的 Phase / 阶段命名，但对外发布应收敛为 1.0、2.0、3.0 三个大版本。版本号表达产品能力边界，阶段号表达开发执行顺序。

### 1.0：静态全链路演示版

对应前面文档里的阶段一。目标是证明完整产品闭环，而不是证明真实 AI 和后端规模。

发布范围：

- Web UI 可以完整展示学习内容、上传材料、重点题确认、学习发现、待确定记忆、周报和行动建议。
- 数据源使用脱敏静态 JSON 和样例图片，前端通过 `src/web_ui/public/data/` 或 VPS `/data/` 读取。
- Hermes skill、prompt、contract 和 sample output 可审查，能够说明“学习证据 -> 局部发现 -> 学习记忆 -> 周报和行动”的逻辑。
- 支持单学生、语文/数学/英语三科演示，学科以筛选器和内容分区呈现。
- 允许使用 fixture job 状态模拟 `learning_insight_update` 和 `weekly_report` 已完成。

不纳入 1.0：

- 真实 LLM 在线调用。
- 用户鉴权、多学生隔离和并发编辑。
- 生产级数据库、对象存储、任务队列和监控。

验收标准：

- 前端构建和 demo data 校验通过。
- 静态 JSON 中无本地绝对路径、密钥或真实学生隐私。
- 评委可以从一个公开链接走完整演示路径。

### 2.0：真实 AI 和云端 API 版

2.0 以当前阶段 G 和后续阶段 F 为基础。阶段 G 先补齐 SQLite + REST API + 可写入数据，阶段 F 在同一 API 和数据库契约上接入真实 LLM。目标是从“能展示”升级为“能生成、能保存、能追踪”。

发布范围：

- Express REST API 成为前端主数据源，支持 sessions、questions、findings、memories、notes、reports 和 Hermes jobs。
- SQLite 保存结构化数据，本地 VPS 文件系统保存上传图片、OCR 结果和归档文件。
- `HERMES_JOB_MODE=fixture` 可用于演示和回归测试，`HERMES_JOB_MODE=real` 用于真实 LLM 生成。
- `learning_insight_update` 能调用 LLM，基于上传材料、人工确认和历史上下文生成 findings、memory candidates 和 action candidates。
- `weekly_report` 能基于真实 findings 和记忆生成跨学科周报。
- API 不可用时，前端继续降级到静态 JSON，避免开发和演示被后端状态阻断。

不纳入 2.0：

- 多租户账号体系。
- 大规模并发、复杂权限、云数据库高可用。
- 对象存储强制迁移；VPS 本地磁盘仍可作为 2.0 文件存储。

验收标准：

- `POST /api/hermes/jobs` 到结果查询的 job 链路可重复运行。
- 真实 LLM 输出通过 contract validation 后入库。
- 人工确认、记忆决策和备注刷新后不丢失。
- 可以通过环境变量切换 fixture / real，不改前端页面代码。

### 3.0：多用户真实场景版

3.0 面向真实使用，不再是单学生演示或单 VPS 轻量部署。目标是支持多用户、真实数据量、隐私保护和可运营维护。

发布范围：

- 引入账号、角色和权限：学生、家长、老师、管理员。
- 数据模型支持多学生、多班级或多家庭的数据隔离。
- 大文件迁移到私有 COS 或等价对象存储，数据库迁移到 PostgreSQL/MySQL。
- 后端 API 提供鉴权、分页、筛选、审计日志和签名 URL。
- Hermes jobs 迁移到后台 worker 或任务队列，支持失败重试、超时控制和运行日志。
- 建立数据备份、脱敏导出、成本监控和基础安全策略。

不纳入 3.0 的默认承诺：

- 取代教师诊断或自动给出高风险教育结论。
- 无人工确认地把单次模型判断写成长期学习标签。

验收标准：

- 多用户数据隔离通过测试。
- 真实上传数据不通过公开静态目录暴露。
- 数据库和对象存储可以备份、恢复和迁移。
- LLM 调用失败时不破坏已有用户数据，用户能看到可理解的任务状态。

### 版本与现有开发流程的关系

现有开发流程应继续保留：

```text
设计文档
  -> data contract
  -> sample data
  -> skill
  -> prompt
  -> job runner
  -> API trigger
  -> Web UI 状态和触发入口
  -> 验证和部署
```

版本计划只改变发布门槛，不改变开发顺序：

- 1.0 允许流程停在 sample data / fixture job / static JSON，但 contract 和 UI 必须完整。
- 2.0 要求同一 contract 通过 REST API 和 SQLite 持久化，并允许 `HERMES_JOB_MODE` 从 `fixture` 切到 `real`。
- 3.0 要求 API contract 尽量保持稳定，把存储 provider 从 `local` 切到 `cos`，把数据库从 SQLite 切到 PostgreSQL/MySQL，同时补齐鉴权和多用户隔离。

配置管理原则：

- 所有环境差异通过环境变量表达，不把路径、密钥、模型名或 provider 写死在业务代码中。
- 1.0 默认 `HERMES_DATA_SOURCE=static`，读取 `/data/`。
- 2.0 默认 `HERMES_DATA_SOURCE=api`，`HERMES_STORAGE_PROVIDER=local`，`HERMES_JOB_MODE=fixture|real`。
- 3.0 默认 `HERMES_DATA_SOURCE=api`，`HERMES_STORAGE_PROVIDER=cos`，数据库使用云端 PostgreSQL/MySQL。
- 前端 API 函数保持降级能力：API 可用时走 `/api/...`，不可用时回退到 `/data/...`。

## 第一版演示范围

第一版应重点展示主动分析、人工确认、可追溯总结和阶段性行动建议。长期跟踪应在 Web 前端中作为支撑证据呈现。

第一版多学科原则：

- 周报和计划采用跨学科总览，而不是每个学科拆成完全独立的周报。
- 所有学习材料必须带有学科字段。
- Web 顶层导航不按学科拆分，学科作为筛选器和内容分区出现在各视图中。

第一版不新增独立顶层 learning insight review 模块，但在上传材料子流程的完成页中展示 Hermes 分析状态。重点题确认保存后，前端触发或提示触发 `learning_insight_update`，通过轮询或手动刷新读取 job 状态；job 完成后在上传结束页展示 local findings、memory candidates 和 action candidates。

`memory candidate` 面向用户的中文建议使用“待确定记忆”。它表示 Hermes 认为可能值得保留的学习问题模式，但需要学生、家长或老师确认、忽略或调整优先级后，才进入更稳定的学习记忆。
