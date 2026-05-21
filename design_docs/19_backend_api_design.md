# 后端 API 设计（阶段 G）

本文档定义阶段 G 后端 REST API 接口。前端通过这组 API 读写业务数据，替代纯静态 JSON 读取。

## 1. 设计目标

- 支持前端写入：上传记录、人工确认、笔记、记忆决策
- 支持前端查询：sessions、findings、reports、notes、memories
- 保留现有 job runner 接口（`POST /api/hermes/jobs` 等），从文件系统状态存储迁移到 `hermes_jobs` 表
- API 不可用时前端自动降级到 `public/data/` 静态 JSON

## 2. 技术栈

```text
Runtime:     Node.js 20+
Framework:   Express 4.x
Database:    SQLite 3 (better-sqlite3)
Query:       原生 SQL（无 ORM）
File upload: multer
Validation:  zod（可选，用于请求体验证）
```

## 3. 目录结构

```text
src/api/
  server.js              -- Express 入口，路由注册
  package.json
  db/
    init.js              -- 数据库连接 + 建表
    schema.sql           -- 完整建表语句
    seed.js              -- 样例数据导入（从 public/data/ JSON）
  routes/
    sessions.js          -- 上传 session CRUD
    questions.js         -- 题目 + 确认结果
    findings.js          -- learning_findings + findings 明细
    memories.js          -- memory_decisions
    notes.js             -- text_notes
    reports.js           -- weekly_reports
    jobs.js              -- Hermes job（替代现有 server.js 中的内联路由）
    health.js            -- 健康检查
  middleware/
    errorHandler.js      -- 统一错误处理
    validate.js          -- 请求体验证中间件
```

## 4. API 接口总览

| 方法 | 路径 | 说明 | 对应前端函数 |
|---|---|---|---|
| GET | `/api/health` | 健康检查 | `isApiAvailable()` |
| GET | `/api/sessions` | 查询上传 session 列表 | `fetchSessionIndex()` |
| GET | `/api/sessions/:upload_id` | 查询单个 session 元数据 | `fetchQuestionSession(id, "upload_meta.json")` |
| GET | `/api/sessions/:upload_id/split` | 查询切题结果 | `fetchQuestionSession(id, "question_split_result.json")` |
| GET | `/api/sessions/:upload_id/confirmation` | 查询确认结果 | `fetchQuestionSession(id, "question_confirmation_result.json")` |
| POST | `/api/sessions/:upload_id/confirmation` | 保存/更新确认结果 | （新增） |
| GET | `/api/findings` | 查询 findings 批次列表 | （新增） |
| GET | `/api/findings/:batch_id` | 查询单批 findings | `fetchLearningFindings(batchId)` |
| GET | `/api/memories` | 查询记忆决策列表 | （新增） |
| POST | `/api/memories` | 保存/更新记忆决策 | （新增） |
| GET | `/api/notes` | 查询笔记列表 | `fetchWeekReportsIndex()` 类似 |
| GET | `/api/notes/:note_id` | 查询单条笔记 | `fetchTextNote(noteId)` |
| POST | `/api/notes` | 创建笔记 | （新增） |
| GET | `/api/reports` | 查询周报索引 | `fetchWeekReportsIndex()` |
| GET | `/api/reports/:report_id` | 查询单份周报 | `fetchWeeklyReport(fileName)` |
| POST | `/api/hermes/jobs` | 创建 Hermes job | `createHermesJob(payload)` |
| GET | `/api/hermes/jobs/:job_id` | 查询 job 状态 | （pollHermesJob 内部调用） |
| GET | `/api/hermes/jobs/:job_id/result` | 查询 job 结果 | `fetchHermesJobResult(jobId)` |

## 5. 接口详细设计

### 5.1 健康检查

```text
GET /api/health
```

响应：
```json
{
  "status": "ok",
  "mode": "fixture",
  "supported_jobs": ["learning_insight_update", "weekly_report", "textbook_summary"],
  "database": "sqlite",
  "version": "0.1.0"
}
```

