# 架构决策记录

本文档记录 Hermes 项目的关键设计决策。每条决策说明当前选择、原因和未来演进方向。

本文档跨版本维护，不属于 V1 历史目录。已有 ADR 保留当时背景；后续决策如修正或替代旧决策，应明确写出被替代的 ADR 和迁移影响，不能静默改写历史理由。

## ADR-001：第一版演示使用文件存储和静态 JSON

决策：第一阶段将周报、重点题记录、人工确认结果和演示数据保存为文件，Web 前端通过静态 JSON 读取。

原因：

- 演示阶段实现简单，部署速度快。
- JSON 文件便于检查、调试、脱敏和展示。
- Vite/React 前端可以直接通过 `fetch()` 读取数据。
- 不需要在第一版就引入数据库、鉴权和后端 API。

约束：

- 只适合单学生或少量演示数据。
- 不适合复杂检索、并发编辑和长期历史管理。

未来选项：第二阶段迁移到数据库 + REST API，同时保留 JSON 作为导出格式或归档格式。

## ADR-002：保留原始规划材料和隐私数据为私有内容

决策：原始 ChatGPT/Codex 日志、源 PDF、私人规划笔记、真实学生数据、API Key、真实试卷图片和运行时记录不提交到公开仓库。

原因：

- 公开仓库需要保持清晰、可共享、可审查。
- 学生数据、试卷图片和私有讨论可能包含隐私。
- API Key 和云服务凭证必须与代码分离。

执行方式：

- 公开仓库只提交脱敏样例、设计文档、演示素材和可复用代码。
- 真实运行数据放在 VPS 内部目录或后续的云存储中。

## ADR-003：Web 前端采用 Vite + React + Tailwind CSS

决策：Hermes Web 第一版采用 Vite + React + Tailwind CSS。

原因：

- React 适合构建上传、题目确认、周报查看等组件化界面。
- Vite 开发启动快，构建结果仍是静态文件，适合 Nginx 部署。
- Tailwind CSS 适合快速实现一致、可控的工作台界面。
- 演示阶段可读取静态 JSON，长期阶段可平滑切换到 REST API。

暂不采用：

- 第一版暂不引入复杂 UI 组件库。
- 第一版暂不引入图表库，除非周报展示确实需要趋势图。

## ADR-004：前端目录命名为 `src/web_ui/`

决策：前端项目目标目录采用 `src/web_ui/`，不再使用 `src/dashboard/` 作为主要命名。

原因：

- `dashboard` 容易暗示只有仪表盘，而 Hermes Web 还包括上传、切题确认和人工编辑流程。
- `web_ui` 更中性，能覆盖工作台、周报查看、试卷上传和后续更多交互页面。

未来选项：如果项目拆分为多个前端应用，可以在 `src/web_ui/` 下继续细分模块。

## ADR-005：VPS 源码目录和 Web 发布目录分离

决策：VPS 上源码目录使用 `/opt/hermes/2026AgentApp/`，Web 构建产物发布到 `/var/www/hermes-web/`。

原因：

- `/opt/hermes/2026AgentApp/` 更适合作为正式的应用源码和部署管理目录。
- `/var/www/` 应只放 Nginx 直接服务的静态产物，不应混放完整源码仓库。
- 源码目录和发布目录分离后，权限、备份和部署流程更清晰。

执行方式：使用 `scripts/deploy_web_ui.sh` 拉取代码、构建前端并发布 `dist/`。

## ADR-006：试卷处理采用“自动切题 + 人工确认”

决策：第一版使用腾讯云 `QuestionSplitOCR` 做试卷切题和基础 OCR，再由学生或家长手动确认哪些题需要记录，并补充得分、知识点、错因和备注。

原因：

- 腾讯云试卷切题适合定位题目区域、返回题目坐标和识别文本。
- 老师红笔批注、给分、扣分原因和手写说明存在较高不确定性。
- 人工确认可以显著提高记录可信度，避免把 OCR 误识别包装成确定结论。
- 该路线更适合比赛演示，能体现人机协作和智能体总结能力。

约束：

- 第一版不宣称自动理解老师全部批改语义。
- 重点题是否记录由学生或家长最终确认。

未来选项：后续可以评估多模态模型或专用教育 OCR 服务，对老师批注识别做辅助提示，但仍应保留人工确认。

## ADR-007：内部存储目录和前端公开目录分离

