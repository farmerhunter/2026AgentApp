# Hermes 智能体运行时设计

本文档记录 Hermes 智能体功能如何以代码方式规划、开发、触发和验证。它补足 Web UI 与静态 JSON 之间缺失的运行时层，目标是让 Hermes 不只是一次性对话助手，而是可以重复执行高质量学习任务的 agent runtime。

## 1. 设计目标

Hermes 智能体运行时需要支持以下能力：

1. 将教材、试卷、错题本、文字备注等输入转化为结构化学习记录。
2. 按语文、数学、英语等学科保留上下文和输出结果。
3. 根据固定 skill 和 prompt 重复执行教材摘要、学习洞察更新、周报生成等任务。
4. 让 Web UI 可以手动触发任务、查看任务状态、读取任务结果。
5. 演示阶段优先使用文件系统和静态 JSON；长期阶段迁移到数据库、REST API 和任务队列。

## 2. 分层模型

Hermes 相关代码建议分为四层：

```text
Web UI / API trigger
  -> Job Runner
  -> Skill + Prompt + LLM/tool calls
  -> Storage + JSON contracts
```

### 2.1 Skill 层

Skill 是可版本管理的智能体行为规范。它不只是 prompt，而是规定 Hermes 如何看待输入、如何调用工具、如何处理不确定内容、如何输出结构化结果。

建议目录：

```text
src/skills/
  textbook_summary.skill.md
  learning_insight_update.skill.md
  weekly_report.skill.md
```

每个 skill 至少说明：

- 任务目标。
- 输入数据类型和必需字段。
- 需要遵守的 JSON contract。
- 学科字段 `subject` / `subject_label` 的处理规则。
- 允许调用的工具或外部服务。
- 不确定 OCR、切题或模型判断的标注方式。
- 输出长度、语气、结构和禁止事项。

### 2.2 Prompt 层

Prompt 是给 LLM 的具体任务模板，应与 skill 分离，便于审查和测试。

建议目录：

```text
src/prompts/
  textbook_summary.prompt.md
  learning_insight_update.prompt.md
  weekly_report.prompt.md
```

Prompt 必须引用对应 skill 的规则，并明确输出 JSON 的字段要求。第一版可以先用 Markdown prompt，后续再封装成代码模板。

### 2.3 Job Runner 层

Job Runner 是真正执行 Hermes 任务的代码。它负责读取输入、选择 skill/prompt、调用 LLM 或工具、校验输出、写入结果。

建议目录：

```text
src/agent/jobs/
  run_textbook_summary.py
  run_learning_insight_update.py
  run_weekly_report.py
```

第一版 job runner 可以是命令行脚本，例如：

```bash
python -m src.agent.jobs.run_weekly_report \
  --week-start 2026-05-18 \
  --week-end 2026-05-24 \
  --input-root runtime/private \
  --public-root src/web_ui/public/data
```

长期阶段再演进为后台服务或任务队列 worker。

### 2.4 Storage 层

Storage 层负责区分私有运行时数据和前端可公开读取的数据。

建议原则：

- `runtime/`：保存真实运行时输入、中间结果、内部日志，不提交 Git。
- `data/sample_inputs/`：保存脱敏样例输入。
- `data/sample_outputs/`：保存脱敏样例输出。
- `src/web_ui/public/data/`：保存前端本地 demo 可读取的数据。
- `/var/www/html/data/`：VPS 上 Nginx 对外提供的静态 JSON。

Hermes 生成结果必须先通过 contract 校验，再发布到前端公开目录。

## 3. 第一版 Job 类型

### 3.1 `textbook_summary`

用途：上传教材 PDF 或教材摘要文本后，生成教材目录、章节、学习单元和知识点摘要。

输入：

- 教材 PDF 或已提取文本。
- 学科 `subject`。
- 教材标题、年级、版本等元数据。

输出：

- `textbook_content_summary.contract.json` 对应的数据。
- 存储到 `data/sample_outputs/textbooks/` 或运行时公开目录。

### 3.2 `learning_insight_update`

用途：基于教材摘要、上传材料、试题切分结果、人工确认重点题、文字备注和已有学习记忆，生成 local findings（局部发现）。

这是项目的核心 skill。它不应被当前 Web UI 的上传材料功能限制住，而应作为“把学习证据转化为可追溯发现、待确定记忆和行动候选”的可扩展能力。

输入：

- `textbook_content_summary.json`
- `upload_meta.json`
- `question_split_result.json`
- `question_confirmation_result.json`
- `text_note.json`
- 已有 learning memory 或历史周报摘要，可选

输出：

- `focus_question_records.contract.json` 对应的数据。
- `learning_findings.contract.json` 对应的 local findings。
- memory candidates。
- action candidates。
- weekly context candidates。

该 skill 负责回答：

- 这次学习证据暴露了什么问题？
- 问题属于知识点不会、概念混淆、审题问题、表达问题、计算失误，还是学习习惯问题？
- 这个问题是否重复出现，是否应进入长期记忆？
- 它与教材章节、知识点和近期学习内容有什么关系？
- 后续应采取什么行动，优先级如何？

该 skill 不直接生成全局 insight。全局 insight 必须经过 consolidation，第一阶段由 `weekly_report` job 内部执行，未来可拆成独立 job。

### 3.3 `weekly_report`

用途：基于一周内的教材摘要、上传材料、重点题记录、文字备注、local findings 和 memory，生成跨学科周报。

输入：

- 本周上传记录。
- 本周重点题记录。
- 本周文字备注。
- 相关教材摘要。
- 本周 local findings。
- 短期和长期 memory 摘要。

