# 架构

本文档记录 Hermes 第一版演示架构和后续演进方向。当前架构重点不是搭建完整生产级教育平台，而是让 Hermes 能稳定展示“学习证据 -> 局部发现 -> 学习记忆 -> 周报和行动建议”的智能体闭环。

## 1. 架构目标

第一版架构需要支持：

1. Web UI 展示学习内容、学习成果、输入备注和历史周报。
2. 静态 JSON demo 数据支撑完整演示闭环。
3. Hermes skill 能以可版本管理的方式定义智能体行为。
4. 后续 job runner 能读取输入、执行 skill/prompt、校验 contract、写入结果。
5. VPS 可以通过 Nginx 服务 Web UI 和公开 demo data。
6. 长期阶段可以迁移到 REST API、数据库、COS 和任务队列。

## 2. 当前第一版分层

第一版采用“前端静态读取 + Hermes runtime 规划中”的分层方式：

```text
Hermes Web UI
  -> Static JSON fetch('/data/...')
  -> Public demo data
  -> Sample inputs / sample outputs
  -> JSON contracts
  -> Hermes skills / prompts / job runner
```

其中 Web UI 和 demo data 已经可以本地运行；Hermes skill、prompt 和 job runner 是下一阶段 Phase F 的核心工作。

## 3. 核心数据流

### 3.1 演示阶段

```text
data/sample_inputs/
  -> data/sample_outputs/
  -> src/web_ui/public/data/
  -> React Web UI fetch('/data/...')
  -> 浏览器展示
```

演示阶段不要求真实后端 API。Web UI 读取 `src/web_ui/public/data/` 中的静态 JSON：

- `/data/textbooks/`
- `/data/notes/`
- `/data/question_sessions/`
- `/data/focus_question_records/`
- `/data/week_reports/`

### 3.2 Hermes runtime 阶段

```text
Web UI / API trigger
  -> Job Runner
  -> Skill + Prompt + LLM/tool calls
  -> Contract validation
  -> Storage
  -> Public JSON / API result
  -> Web UI render
```

第一版 job runner 可以先使用 deterministic / fixture-based 方式生成结果，不强制接真实 LLM。关键是把输入、输出、校验和发布路径跑通。

## 4. 智能体语义模型

Hermes 的核心不是保存错题，而是把学习证据转化为可解释的问题模式和下一步行动。

推荐语义递进：

```text
学习证据 evidence
  -> 局部发现 finding
  -> 记忆候选 memory candidate
  -> 短期记忆 short-term memory
  -> consolidation
  -> 聚合见解 insight
  -> 长期记忆 long-term memory
  -> 周报和行动建议
```

分工：

- `learning_insight_update`：基于一次或一组学习证据生成局部发现、记忆候选和行动候选。
- `weekly_report`：对一周内的局部发现和记忆进行 consolidation，生成聚合见解、周报和少量下周行动。
- 长期记忆不直接接受单次局部发现，优先保存重复出现、人工确认或连续周报中出现的可解释问题模式。

该模型的详细决策记录在 `design_docs/04_technical_decisions.md`。

## 5. 首批 Hermes job 类型

第一版只规划三个核心 job：

### 5.1 `textbook_summary`

用途：将教材 PDF、讲义或已提取文本转化为教材理解结构。

输出：

- `textbook_content_summary` JSON
- 章节、学习单元、知识点、关键词和不确定内容

### 5.2 `learning_insight_update`

用途：把教材摘要、上传材料、切题结果、人工确认重点题、文字备注和已有学习记忆转化为局部发现。

输出：

- 重点题记录
- local findings / 局部发现
- memory candidates / 记忆候选
- action candidates / 行动候选
- weekly context candidates / 周报上下文候选

这是 Hermes 的核心 skill，不能被简化成“错题 JSON 转换器”。

### 5.3 `weekly_report`

用途：基于一周内的重点题、备注、局部发现和记忆，生成跨学科周报。

输出：

- `weekly_report` JSON
- `week_reports_index` JSON
- consolidation 形成的聚合见解
- 少量、具体、适合中学生执行的下周行动