决策：第一阶段内部数据存储在 `/var/lib/hermes/data/`，前端公开读取目录使用 `/var/www/html/data/`。

原因：

- 原始试卷、切题图片和 OCR 响应可能包含学生隐私，不应默认公开。
- 前端只需要读取脱敏后的演示数据和必要 JSON。
- 内部目录和公开目录分离后，后续接入鉴权、发布流程和数据脱敏更容易。

公开 URL 约定：

```text
/data/week_reports/
/data/question_sessions/
```

未来选项：生产阶段应由后端 API 鉴权后返回数据或签名 URL，而不是直接公开真实数据目录。

## ADR-008：第二阶段同时引入 COS 和数据库

决策：长期阶段不仅迁移到云存储，还应同步引入数据库。

原因：

- 腾讯云 COS 适合保存原始图片、PDF、切题图片、OCR 原始响应和周报归档等大文件。
- 数据库适合保存学生、上传记录、OCR 状态、题目元数据、人工确认、重点题记录和周报索引。
- 只上 COS 不能解决复杂查询、状态更新、分页检索和多学生管理问题。

未来结构：

```text
大文件和归档：腾讯云 COS
结构化数据和状态：数据库
前端访问：REST API
```

## ADR-009：第一版以工作台体验为主，不做营销首页

决策：Hermes Web 第一屏直接展示学习助手工作台，而不是品牌宣传页或营销型首页。

原因：

- 比赛演示需要快速看到可操作能力。
- 项目重点是智能体流程和学习材料处理，不是产品营销。
- 上传试卷、确认重点题、查看周报三个任务应该成为界面核心。

页面草图和交互细节记录在 `docs/v1/system/web-ui-design.md`。

## ADR-010：区分学习证据、局部发现和聚合见解

决策：Hermes 的分析结果采用分层语义，不把一次上传或一条备注直接称为全局洞察。

术语约定：

- `evidence`：学习证据。中文使用“学习证据”。它是原始或半结构化材料，例如课本摘要、上传记录、切题结果、人工确认重点题、文字备注、历史周报摘要和后续微信消息。
- `finding`：局部发现。中文使用“局部发现”或“发现”。它来自一次上传、一道重点题、一条备注或一组相近材料，必须可追溯、带置信度，并允许被后续证据修正。
- `insight`：聚合见解。中文使用“聚合见解”或“见解”。它必须经过 consolidation，对多个局部发现、短期记忆和历史模式进行归并后形成，不能只来自一次孤立证据。

递进关系：

```text
学习证据 evidence
  -> 局部发现 finding
  -> 短期记忆 short-term memory
  -> 聚合见解 insight
  -> 长期记忆 long-term memory
  -> 周报和行动计划
```

原因：

- 中学生的单次作业、试卷或备注通常是碎片化证据，直接上升为“学习画像”容易过度推断。
- 局部发现保留来源和置信度，可以解释“这个判断从哪里来”。
- 聚合见解必须来自多个局部发现或历史模式，更适合写入周报、长期记忆和后续计划。
- 这个分层能避免 Hermes 看起来像“会下结论的聊天机器人”，而是一个可审查、可积累的学习智能体。

输出原则：

- `learning_insight_update` 主要产出局部发现、重点题记录、待确定记忆和行动候选。
- `weekly_report` 第一阶段负责执行 consolidation，把多个局部发现整理成聚合见解。
- 周报中的重要建议应能追溯到学习证据、局部发现或聚合见解。

未来选项：如果周报 consolidation 逻辑变复杂，可以拆出独立的 `finding_consolidation` job。

## ADR-011：学习记忆保存可解释的问题模式

决策：Hermes 的学习记忆不只是保存错题或知识点标签，而是重点保存可解释的问题模式。

记忆层级：

- `memory candidate`：待确定记忆。中文 UI 使用“待确定记忆”，技术文档也可写作“记忆候选”。它由局部发现产生，表示“这件事可能值得记住”，但还不等于已经进入长期记忆。
- `short-term memory`：短期记忆。中文使用“短期记忆”。它保存近期上下文，例如本周局部发现、待跟进行动、重点题和备注，可以较宽松地吸收记忆候选。
- `long-term memory`：长期记忆。中文使用“长期记忆”。它保存稳定学习画像、反复出现的问题模式和长期跟进事项，需要更严格写入条件。

写入原则：