输出：

- `weekly_report.contract.json` 对应的数据。
- 更新 `week_reports_index.contract.json` 对应的索引。
- consolidation 形成的 insights / 见解。

`weekly_report` 可以包含下周行动计划，但第一版不单独设置 `study_plan` skill。学习行动建议由 `learning_insight_update` 和 `weekly_report` 共同产出：前者负责局部材料级 action candidates，后者基于 consolidation 结果生成阶段性计划。

## 4. Web UI 触发方式

### 4.1 演示阶段

演示阶段前端主要读取已生成的静态 JSON：

```text
Hermes job runner
  -> 写入 JSON
  -> 发布到 /data/
  -> React fetch('/data/...')
  -> 页面渲染
```

Web UI 中的按钮可以先表现为 demo 状态：

- 上传材料：进入上传/切题/确认子流程，读取样例 session。
- 上传结束页：保存重点题确认后显示 `learning_insight_update` 的“等待分析 / 分析中 / 已完成 / 失败”状态，可以先读取静态 sample data 模拟 job 结果。
- 查看周报：读取静态周报 JSON。

该阶段不要求真实后端 API，也不要求任务队列。

### 4.2 最小真实触发阶段

当需要从 Web UI 真实触发 Hermes 时，应增加轻量后端 API：

```text
POST /api/hermes/jobs
GET /api/hermes/jobs/:job_id
GET /api/hermes/jobs/:job_id/result
```

创建任务请求示例：

```json
{
  "job_type": "learning_insight_update",
  "subject_scope": ["math"],
  "source_ids": ["upload_20260518_001"],
  "trigger_source": "after_upload"
}
```

支持的第一版 job type：

- `textbook_summary`
- `learning_insight_update`
- `weekly_report`

任务状态示例：

```json
{
  "job_id": "job_20260520_001",
  "job_type": "learning_insight_update",
  "status": "completed",
  "created_at": "2026-05-20T20:00:00+08:00",
  "completed_at": "2026-05-20T20:01:30+08:00",
  "result_path": "/data/learning_findings/findings_20260518_math.json"
}
```

前端触发流程：

```text
用户点击按钮
  -> POST /api/hermes/jobs
  -> 前端轮询 GET /api/hermes/jobs/:job_id
  -> status completed
  -> 前端 fetch result_path
  -> 渲染结果
```

上传结束页是第一版最重要的 `learning_insight_update` 触发入口。它应在保存 `question_confirmation_result` 后创建 job 或进入 demo fallback 状态；如果 job 仍在运行，页面展示轮询状态；如果用户离开页面后再回来，页面可通过 upload id 查询最近 job 或手动刷新。

job 完成后，上传结束页渲染：

- local findings / 局部发现。
- memory candidates / 待确定记忆。
- action candidates / 行动候选。
- 与原始上传、切题结果和重点题确认的 source refs。

待确定记忆的人工操作结果应单独保存，避免把未确认的 memory candidate 自动写入长期记忆。第一版可以用 sample data 表达确认结果；后续再接入真实 storage。

## 5. Skill 与开发流程的衔接

每个 Hermes 功能必须按以下顺序开发：

1. 更新设计文档，明确用户场景和输出结果。
2. 更新或创建 data contract。
3. 准备 sample input 和 sample output。
4. 编写 skill。
5. 编写 prompt。
6. 编写 job runner。
7. 增加 contract 校验。
8. 将输出接入 Web UI。
9. 在 issue 中记录验证方式和限制。

这保证智能体能力不是“靠一次对话生成”，而是可复现、可测试、可交接的代码资产。

## 6. 第一版边界

第一版必须实现：

- 至少一个教材摘要 skill/job 的可演示路径。
- 至少一个学习洞察更新 skill/job 的可演示路径。
- 至少一个周报生成 skill/job 的可演示路径。
- 输出结果符合现有 JSON contracts。
- Web UI 可以读取这些输出。

第一版不要求实现：

- 完整任务队列。
- 多用户鉴权。
- 长期数据库存储。
- 全自动理解老师红笔批注、扣分原因和真实知识点映射。
- 生产级监控和失败重试。

## 7. 与现有文档的关系

- `design_docs/03_design_brief.md`：定义 Hermes 要支持的核心用例。
- `design_docs/05_architecture.md`：定义系统模块和源码目录。
- `design_docs/07_website_design_note.md`：定义 Web UI 如何展示和触发学习流程。
- `design_docs/08_hermes_web_integration.md`：定义静态 JSON 和 REST API 两阶段集成。
- `design_docs/09_question_capture_workflow.md`：定义试卷切题、人工确认和重点题记录流程。
- `design_docs/10_storage_design.md`：定义运行时数据、公开数据和长期存储策略。
- `design_docs/15_textbook_summary_skill_design.md`：定义教材摘要 skill。
- `design_docs/16_learning_insight_update_skill_design.md`：定义学习洞察更新 skill，这是项目核心智能体能力。
- `design_docs/17_weekly_report_skill_design.md`：定义周报生成 skill。

## 8. 建议 Issue 阶段

智能体相关工作应作为独立阶段，建议命名为：

```text
phase:F-agent-runtime
```

该阶段包含：

1. Hermes skill 规范与首批 skills。
2. Hermes job runner 最小实现。
3. Hermes API trigger 最小实现。
4. Web UI 接入 Hermes job 状态与触发按钮。

该阶段应排在前端静态 demo 和基础数据 contract 之后，VPS 长期真实集成之前。