### 5.2 Sessions

```text
GET /api/sessions
```

响应（与 `question_sessions/_index.json` 字段兼容）：
```json
{
  "contract": "question_sessions_index",
  "contract_version": "1.0",
  "total_sessions": 2,
  "total_questions": 6,
  "total_confirmed": 4,
  "sessions": [
    {
      "upload_id": "upload_20260518_001",
      "subject": "math",
      "subject_label": "数学",
      "source_title": "反比例函数练习",
      "source_type": "试卷页",
      "captured_at": "2026-05-18",
      "question_count": 3,
      "confirmed_count": 1
    }
  ]
}
```

```text
GET /api/sessions/:upload_id/split
```

响应与 `question_split_result.json` 字段一致。

```text
POST /api/sessions/:upload_id/confirmation
```

请求体：
```json
{
  "confirmations": [
    {
      "question_id": "q_001",
      "selected": true,
      "student_mark": "做错了",
      "teacher_score": "0",
      "full_score": "3",
      "knowledge_point": "反比例函数图像所在象限",
      "mistake_reason": "没有根据 k 的正负判断象限。",
      "review_priority": "高",
      "review_status": "需要复习",
      "tags": ["错题", "老师讲过"],
      "note": "需要把 k 的正负和象限关系整理成口诀。"
    }
  ]
}
```

### 5.3 Findings

```text
GET /api/findings/:batch_id
```

响应与 `learning_findings/*.json` 字段一致。

阶段 G：返回预插入的样例数据（从 `public/data/learning_findings/` 导入）。
阶段 F：返回 LLM 实时生成的数据。

### 5.4 Memory Decisions

```text
GET /api/memories?subject=math&status=accepted
```

查询参数（可选）：
- `subject`: 按学科筛选
- `status`: `accepted` / `ignored`
- `priority`: `高` / `中` / `低`

响应：
```json
{
  "contract": "memory_decisions",
  "contract_version": "1.0",
  "total": 2,
  "memories": [
    {
      "memory_id": "mem_findings_20260518_math_001_0",
      "finding_id": "finding_math_001",
      "finding_batch_id": "findings_20260518_math",
      "subject": "math",
      "statement": "学生对反比例函数 k 的正负与象限对应关系理解不牢固。",
      "reason": "本周首次出现，但属于基础知识点，应记住以便后续追踪是否重复。",
      "candidate_type": "short_term",
      "priority": "高",
      "note": "",
      "status": "accepted",
      "accepted_at": "2026-05-18T20:35:00+08:00"
    }
  ]
}
```

```text
POST /api/memories
```

请求体（单条或批量）：
```json
{
  "memories": [
    {
      "finding_id": "finding_math_001",
      "finding_batch_id": "findings_20260518_math",
      "subject": "math",
      "statement": "...",
      "reason": "...",
      "candidate_type": "short_term",
      "priority": "高",
      "note": "",
      "status": "accepted"
    }
  ]
}
```

存在性策略：`(finding_id, finding_batch_id)` 组合唯一。重复提交时更新而非插入。

### 5.5 Notes

```text
GET /api/notes
```

响应：
```json
{
  "notes": [
    {
      "note_id": "note_20260518_001",
      "subject": "math",
      "subject_label": "数学",
      "note_type": "学生问题",
      "content": "我总是分不清 k 大于 0 和小于 0 时图像在哪些象限。",
      "tags": ["课堂疑问", "需要复习"]
    }
  ]
}
```

```text
POST /api/notes
```

请求体：
```json
{
  "subject": "math",
  "note_type": "学生问题",
  "content": "...",
  "tags": ["课堂疑问"]
}
```

### 5.6 Weekly Reports

```text
GET /api/reports
```

响应与 `week_reports_index.json` 字段一致。

```text
GET /api/reports/:report_id
```

响应与 `week_YYYYMMDD_YYYYMMDD.json` 字段一致。