- 优先记录可解释的问题模式，例如“遇到反比例函数图像题时规则迁移慢”“议论文论据作用说明缺少支撑关系”。
- 如果证据只支持简单判断，也可以把“某个知识点不熟”作为简单问题模式记录下来。
- 单次局部发现默认不直接写入长期记忆。
- 长期记忆应来自重复出现、人工确认、连续周报出现、基础性影响明显，或行动计划执行后仍未改善的问题。

整理过程：

```text
局部发现
  -> 待确定记忆
  -> 短期记忆
  -> consolidation 整理
  -> 聚合见解
  -> 长期记忆更新候选
  -> 长期记忆
```

原因：

- 对学生真正有价值的不是“记录做错过什么”，而是理解“为什么反复卡住”和“下一步怎么改”。
- 可解释的问题模式能跨材料复用：同一个模式可能出现在试卷、备注、作文修改或课堂提醒中。
- 短期记忆允许 Hermes 保留近期上下文，长期记忆则避免把偶发错误变成永久标签。

高价值结果：

- 给学生：少量、具体、可执行的下一步行动，而不是一长串泛泛建议。
- 给家长：能看懂的问题模式和跟进重点，而不是零散错题列表。
- 给老师：能参考的薄弱模式和证据来源，而不是模型未经解释的判断。
- 给评委：清楚展示 Hermes 如何从学习证据形成可追溯发现、学习记忆和行动建议。

## ADR-012：上传结束页承载 findings 与待确定记忆确认

决策：第一版 Web UI 不新增独立顶层“学习洞察确认”或“长期记忆管理”模块，但在上传材料子流程的完成页中承载 Hermes 分析状态、局部发现和待确定记忆确认。

保存 `question_confirmation_result` 后，前端触发或提示触发 `learning_insight_update` job。由于从 evidence 到 findings 属于 Hermes job/skill 处理，不应假设它与上传表单保存同步完成；上传结束页应支持轮询 job 状态，也应提供手动刷新状态能力。job 完成后，前端读取 `learning_findings` 结果，展示 local findings、memory candidates 和 action candidates。

原因：

- 当前核心用例中，人工确认已经发生在“上传学习成果并标注重点题”步骤；继续在上传结束页展示 findings，可以保持同一条用户路径。
- findings 依赖跨进程 Hermes job 处理，上传流程最后一步只能展示 job 状态、已有结果或 demo fixture，不能假装分析同步完成。
- 待确定记忆需要人工选择和设置优先级，否则不应自动进入长期记忆。
- 不单独新增顶层 review 模块，可以控制第一版 UI 范围，同时补上核心价值展示缺口。

约束：

- 上传结束页必须区分 `pending` / `running` / `completed` / `failed` 等 job 状态。
- 页面应允许用户确认、忽略或修改 Hermes 生成的待确定记忆，并设置优先级。
- 待确定记忆、短期记忆和长期记忆的边界必须在 contract 与 sample data 中表达清楚。
- 第一版可以使用静态 sample data 模拟 job 完成结果；后续接入 API 后通过 `/api/hermes/jobs` 创建和查询任务。

## ADR-013：首批 Hermes 能力拆成三个 task-specific skills

决策：第一版 Hermes 不再依赖单一泛化 `study_assistant.skill.md`，而是拆成三个任务型 skill：

- `textbook_summary`：从教材 PDF、讲义或已提取文本生成教材理解结构。
- `learning_insight_update`：从重点题、备注、教材摘要和历史上下文生成局部发现、待确定记忆和行动候选。
- `weekly_report`：对一周内的局部发现和记忆进行 consolidation，生成跨学科周报和下周行动。

原因：

- 三个 skill 分别对应不同输入、输出和质量标准。
- `learning_insight_update` 是项目核心能力，不能被简化成错题 JSON 转换器。
- `weekly_report` 应消费局部发现和记忆，而不是重新从所有原始材料开始做全部推理。
- task-specific skill 更适合后续接入 prompt、job runner、contract validation 和 API trigger。

开发顺序：

```text
设计文档
  -> data contract
  -> sample data
  -> skill
  -> prompt
  -> job runner
  -> API trigger
  -> Web UI 状态和触发入口
```

## ADR-014：行动建议必须少量、具体、适合中学生执行

决策：Hermes 生成的行动建议不追求数量，而追求可执行性。`learning_insight_update` 生成 action candidates，`weekly_report` 再整理成少量下周行动。

原因：

