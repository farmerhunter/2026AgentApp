# Hermes 存储设计

本文档记录 Hermes 在试卷上传、切题识别、重点题确认、周报生成场景下的存储设计。目标是在演示阶段保持简单可落地，同时为后续接入腾讯云 COS 和数据库预留清晰迁移路径。

## 1. 设计结论

存储方案采用分阶段演进：

```text
第一阶段：VPS 本地文件存储 + 静态 JSON（已完成）
阶段 G：SQLite + REST API + VPS 本地文件存储
阶段 F：接入 LLM 动态生成 findings（复用阶段 G 基础设施）
第二阶段（未来）：腾讯云 COS + PostgreSQL/MySQL
```

- **第一阶段**（已完成）：纯静态 JSON + 样例图片，前端直接 `fetch()` 读取。只读，无写入能力。
- **阶段 G**（当前）：在 VPS 上部署 SQLite + Express REST API，支持前端写入上传记录、人工确认、笔记、记忆决策等业务数据。文件仍存 VPS 本地磁盘。
- **阶段 F**：在阶段 G 的数据库和 API 基础上，接入 DeepSeek LLM 动态生成 `learning_findings`，不再依赖预生成静态 JSON。
- **第二阶段**（未来竞赛后）：大文件迁腾讯云 COS，数据库迁 PostgreSQL/MySQL。

## 2. 为什么需要新的存储设计

原始周报历史检索只需要保存少量 JSON：

```text
week_reports/
  week_reports_index.json
  week_YYYYMMDD_YYYYMMDD.json
```

引入试卷上传和切题后，会新增：

- 原始试卷图片或 PDF
- 腾讯云 OCR 原始响应
- 切题后的单题图片
- 题目坐标和识别文本
- 学生确认记录
- Hermes 重点题总结
- 周报 JSON
- 任务状态和错误信息

因此，存储从“少量静态 JSON”升级为“图片 + JSON + 索引 + 状态”的体系。

## 3. 第一阶段：VPS 本地文件存储

第一阶段不额外购买存储服务，直接使用 VPS 本地磁盘。

推荐根目录：

```text
/var/lib/hermes/data/
```

推荐目录结构：

```text
/var/lib/hermes/data/
  uploads/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          page_1.jpg
          upload_meta.json

  question_crops/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          q_001.jpg
          q_002.jpg

  ocr_results/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          question_split_result.json
          tencent_raw_response.json

  confirmations/
    student_demo/
      2026-05-18/
        upload_20260518_001/
          question_confirmation_result.json

  focus_question_records/
    student_demo/
      2026-05-18/
        focus_questions.json

  week_reports/
    student_demo/
      week_reports_index.json
      week_20260518_20260524.json
```

## 4. 第一阶段 Web 暴露方式

不建议直接公开整个 `/var/lib/hermes/data/`。

演示阶段应区分“内部存储目录”和“前端公开读取目录”。

内部存储目录：

```text
/var/lib/hermes/data/
```

前端公开读取目录：

```text
/var/www/html/data/
```

Hermes 后端或部署脚本负责将脱敏后的演示数据从内部存储目录复制或发布到前端公开目录。

前端不应直接读取 `/var/lib/hermes/data/`。

演示阶段可以通过 Nginx 暴露必要的只读 URL，例如：

```text
/data/week_reports/
/data/question_sessions/
```

但需要注意：

- 原始试卷图片可能包含隐私，不应默认公开。
- 切题图片也可能包含学生姓名、分数或老师批注。
- 演示数据必须脱敏。
- 真实学生数据应通过后端鉴权后访问，而不是直接公开静态目录。

演示阶段公开目录建议使用：

```text
/var/www/html/data/
  week_reports/
    week_reports_index.json
    week_YYYYMMDD_YYYYMMDD.json

  question_sessions/
    upload_20260518_001/
      upload_meta.json
      question_split_result.json
      question_confirmation_result.json
      original/
        page_1.jpg
      crops/
        q_001.jpg
        q_002.jpg
```

生产阶段应避免把真实原始图片直接放到公开 Web 根目录下。

第一阶段为了保持前端简单，周报公开 URL 仍采用单学生演示路径：

```text
/data/week_reports/week_reports_index.json
/data/week_reports/week_YYYYMMDD_YYYYMMDD.json
```

内部存储可以保留学生维度：

