# E1 持久化学习数据 API 设计

Status: Implemented
Epic: E1 / GitHub Issue #63
Owner: David (LaoLiuHaHaHaHaXiao)
Updated: 2026-08-24

> 本文遵循 `docs/epic-design-guidelines.md`，只记录 E1 的跨模块边界、关键取舍、失败处理和实现映射。实时负责人、状态和任务清单以 #63 及其子 Issue #65/#66/#67 为准。

## 1. 成果与用户场景

E1 结束后，系统首次具备“真正保存”的能力：

- 学生或家长完成题目确认后，确认结果写入 SQLite，刷新页面或重启 API 后仍存在。
- 系统可以查询 session、finding、memory decision、note、weekly report 和历史 Hermes job。
- 前端仍只读取稳定 JSON 形状；是否切到 API 由 E2 决定，但 E1 的 API 响应必须兼容现有 `data/contracts/` 和 `src/web_ui/public/data/` 的读取语义。

E1 不负责真实 LLM 生成，也不负责前端 API 适配；它负责建立持久化和读写边界。

## 2. 范围与非目标

### 当前负责

- 在现有 SQLite schema 上实现 REST 读写路由。
- 把人工确认结果、memory decision、note 写入数据库。
- 查询 session、finding、memory、note、report 和 Hermes job。
- 把 Hermes job 状态从“仅文件”迁移到“数据库为最终事实、状态文件作为 bash 脚本桥接”。

### 非目标

- 不接入真实 Hermes、不生成真实 finding；这些属于 E5。
- 不改造 Web UI 为 API-first；这属于 E2。
- 不实现多用户、鉴权、角色和数据隔离；这属于 V3。
- 不迁移 PostgreSQL/COS；E1 固定使用 SQLite + 本地文件，符合 ADR-017。
- 不实现真实文件上传和 OCR 调用；E1 只处理已有 session/题目的结构化读写。

## 3. 设计开始时的已验证基线

以下事实是 2026-08-23 开始 E1 设计时的基线，不是对当前实现状态的持续描述：

- `src/api/db/schema.sql` 已建 13 张表，覆盖 students、uploads、questions、confirmations、findings、memories、notes、reports、jobs 和 action_candidates。
- `src/api/db/seed.js` 可从 `src/web_ui/public/data/` 导入样例，重复执行幂等。
- `src/api/server.js` 当前只实现 `/api/hermes/health`、`POST /api/hermes/jobs`、`GET /api/hermes/jobs/:job_id`、`GET /api/hermes/jobs/:job_id/result`。
- job 状态目前写在 `runtime/public/job_status/<job_id>.json`，API 通过轮询该文件判断完成。
- 前端 `src/web_ui/src/lib/api.js` 仍以 `/data/` 静态 JSON 为主；E1 不切换它。
- 旧后端草案已归入历史目录 `docs/v1/future-notes/backend-api-draft.md`，不作为 E1 当前实现依据。

## 4. 核心不变量

1. API 响应必须兼容现有 JSON contract；示例 JSON 低于 `data/contracts/` 的机器校验优先级。
2. 写操作不得留下半完成数据：多表写入必须使用 SQLite transaction。
3. 所有业务写入默认属于单学生 `student_demo`（显示名「小明」），并支持 `?student_id=` 显式过滤。
4. 客户端不得提供 `note_id` 或 `report_id`；这些 ID 由服务端生成。
5. Hermes job 对外状态集合保持 `pending/running/completed/failed/timeout`；API 查询时以数据库记录为准。

### 4.1 Contract 权威与兼容映射

`data/contracts/*.contract.json` 当前是 example-shaped contract，不是严格 JSON Schema。E1 不因此把样例值当成 schema，但必须显式验证 contract 名称、版本、必需字段、嵌套结构和现有消费者依赖的语义。仅验证 HTTP 200 或数组非空不构成 contract 一致性证据。