## 6. 源码模块

当前和计划中的主要模块：

```text
src/web_ui/
  Vite + React + Tailwind Web UI

src/web_ui/public/data/
  Web UI 本地 demo 读取的公开 JSON

src/web_ui/scripts/
  Web UI 和 demo data 验证脚本

src/skills/
  Hermes skill 行为规范

src/prompts/
  LLM prompt 模板

src/agent/
  Hermes runtime 代码位置
```

Phase F 建议新增：

```text
src/agent/jobs/
  run_textbook_summary.py
  run_learning_insight_update.py
  run_weekly_report.py

src/agent/validation/
  contract validation helpers
```

现有 `src/agent/ingest/`、`src/agent/analysis/`、`src/agent/planner/`、`src/agent/reminders/`、`src/agent/storage/` 仍可作为长期模块方向，但第一版实现重点应先收敛到 job runner、skills、prompts 和 JSON contracts。

## 7. 数据和存储

### 7.1 仓库内 demo 数据

```text
data/contracts/
data/sample_inputs/
data/sample_outputs/
src/web_ui/public/data/
```

约定：

- `data/contracts/`：JSON contract 示例。
- `data/sample_inputs/`：脱敏样例输入。
- `data/sample_outputs/`：脱敏样例输出。
- `src/web_ui/public/data/`：Web UI 实际 fetch 的 public demo data。

Demo data 必须通过 `src/web_ui/scripts/validate-demo-data.mjs` 和 `data/demo_data_checklist.md` 检查。

### 7.2 VPS 第一阶段存储

内部运行时数据：

```text
/var/lib/hermes/data/
```

前端公开读取目录：

```text
/var/www/html/data/
```

不应直接公开整个内部目录。真实学生数据、原始图片、OCR 原始响应和隐私材料必须留在内部目录或后续的私有存储中。

### 7.3 长期存储

长期阶段建议同时引入：

- 腾讯云 COS：保存 PDF、原始图片、切题图片、OCR 原始响应和归档文件。
- 数据库：保存学生、上传记录、OCR 状态、确认结果、重点题、周报索引、记忆和任务状态。
- REST API：为 Web UI 和未来微信端提供受控访问。

详细存储设计见 `design_docs/10_storage_design.md`。

## 8. Web UI

Web UI 第一版是工作台，不是营销首页。

主视图：

- 学习成果：上传材料、切题结果、重点题确认。
- 输入备注：保存文字备注和学习问题。
- 历史周报：读取周报索引和周报 JSON。
- 学习内容：展示教材摘要和知识点结构。

设计原则：

- 顶层导航不按学科拆分。
- 学科作为筛选器和内容分区。
- 第一版使用静态 JSON demo data。
- 后续通过 `/api/hermes/jobs` 接入真实 job trigger 和任务状态。

## 9. 部署

当前部署目标：

```text
GitHub repo
  -> Tencent Cloud VPS /opt/hermes/2026AgentApp/
  -> npm build src/web_ui
  -> /var/www/hermes-web/
  -> Nginx 服务 Web UI
  -> /var/www/html/data/ 服务只读 demo JSON
```

部署脚本：

```text
scripts/deploy_web_ui.sh
```

VPS 部署验证重点：

- Web UI 可以公开访问。
- `/data/week_reports/` 可以读取。
- `/data/question_sessions/` 可以读取。
- demo data 脱敏，不暴露 secret 或真实学生隐私。

## 10. 后续演进

近期 Phase F：

1. 补充 finding / insight / memory contracts 和 sample data。
2. 创建首批 3 个 task-specific skills。
3. 创建 prompt 模板。
4. 实现最小 job runner。
5. 实现 Hermes API trigger。
6. Web UI 接入 job 状态和触发按钮。

长期方向：

- 真实 PDF / OCR / LLM 接入。
- 数据库和 COS。
- 任务队列。
- 微信端上传、备注、提醒和简版周报。
- learning insight review 或长期记忆确认界面。