```text
/var/lib/hermes/data/week_reports/{student_id}/...
```

发布到 `/var/www/html/data/week_reports/` 时，选择当前演示学生的数据进行复制或生成。

## 5. 阶段 G：SQLite + REST API + VPS 本地文件存储

阶段 G 的核心目标：让前端从“只读静态 JSON”升级为“可写入、可查询、可累积”。

文件仍由 VPS 本地磁盘存储，但结构化数据全部进 SQLite，通过 Express REST API 读写。

### 5.1 文件存储（不变）

阶段 G 不改变文件存储方式：

- 原始试卷图片 → `/var/lib/hermes/data/uploads/`
- 切题图片 → `/var/lib/hermes/data/question_crops/`
- OCR 结果 JSON → `/var/lib/hermes/data/ocr_results/`
- 周报 JSON → `/var/lib/hermes/data/week_reports/`

### 5.2 数据库存储（新增）

SQLite 负责所有可查询、可更新、需要累积的结构化数据：

- 学生信息
- 上传记录
- OCR / 切题任务状态
- 题目元数据
- 人工确认记录（用户可编辑，刷新不丢失）
- 学习发现（`learning_findings`，阶段 F 由 LLM 生成，阶段 G 可插入样例数据）
- 记忆决策（`memory_decisions`，用户接受/忽略/备注，长期累积）
- 行动候选（`action_candidates`，关联到 finding）
- 重点题记录
- 周报索引
- 笔记（`text_notes`，用户输入）
- Hermes 任务状态（`hermes_jobs`，已有 Express job runner，持久化到数据库）

### 5.3 第二阶段（未来）：腾讯云 COS + PostgreSQL/MySQL

竞赛结束后如需扩展：

- 大文件迁移到腾讯云 COS
- SQLite 迁移到 PostgreSQL/MySQL（Drizzle ORM 支持平滑迁移）
- 保持前端 API 契约不变

## 6. COS 目录结构设计

推荐 COS bucket：

```text
hermes-study-data
```

推荐对象 key 结构：

```text
uploads/
  {student_id}/{date}/{upload_id}/page_1.jpg

question_crops/
  {student_id}/{date}/{upload_id}/q_001.jpg

ocr_results/
  {student_id}/{date}/{upload_id}/question_split_result.json
  {student_id}/{date}/{upload_id}/tencent_raw_response.json

confirmations/
  {student_id}/{date}/{upload_id}/question_confirmation_result.json

focus_question_records/
  {student_id}/{date}/focus_questions.json

week_reports/
  {student_id}/week_reports_index.json
  {student_id}/week_YYYYMMDD_YYYYMMDD.json
```

示例：

```text
uploads/student_demo/2026-05-18/upload_20260518_001/page_1.jpg
question_crops/student_demo/2026-05-18/upload_20260518_001/q_001.jpg
ocr_results/student_demo/2026-05-18/upload_20260518_001/question_split_result.json
week_reports/student_demo/week_20260518_20260524.json
```

## 7. 数据库表设计草案

阶段 G 使用 SQLite，文件位置 `/var/lib/hermes/hermes.db`。

所有表设计遵循原则：字段名与现有静态 JSON contract 保持一致，方便阶段 G 插入样例数据，阶段 F 无缝切换为动态写入。

> 注：`learning_findings`、`memory_decisions`、`action_candidates`、`text_notes`、`hermes_jobs` 为阶段 G 新增表，原有静态 JSON contract 中未直接定义，根据 #58 和前端交互需求补充。

### 7.1 students

保存学生基础信息。

```text
id
display_name
grade
created_at
updated_at
```

### 7.2 uploads

保存上传记录。

```text
id
student_id
subject
source_type
captured_at
original_file_url
storage_provider
status
created_at
updated_at
```

### 7.3 ocr_jobs

保存 OCR / 切题任务。

```text
id
upload_id
provider
provider_job_id
status
raw_response_url
error_message
created_at
updated_at
```

### 7.4 questions

保存切题后的题目元数据。

```text
id
upload_id
page
question_index
question_text
question_image_url
bbox_json
raw_ocr_json_url
created_at
updated_at
```

### 7.5 question_confirmations

保存学生或家长的人工确认。

```text
id
question_id
selected
student_mark
teacher_score
full_score
knowledge_point
mistake_reason
review_priority
note
created_at
updated_at
```