| 接口 | 权威 contract / envelope | 版本 | E1 必须保持的内容 |
| --- | --- | --- | --- |
| `GET /api/sessions` | `src/web_ui/public/data/question_sessions/_index.json` | 1.0 | 顶层统计字段与 session summary 字段 |
| `GET /api/sessions/:upload_id` | `data/contracts/upload_meta.contract.json` | 1.1 | 全部顶层字段；暂无持久化数据可以返回 `null` 或空集合，但不能删键 |
| `GET /api/sessions/:upload_id/split` | `data/contracts/question_split_result.contract.json` | 1.1 | 顶层学科/处理字段、question 字段和 `errors` |
| `GET/POST /api/sessions/:upload_id/confirmation` | `data/contracts/question_confirmation_result.contract.json` | 1.1 | 顶层学科/确认字段和每条 confirmation 的完整字段 |
| `GET /api/findings/:batch_id` | `data/contracts/learning_findings.contract.json` | 1.0 | `source_refs`、finding 语义、memory/action/weekly-context candidates |
| `GET /api/findings` | E1 `learning_findings_index` envelope | 1.0 | `total`、`batches[]`，每批包含 id、student、subject、generator、time、count |
| `GET/POST /api/memories` | E1 `memory_decisions` envelope | 1.0 | `total`、`memories[]`，每条包含 identity、finding/batch、student/subject、decision、status/time |
| `GET /api/notes/:note_id`、`POST /api/notes` | `data/contracts/text_note.contract.json` | 1.1 | 完整 text-note 字段；ID 由服务端生成 |
| `GET /api/notes` | E1 `text_notes` envelope | 1.1 | `total` 和符合 `text_note` 的 `notes[]` |
| `GET /api/reports` | `data/contracts/week_reports_index.contract.json` | 1.1 | index 顶层字段和 report summary |
| `GET /api/reports/:report_id` | `data/contracts/weekly_report.contract.json` | 1.1 | 完整周报领域结果 |
| Hermes job 三个端点 | 现有 Hermes job API | 当前兼容版本 | job identity/type/status/mode/time/error；completed 时 result 可读取 |

E1 的最低可执行验证是在 smoke 中为上述响应增加 endpoint-specific 字段、版本和嵌套断言。是否把 example-shaped contract 转换为严格 JSON Schema 属于后续增强；在转换前不能声称已经完成 schema validation。

## 5. 边界和数据流

```text
Web UI（E2 才切换）
  -> REST API（E1 实现）
  -> SQLite schema
  -> 领域 JSON 响应

Hermes bash job（E5 前仍为 fixture）
  -> runtime/public/job_status/<job_id>.json
  -> API poller
  -> hermes_jobs 表
```

职责边界：

- `src/api/server.js` 负责 Express 启动、中间件和路由注册；具体路由可按模块拆分到 `src/api/routes/`。
- SQLite 访问层只使用 `better-sqlite3` 和原生 SQL，不引入 ORM。
- `runtime/` 继续保存本地运行生成文件，不提交真实数据。
- `src/web_ui/public/data/` 继续保存脱敏 demo；E1 不把数据库内容直接同步回 public 目录。

## 6. 当前阶段实施映射

### 6.1 健康检查

- `GET /api/health`：新增通用健康检查，返回 `status`、`mode`、`supported_jobs`、`database`、`version`。
- `GET /api/hermes/health`：保留现有兼容响应，前端在 E2 切换前继续使用。

### 6.2 Session / Question / Confirmation（#65）

- `GET /api/sessions?student_id=`：返回 session 索引。
- `GET /api/sessions/:upload_id`：返回 upload 元数据。
- `GET /api/sessions/:upload_id/split`：返回切题结果。
- `GET /api/sessions/:upload_id/confirmation`：返回确认结果。
- `POST /api/sessions/:upload_id/confirmation`：保存确认结果。

确认保存采用整批覆盖：

1. 在一个 transaction 中，按 `upload_id` 找到该批次全部 `question_id`；
2. 删除这些题目的旧确认记录；
3. 插入本次提交的 `confirmations`；
4. 若某条 `question_id` 不属于该 `upload_id`，返回 400 或 409，不写入部分数据。

### 6.3 Finding / Memory / Action（#66）

- `GET /api/findings?subject=&student_id=`：返回 finding batch 列表。
- `GET /api/findings/:batch_id`：返回单批 findings。
- `GET /api/memories?subject=&status=&priority=&student_id=`：查询 memory decisions。
- `POST /api/memories`：保存单条或批量 memory decisions。

Memory decision 采用 `(finding_id, finding_batch_id)` 唯一约束：重复提交更新而非插入。

E1 的 action candidates 先作为 finding 详情中的嵌套只读数据返回，与现有 `learning_findings/*.json` 结构一致；不单独提供 action 写接口，E5 再做行动建议的生成与确认。

### 6.4 Note / Report / Job（#67）

- `GET /api/notes?student_id=`：查询笔记列表。
- `GET /api/notes/:note_id`：查询单条笔记。
- `POST /api/notes`：创建笔记，`note_id` 由服务端生成并返回。
- `GET /api/reports?student_id=`：查询周报索引。
- `GET /api/reports/:report_id`：查询单份周报。

Hermes job 保持现有三个端点：