- 初中学生的时间和注意力有限，过多建议会降低执行率。
- 周报的价值在于帮助学生知道下一步最该做什么，而不是展示模型能想到多少任务。
- 行动建议必须能追溯到学习证据、局部发现或聚合见解，否则容易变成泛泛学习鸡汤。

执行规则：

- 每条行动应具体到任务形式，例如“完成 2 道论据作用答题模板练习”。
- 行动数量应有限，并带优先级。
- 第一版不单独实现 `study_plan` skill；行动计划由 `learning_insight_update` 和 `weekly_report` 共同产出。

## ADR-015：学科字段使用内部 code，中文展示使用 subject_label

决策：所有第一版学习材料和 Hermes 输出都必须携带 `subject` 字段，并使用稳定内部 code；中文展示文本使用 `subject_label`。

第一版有效值：

```text
chinese = 语文
math = 数学
english = 英语
```

原因：

- Web UI 需要按学科筛选和分区，但顶层导航不按学科拆分。
- JSON 中保存中文学科名会让后续 API、数据库查询和多语言展示变得不稳定。
- 内部 code 适合程序判断，`subject_label` 适合中文界面直接显示。
- 周报必须支持跨学科总览，同时保留语文、数学、英语等学科分区。

执行规则：

- `subject` 只使用内部 code。
- `subject_label` 用于中文展示。
- 上传记录、切题结果、人工确认、重点题记录、备注、教材摘要、周报都必须保留学科信息。
- Web UI 不应把学科作为顶层导航，而应作为筛选器和内容分区。

## ADR-016：Demo data 必须可校验，并同步到 Web public data

决策：脱敏样例数据分为 source sample 和 Web public data 两层，并通过本地验证脚本检查。

目录约定：

```text
data/sample_inputs/
data/sample_outputs/
src/web_ui/public/data/
```

原因：

- `data/sample_inputs/` 和 `data/sample_outputs/` 是可审查的设计样例，方便说明 Hermes 输入输出。
- `src/web_ui/public/data/` 是 Vite dev server 和构建后的 Web UI 实际读取的数据。
- 两层数据都需要存在，才能同时支撑文档审查、前端开发和 VPS 静态部署。
- Demo 数据必须保持脱敏、可追溯、可被静态 `fetch('/data/...')` 读取。

执行方式：

- 使用 `src/web_ui/scripts/validate-demo-data.mjs` 验证 public demo data。
- 使用 `data/demo_data_checklist.md` 作为本地 UI 开发和 VPS 发布前的人工检查清单。
- `week_reports_index.json` 至少包含两份周报，用于验证历史周报切换。
- Public JSON 不允许包含 `/Users/`、`/var/lib/`、`/private/` 等本地绝对路径。

未来选项：长期阶段可以由 job runner 将 contract-validated 输出发布到 public data 或数据库/API，不再手动维护重复文件。

## ADR-017：阶段 G 使用 SQLite + Express + 原生 SQL 构建后端基础设施

决策：阶段 G 在现有 Express 骨架（`src/api/server.js`）上扩展，使用 SQLite 作为数据库，原生 SQL（`better-sqlite3`）作为查询层，文件存储继续使用 VPS 本地磁盘。

原因：

- 资源友好：SQLite 单文件、零配置，适合 1C1G VPS。
- 团队熟悉：前端和 API 都是 JavaScript/Node.js，不需要引入 Python 后端框架。
- Job runner 已经是 bash 脚本（见 #46），Express 作为 API 层和 job 调度层足够。
- 原生 SQL 无抽象层，竞赛评审最直观，调试时可直接 `sqlite3 hermes.db .schema`。
- 阶段 F 只需在阶段 G 数据库上插入 LLM 生成的数据，无需改动存储层。

选型排除：

- **PostgreSQL/MySQL**：VPS 资源有限，且阶段 G 是 demo 基础设施，不需要高并发。
- **Prisma/Drizzle**：增加依赖和学习成本，原生 SQL 对竞赛场景更直接。
- **FastAPI**：团队已有 Express 骨架，迁移成本高；job runner 是 bash，不需要 Python 生态。
- **COS/对象存储**：竞赛阶段不需要，VPS 本地磁盘足够。

部署方式：

- systemd service 守护 Express 进程
- Nginx 反向代理 + 静态文件服务
- Let's Encrypt SSL（如需 HTTPS）