### 7.6 focus_question_records

保存 Hermes 生成的重点题记录。

```text
id
question_id
student_id
subject
knowledge_point
mistake_summary
recommended_action
weekly_report_id
created_at
updated_at
```

### 7.7 weekly_reports

保存周报索引和状态。

```text
id
student_id
week_start
week_end
report_json_url
summary
status
created_at
updated_at
```

### 7.8 text_notes

保存学生或家长输入的课堂备注和疑问。

```text
id
note_id          -- 业务唯一标识，如 note_20260518_001
student_id
subject
subject_label
note_type         -- "学生问题" / "课堂提醒" / "其他"
related_textbook_id
related_chapter_id
content
student_confidence -- "高" / "中" / "低"
tags              -- JSON 数组，如 ["课堂疑问", "需要复习"]
visibility
created_at
updated_at
```

### 7.9 hermes_jobs

保存 Hermes 异步任务状态。替代现有的文件系统状态存储（`runtime/public/job_status/*.json`）。

```text
id
job_id            -- 业务唯一标识，如 job_20260520_120000_a1b2c3
job_type          -- "learning_insight_update" / "weekly_report" / "textbook_summary"
status            -- "pending" / "running" / "completed" / "failed" / "timeout"
payload_json      -- 请求参数 JSON，如 {"source_ids": ["upload_001"]}
result_json       -- 任务结果 JSON（LLM 输出或 findings）
result_path       -- 结果文件路径（兼容现有 server.js）
error_message
mode              -- "fixture" / "real"
created_at
started_at
completed_at
```

### 7.10 learning_findings

保存 Hermes 生成的学习发现。阶段 G 可手动插入样例数据；阶段 F 由 LLM 动态生成并写入。

```text
id
finding_batch_id  -- 如 findings_20260518_math
student_id
subject
subject_label
generated_by      -- "learning_insight_update"
generated_at
source_refs_json  -- 关联的 upload_meta / split / confirmation 路径 JSON
```

### 7.11 findings

单条 finding 明细，一对多关联到 `learning_findings`。

```text
id
finding_batch_id
finding_id        -- 业务唯一标识，如 finding_math_001
scope             -- "local" / "global"
finding_type      -- "concept_gap" / "procedure_gap" / "calculation_error" / ...
statement         -- 核心陈述
evidence_summary  -- 证据摘要
confidence        -- "high" / "medium" / "low"
is_recurring      -- 0 / 1
mistake_reasons_json -- JSON 数组
concept_links_json   -- JSON 数组
```

### 7.12 memory_decisions

保存用户对 memory candidate 的决策（接受 / 忽略 / 优先级 / 备注）。长期累积，支撑"我的记忆"功能。

```text
id
memory_id         -- 业务唯一标识，如 mem_findings_20260518_math_001_0
finding_id        -- 关联 findings.finding_id
finding_batch_id  -- 关联 learning_findings.finding_batch_id
student_id
subject
statement         -- 冗余存储 finding statement，方便展示
reason            -- memory candidate 的原因
candidate_type    -- "short_term" / "long_term"
priority          -- "高" / "中" / "低"
note              -- 用户补充说明
status            -- "accepted" / "ignored"
accepted_at
created_at
updated_at
```

### 7.13 action_candidates

保存 finding 关联的行动候选。阶段 G 可手动插入样例数据；阶段 F 由 LLM 生成。

```text
id
finding_id
action_type       -- "redo_question" / "review_concept" / ...
description
priority          -- "高" / "中" / "低"
target_week
```

## 8. 衔接性要求

### 8.1 全局要求

1. 第一阶段的 JSON 字段应尽量接近后续数据库表字段。
2. 所有记录都必须有稳定 ID，例如 `upload_id`、`question_id`、`record_id`、`finding_id`。
3. 文件路径不要写死在业务逻辑里，应通过配置项控制。
4. JSON 中保存文件 URL 或相对路径，不保存本地绝对路径。
5. 存储 provider 需要显式记录，例如 `local`、`cos`。
6. 腾讯云原始响应必须保留，方便回溯和调试。
7. 人工确认记录和 OCR 结果分开保存，避免覆盖原始识别结果。
8. 周报引用重点题记录，不直接复制全部大图数据。
9. 前端只依赖公开 URL 契约，不依赖内部存储目录。
10. 从本地存储迁移到 COS 时，应保持前端 JSON 字段和 URL 字段含义不变。