### 5.7 Hermes Jobs（已有接口，迁移到数据库）

现有接口契约不变，内部实现从文件系统状态存储迁移到 `hermes_jobs` 表：

```text
POST /api/hermes/jobs
GET /api/hermes/jobs/:job_id
GET /api/hermes/jobs/:job_id/result
```

`POST /api/hermes/jobs` 响应：
```json
{
  "job_id": "job_20260520_120000_a1b2c3",
  "job_type": "learning_insight_update",
  "status": "pending",
  "mode": "fixture"
}
```

`GET /api/hermes/jobs/:job_id` 响应：
```json
{
  "job_id": "job_20260520_120000_a1b2c3",
  "job_type": "learning_insight_update",
  "status": "completed",
  "mode": "fixture",
  "result_path": "/data/learning_findings/findings_20260518_math.json",
  "created_at": "2026-05-20T12:00:00+08:00",
  "started_at": "2026-05-20T12:00:01+08:00",
  "completed_at": "2026-05-20T12:00:05+08:00"
}
```

## 6. 错误处理约定

统一响应格式：

```json
{
  "error": "简短错误码",
  "message": "人类可读描述"
}
```

HTTP 状态码：

| 状态码 | 场景 |
|---|---|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复提交） |
| 500 | 服务器内部错误 |

## 7. 前端降级策略

前端 `src/web_ui/src/lib/api.js` 中的函数应保持以下行为：

```js
// 伪代码
async function fetchWithFallback(apiPath, staticPath) {
  try {
    const res = await fetch(`/api${apiPath}`);
    if (res.ok) return res.json();
  } catch {
    // API 不可用，降级到静态 JSON
  }
  return fetchJson(staticPath);
}
```

阶段 G 开发过程中，每个 API 函数都应支持：
1. API 可用时走 `/api/...`
2. API 不可用时走 `/data/...` 静态 JSON
3. 不报错，用户体验无缝

## 8. 部署配置

### 8.1 systemd service

`/etc/systemd/system/hermes-api.service`:

```ini
[Unit]
Description=Hermes API Server
After=network.target

[Service]
Type=simple
User=hermes
WorkingDirectory=/opt/hermes/2026AgentApp/src/api
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=HERMES_API_PORT=8000
Environment=HERMES_JOB_MODE=fixture
Environment=HERMES_DATA_DIR=/var/lib/hermes/data
Environment=DATABASE_URL=sqlite:////var/lib/hermes/hermes.db

[Install]
WantedBy=multi-user.target
```

### 8.2 nginx

```nginx
server {
    listen 80;
    server_name hermes.example.com;

    # 前端静态文件
    location / {
        root /var/www/hermes-web;
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 公开数据（兼容阶段 B 静态路径）
    location /data/ {
        alias /var/www/html/data/;
    }
}
```

### 8.3 初始化脚本

```bash
#!/bin/bash
# scripts/setup-vps.sh

# 创建目录
mkdir -p /var/lib/hermes/data
mkdir -p /var/lib/hermes/data/uploads
mkdir -p /var/www/html/data
mkdir -p /var/www/hermes-web

# 初始化数据库
cd /opt/hermes/2026AgentApp/src/api
node db/init.js
node db/seed.js   # 导入 public/data/ 样例数据

# 启动服务
systemctl enable hermes-api
systemctl start hermes-api
```

## 9. 验收标准

- [ ] `npm run build`（前端）通过
- [ ] `node server.js`（后端）启动成功，无报错
- [ ] `node scripts/validate-demo-data.mjs` 通过
- [ ] `node db/seed.js` 成功导入样例数据到 SQLite
- [ ] 前端在 API 可用时走 `/api/...`，不可用时降级到 `/data/...`
- [ ] 人工确认结果刷新后不丢失
- [ ] 记忆决策刷新后不丢失
- [ ] systemd service 能自动重启
- [ ] Nginx 能同时服务前端静态文件和 API 代理