未来选项：竞赛结束后可平滑迁移到 PostgreSQL + Drizzle ORM + 腾讯云 COS，保持 API 契约不变。

## ADR-018：产品大版本与工程阶段分离管理

决策：Hermes 对外发布采用 1.0、2.0、3.0 三个大版本；工程执行仍保留现有阶段命名，例如第一阶段、阶段 G、阶段 F 和第二阶段。

版本定义：

```text
1.0 = 静态全链路演示版
2.0 = 真实 AI 和云端 API 版
3.0 = 多用户真实场景版
```

阶段映射：

- 1.0 对应前面文档中的阶段一：Vite/React Web UI + 脱敏静态 JSON + fixture job 状态，证明完整学习闭环。
- 2.0 汇合阶段 G 和阶段 F：阶段 G 提供 SQLite + REST API + 可写入持久化，阶段 F 在同一契约上接入 LLM 动态生成 findings 和周报。
- 3.0 对应长期生产化阶段：多用户鉴权、真实数据隔离、对象存储、云数据库、后台任务队列、审计和备份。

原因：

- 产品版本需要面向评委、用户和后续交付，表达“能做什么”。
- 工程阶段需要面向开发排期，表达“先做什么、后做什么”。
- 阶段 G 是 2.0 的基础设施前置工作，不应被误解为已经具备真实 AI 能力。
- 阶段 F 依赖阶段 G 的 API 和数据库，二者合并后才构成 2.0 的核心发布能力。

配置管理规则：

- 环境差异通过环境变量表达，避免在业务代码中写死部署路径、模型名、provider 或 secret。
- 1.0 默认 `HERMES_DATA_SOURCE=static`，前端读取 `/data/` 静态 JSON。
- 1.0 默认 `VITE_HERMES_EXECUTION_MODE=static`，前端任务按钮通过 demo job manifest 模拟 pending / running / completed，并读取 sample result。
- 2.0 默认 `HERMES_DATA_SOURCE=api`、`HERMES_STORAGE_PROVIDER=local`、`DATABASE_URL=sqlite:////var/lib/hermes/hermes.db`。
- 2.0 默认 `VITE_HERMES_EXECUTION_MODE=api`，前端任务按钮通过 `/api/hermes/jobs` 创建和轮询真实 job。
- 2.0 使用 `HERMES_JOB_MODE=fixture` 做演示和回归测试，使用 `HERMES_JOB_MODE=real` 接入真实 LLM。
- 3.0 默认 `HERMES_DATA_SOURCE=api`、`HERMES_STORAGE_PROVIDER=cos`，数据库迁移到 PostgreSQL/MySQL。
- 前端数据访问函数必须保留 API fallback 到静态 JSON 的能力，直到 3.0 明确不再需要 demo fallback。

发布门槛：

- 1.0：静态 demo data 完整、脱敏、可校验；公开链接能走完整演示路径。
- 2.0：API 可写入，SQLite 持久化，真实 LLM 输出经过 contract validation 后入库；fixture 和 real 模式可切换。
- 3.0：多用户数据隔离、鉴权、私有对象存储、云数据库迁移、任务队列、备份和运行日志具备最小可用实现。

执行规则：

- 新功能仍按“设计文档 -> data contract -> sample data -> skill -> prompt -> job runner -> API trigger -> Web UI -> 验证”的顺序开发。
- 阶段 B 可以先实现 static demo job adapter，用 sample data 表达 Hermes 任务执行过程；阶段 G/F 再替换为真实 API/job runner。
- 不允许为了追赶版本号绕过 contract validation 或隐私脱敏。
- 版本升级优先保持 API contract 兼容；必须破坏兼容时，需要在设计文档中记录迁移策略。

## ADR-019：Hermes 是领域智能运行时，LLM 是可替换的推理 Provider

决策：Hermes 作为学途智伴稳定的领域智能运行时，负责学习任务、业务语义、上下文、记忆治理、任务状态、结果校验和持久化流程。基础 LLM Service 是 Hermes 使用的基础设施端口；DeepSeek 等云端模型只是该端口的一种 Provider Adapter，不成为产品架构或领域模型的中心。

推荐分层：

```text
Web UI / API
  -> Hermes Job Runner
  -> Task-specific Skill + 领域规则 + 上下文组装
  -> LLM Provider Port
  -> DeepSeek / 其他云端模型 / 本地模型 Adapter
  -> Contract 与语义校验
  -> Storage / API result
```