### 8.2 阶段 G 衔接要求（新增）

阶段 G 从纯静态 JSON 迁移到 SQLite + REST API，必须保证：

1. **前端 API 契约不变**：`src/web_ui/src/lib/api.js` 中已有的 `fetchQuestionSession`、`fetchLearningFindings`、`isApiAvailable` 等函数在阶段 G 继续可用，内部实现从 `fetchJson('/data/...')` 改为 `fetch('/api/...')`。
2. **静态 JSON 降级保留**：API 不可用时，前端仍能回退到 `public/data/` 静态 JSON，与阶段 B 行为一致。
3. **样例数据可导入**：阶段 G 应提供 `scripts/seed-demo-data.mjs`（或 SQL），把现有 `public/data/` 下的静态 JSON 批量导入 SQLite，确保迁移后数据不丢失。
4. **字段名兼容**：SQLite 表字段名与现有静态 JSON 字段名保持一致，减少转换层。
5. **Job runner 兼容**：现有 `src/api/server.js` 的 job runner 从文件系统状态存储（`runtime/public/job_status/*.json`）迁移到 `hermes_jobs` 表，但 `POST /api/hermes/jobs`、`GET /api/hermes/jobs/:id`、`GET /api/hermes/jobs/:id/result` 接口契约不变。

## 9. 配置项建议

建议使用环境变量：

```text
# 存储
HERMES_STORAGE_PROVIDER=local
HERMES_DATA_DIR=/var/lib/hermes/data
HERMES_PUBLIC_DATA_BASE_URL=/data

# API
HERMES_API_PORT=8000
HERMES_JOB_MODE=fixture      # "fixture" = 样例数据 / "real" = 真实 LLM（阶段 F）

# 数据库（阶段 G）
DATABASE_URL=sqlite:////var/lib/hermes/hermes.db

# 腾讯云 COS（第二阶段，未来）
TENCENT_COS_BUCKET=hermes-study-data
TENCENT_COS_REGION=ap-beijing
TENCENT_COS_BASE_PREFIX=
```

阶段 G：

```text
HERMES_STORAGE_PROVIDER=local
DATABASE_URL=sqlite:////var/lib/hermes/hermes.db
HERMES_API_PORT=8000
HERMES_JOB_MODE=fixture
```

第二阶段（未来）：

```text
HERMES_STORAGE_PROVIDER=cos
DATABASE_URL=postgresql://... 或 mysql://...
```

## 10. 隐私和安全要求

试卷图片和错题本图片可能包含：

- 学生姓名
- 学校
- 班级
- 分数
- 老师批注
- 家长或学生备注

因此：

1. 不要将真实图片、真实 OCR 结果或真实周报提交到 GitHub。
2. 示例数据必须脱敏。
3. 生产环境不要公开原始上传目录。
4. COS bucket 默认应设为私有读写。
5. 前端访问真实图片时应使用后端鉴权或签名 URL。
6. 日志中不要打印完整图片 URL、手机号、身份证号等敏感信息。

## 11. 阶段 G 实施建议

### 11.1 最小可行部署

阶段 G 的最小部署单元：

```text
VPS (1C1G)
  ├── Nginx (反向代理 + 静态文件)
  ├── Node.js Express (src/api/server.js 扩展)
  │     └── SQLite (/var/lib/hermes/hermes.db)
  └── 本地文件存储 (/var/lib/hermes/data/)
```

前端 Vite 构建产物仍由 Nginx 直接服务（静态），API 请求通过 Nginx `proxy_pass` 到 Express。

### 11.2 数据迁移路径

```text
阶段 B 静态 JSON
  │
  ▼
阶段 G：scripts/seed-demo-data.mjs 导入 SQLite
  │
  ▼
阶段 F：LLM 动态生成 findings，写入同一数据库
```

### 11.3 演示阶段（竞赛评审时）

竞赛评审可采用：

```text
VPS 本地文件存储
SQLite 单文件数据库
脱敏样例图片
Nginx + Express + systemd
```

不必购买 COS 或云数据库。评审关注点应在业务闭环和 LLM 效果，不在基础设施规模。

代码和数据结构仍应按第二阶段可迁移的方式设计，避免本地路径、公开 URL 和业务逻辑强绑定。