- `POST /api/hermes/jobs`
- `GET /api/hermes/jobs/:job_id`
- `GET /api/hermes/jobs/:job_id/result`

job 状态迁移采用方案 A：

1. `POST` 创建时写入 `hermes_jobs`；
2. bash 脚本继续写 `runtime/public/job_status/<job_id>.json`；
3. API 轮询状态文件变化后回写数据库；
4. `GET` 查询以数据库记录为准。

## 7. 失败与恢复

统一错误响应：

```json
{
  "error": "稳定错误码",
  "message": "人类可读描述"
}
```

关键失败路径：

- 请求体无效或字段缺失：返回 400，不创建记录。
- 资源不存在：返回 404。
- 资源冲突或确认结果中 `question_id` 不属于目标 upload：返回 409 或 400，不写入部分数据。
- 数据库写入失败：transaction 回滚，返回 500，数据库保持原状态。
- job 状态文件尚未出现：API 保持数据库中的 `pending`，按轮询继续等待；超时后写入 `timeout`。
- API 进程重启：poller 重启后继续读取已有状态文件，不要求重建 job。

## 8. 验收与证据

E1 验收至少覆盖：

- `node src/api/db/init.js` 建库成功；
- `node src/api/db/seed.js` 导入成功且可重复执行；
- `node src/api/scripts/smoke_api.mjs` 通过，覆盖 health、sessions、confirmations、findings、memories、notes、reports、job 创建/查询；
- 确认结果写入后重新查询或重启 API 仍存在；
- 无效输入返回稳定错误，不产生半完成记录；
- job 状态文件变化能回写 `hermes_jobs` 并通过 `GET` 查询。

评审要求把“能调用”和“符合设计”分开：

| 不变量 | 代表性证据 |
| --- | --- |
| Contract 兼容 | 对映射表逐 endpoint 检查 contract/version、必需字段和关键嵌套字段 |
| 持久化 | 写入 confirmation、memory、note，停止并重新启动 API 后读取相同值 |
| 原子写入 | 在同一批提交中混合合法与非法记录，确认响应失败且数据库无部分变化 |
| Job 数据库事实 | 创建 fixture job，等待 `completed`，确认状态文件回写 SQLite，重启 API 后状态与 result 仍可读取 |
| 稳定失败 | 覆盖 400、404、冲突/非法归属、job failed/timeout 中至少一个可控路径 |

`Proposed -> Implementing` 的设计 gate 由 #63 Architect review 记录。`Implementing -> Implemented` 需要 #65/#66/#67 的阻塞意见全部修复、上述证据通过，并在 #63 发布 E1 面向开发者的最终能力说明。

正式 `node --test` 回归测试不在 E1 引入，留到后续需要更细粒度回归时再加。

## 9. 接受的残余与延后能力

- 完整 bash job 链路仍在 Linux/macOS/WSL/VPS 验证，Windows 受 POSIX 路径限制。
- 前端继续使用静态 JSON；E2 才建立隔离的 `/demo` 静态线与 `/app` API-only 真实线。早期 E1 设想的同页面 static fallback 已被 V2 双线设计替代。
- 真实 Hermes 生成、CLI bridge 和 trace metadata 由 E5 处理。
- 多学生隔离、鉴权、审计和对象存储由 V3 处理。
- 真实文件上传和 OCR 不在 E1 范围内。

## 10. 需要 ADR 的决定

E1 不新增长期 ADR。SQLite + Express + 原生 SQL 的选择已由 ADR-017 覆盖；API 错误约定、服务端生成 ID 和 job 状态迁移属于 E1 实现细节。若未来这些约定需要跨版本长期保持，再提炼为新的 ADR。

## 11. 实现证据与最终能力说明

实现 gate 已通过 Architect Re-review（round 3，commit `a587ccd`）。

代表证据：

- endpoint-specific contract/version/required-key 断言通过；
- confirmation 与 memory 混合合法/非法批次均回滚，无部分写入；
- memory 的 student/subject/subject_label/statement 由服务端从引用 finding/batch 派生，客户端伪造值被忽略；
- confirmation、memory、note、completed job 与 result 跨 API 重启后保持；
- 带 stale pending 状态文件的 job 进入 `timeout`，正常 fixture job 进入 `completed`。

接受的残余：

- `data/contracts` 仍为 example-shaped JSON，未升级严格 JSON Schema；
- 完整 bash job 链路仍以 Linux/macOS/WSL/VPS 为最终验证环境；
- 前端 API-first、真实 LLM、多用户、PostgreSQL/COS 和 VPS 生产部署按 Roadmap 延后。