职责边界：

- Hermes 负责选择任务、读取允许使用的学习证据和历史上下文，并维护 `evidence -> finding -> memory candidate -> consolidation -> insight -> action` 的语义边界。
- Hermes 负责 `pending`、`running`、`completed`、`failed`、`timeout` 等任务状态；模型限流、鉴权失败、超时、无效响应等外部错误必须转换为稳定的失败状态或原因。
- Hermes 负责在结果写入前执行 JSON contract validation 和必要的语义校验；模型输出不能绕过校验直接写入学习记录。
- LLM Provider Port 只表达 Hermes 需要的推理能力和调用结果，不暴露特定厂商的请求结构。
- Provider Adapter 负责凭证、网络调用、厂商协议映射以及将厂商错误转换为 Hermes 可理解的失败原因。
- Web UI 只消费 Hermes 的任务状态和领域结果，不直接调用模型 Provider，不保存 API Key，也不从模型原始响应推导学习结论。

Provider 独立规则：

- `skill`、领域 contract、存储结构和对外 API 不得依赖 DeepSeek 专有字段或模型名称。
- `provider`、`model`、`prompt_version`、`skill_version`、`contract_version` 和 `trace_id` 等信息应作为任务或审计 metadata 保存，而不是进入学习语义本身。
- 不同 Provider 可以使用针对性的请求参数或 Prompt 调优，但不得改变 finding、memory candidate、insight 和 action 的业务含义。
- `HERMES_JOB_MODE=fixture` 与 `HERMES_JOB_MODE=real` 必须遵守相同的输出 contract；fixture 模式继续用于演示、离线开发和回归测试。

当前范围：

- 2.0 采用确定性任务编排和有边界的 LLM 推理，先跑通 `learning_insight_update`，再扩展 `textbook_summary` 和 `weekly_report`。
- 当前不引入自由自主的 Agent 循环、通用规划器、动态工具选择或大型通用 Agent 框架。只有真实用例证明固定 job 无法表达必要流程时，才重新评估。
- 模型只能提出待确定记忆；人工确认和 consolidation 规则继续决定记忆能否升级，不因更换 Provider 而改变。

替换测试：

- 将 DeepSeek 替换为其他云端或本地模型时，Hermes 的任务类型、领域语义、存储、API 和 Web UI 应保持不变；允许调整的范围主要是 Adapter、模型配置和必要的 Prompt 调优。
- 在 fixture 与真实模型之间切换时，下游校验、存储和 UI 不应增加两套业务逻辑。
- 当 Provider 超时、限流、鉴权失败或返回无效结构时，任务应以 `failed` 或 `timeout` 结束并保留稳定的失败原因，已有学习数据不得被部分结果污染。

备选方案及取舍：

- **前端直接调用 DeepSeek**：原型速度最快，但会暴露凭证，使业务规则、隐私边界和错误处理散落在 UI 中，不采用。
- **只有薄后端 LLM Service**：适合隐藏凭证和统一网络调用，但不足以承载学习记忆、consolidation 和可追溯性；保留为 Hermes 的基础设施能力，不作为产品核心。
- **通用 Agent 框架**：可以提供规划、工具和状态图能力，但当前三个固定任务不需要这类复杂度，暂不采用。
- **完全规则系统**：适合 contract 校验、状态流转和安全规则，但难以理解非结构化学习材料；作为 Hermes 的确定性部分和失败回退，不替代 LLM 推理。

影响：

- 正面：领域规则与模型供应商解耦，便于测试、替换模型、保护隐私并保持结果可追溯。
- 代价：需要维护一个清晰但尽量精简的 Provider Port、Adapter、失败映射和调用 metadata。
- 风险：如果 Hermes 最终只是 `prompt -> model API` 的包装层，这个边界就失去价值；2.0 必须通过真实的 `learning_insight_update` 纵向闭环验证其职责。

## ADR-020：V2 采用 `/demo` 与 `/app` 隔离双线，并重排为 E1–E6

决策：V2 在同一 VPS 提供两条隔离路线。`/demo` 冻结 V1 脱敏静态完整流程，不依赖 API/OCR/Hermes；`/app` 是 API-only 真实主线，失败时明确报错，不在同一页面静默 fallback。V2 顶层工作按 E1–E6 管理：持久化基础、双线工作台、教材知识底图、练习导入与确认、Hermes 能力、VPS 部署验收。

原因：真实外部服务具有演示风险，但把 fallback 混入真实页面会产生状态歧义和 bug。两条线隔离后，真实系统边界清楚，V1 又能作为可靠兜底。

影响：ADR-018 中“前端 API fallback 到静态 JSON 直到 3.0”的要求对 V2 被本 ADR 取代；历史 V1 行为和 E1 已实现 API 保持不变。R1 终评约束叠加在 E1–E6 上，不替代这些 Epic。

## ADR-021：V2 教材采用单科离线知识底图

决策：V2 只支持人教版八年级下册数学。教材 PDF 在开发阶段线下处理一次，经人工抽查后形成仓库内版本化、只读的知识地图 JSON；SQLite 只保存 map/version/node 引用。

原因：教材知识能帮助 Hermes 将错题关联到稳定知识点，但在线 PDF 处理不是 V2 要展示的智能能力，且会引入上传、OCR、分页、进度、重试和管理后台等大量非核心复杂度。

影响：在线教材导入、多教材和多学科延后到 V3；V2 数据仍保留 `subject`、教材和版本边界，避免以后无法扩展。

## ADR-022：腾讯 OCR 识别题目与作答，用户确认错题

决策：V2 一次接收一张不超过 10 MB 的 JPG/PNG，用腾讯云官方 Node SDK 调用 QuestionSplitOCR，保存题干、学生作答和 bbox。用户勾选错题；系统不自动判错。原图进入 VPS 私有目录，前端按 bbox 显示，不保存每题裁图。

原因：OCR/切题是获得真实输入的基础设施，错题判断需要可靠性且最适合保留一个简单人工确认点。这个分工还能避免让 Hermes 同时承担视觉识别、判错和学习分析。

影响：只维护一个 OCR adapter，密钥来自环境变量。PDF 试卷、批量图片、多 Provider、自动判错和复杂人工校正延后。

## ADR-023：应用通过 Hermes CLI bridge 调用固定 Skill，SQLite 管理产品记忆

决策：应用不直接调用 DeepSeek，也不驱动 tmux/TUI。`HermesBridge` 使用 `studyv2-runtime` profile 启动非交互 CLI 子进程，以 JSON stdin/stdout 交换数据；`studyv2-lab` profile 和 TUI 仅用于开发者快速试验。两个 profile 共享仓库 Skill，但会话、配置和运行数据隔离。每个 runtime job 使用新会话并关闭 ambient memory；产品只显式传入 SQLite 中已接受的记忆。

V2 使用三个粗粒度 Skill：离线 `textbook-knowledge-map`、在线 `confirmed-mistake-analysis`、在线 `weekly-learning-report`。实验修改不要求每次先建 issue；进入 runtime 或锁定展示结果前必须提交 Skill，并记录版本或 content hash。

原因：这样既能利用 Hermes 的 Skill、受控上下文和 Provider 配置，又保持产品记忆可确认、可追溯，不让一次 one-shot 调用退化为散落的 Prompt，也不让不可见的 Agent memory 影响学生画像。

影响：ADR-019 的“Provider Adapter”在系统边界上仍成立，但 DeepSeek adapter 位于 Hermes 内部，不由学途智伴应用重复实现。详细设计见 `docs/v2/hermes-runtime-and-skills.md`。

## ADR-024：V2 使用串行 SQLite job，并把终评 R1 作为交付约束

决策：V2 只支持 `exercise_ocr`、`mistake_analysis`、`weekly_report` 三种 job，由 API 进程内串行执行器运行，前端轮询，失败后人工重试。目标状态为 `queued/running/succeeded/failed`；E1 现有状态先保持兼容，迁移或映射在相关 Epic 设计时完成。进程重启后遗留 `running` job 进入 `failed/interrupted`，外部失败不得部分写入领域结果。

R1 要求尽早冻结四页真实 UI，并准备 PPT、独立 `/demo`、`/app` 已保存真实结果和 60–90 秒真实端到端录屏四层兜底。现场不强求重新生成已经真实生成并保存的记忆和周报。

原因：单用户终评展示不需要 Redis、独立 worker、并发调度或 production 级恢复；串行执行最容易由当前团队理解、验证和演示。R1 降低现场风险，但不改变 E1–E6 的架构分工。

影响：自动重试、进度、取消、优先级、任务历史、定时报告、并行 worker 和高可用延后到 V3。
