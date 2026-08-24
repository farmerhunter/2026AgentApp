# 更新日志（Changelog）

记录每个开发会话的主要改动，让团队成员（尤其不直接参与编码的人）快速了解"今天改了什么"。

## 记录规范

- 每次开发会话在**文件顶部**插入一条 `## YYYY-MM-DD` 条目。
- 条目内容：做了什么、改了哪些文件、验证结果、遗留事项。
- 关联 GitHub issue 编号（如 `#85`）。
- 推送代码时与改动一起提交，条目顺序与提交历史保持一致。

---

## 2026-08-25 — V2 E1–E6 架构重基线与终评风险约束

- 将 V2 明确为单 VPS 双线：`/demo` 冻结 V1 静态兜底，`/app` 承载 API-only 真实主线，禁止两条线静默混用。
- 重排顶层 Epic：E1 保留已完成 API 基础；E2 双线工作台；E3 教材知识底图；E4 练习/试卷 OCR 与错题确认；E5 Hermes 分析/记忆/周报；E6 VPS 部署与端到端验收。
- 新增 `docs/v2/development-guide.md`，用简洁语言向 David 说明目标、顺序、边界和 MVP。
- 新增 `docs/v2/hermes-runtime-and-skills.md`，定义 lab/runtime profile、非交互 CLI bridge、SQLite 产品记忆权威和快速 Skill 迭代方式。
- 新增 V3 延后能力清单，并以 ADR-020 至 ADR-024 记录双线、离线教材、OCR/人工确认、Hermes 和串行 job/R1 决策。
- GitHub 新增 E3 #87、E4 #88，并重写/重命名 #63/#68/#13/#69/#86 与 Project 属性、依赖关系。
- 验证：Markdown 本地链接、`git diff --check` 和 GitHub Project/Issue 对齐检查。

---

## 2026-08-24 — E1 Architect Review 与设计评审门槛（#63）

- 更新 `docs/epic-design-guidelines.md`：复杂 Epic 涉及 contract、持久化或异步状态时，要求接口—contract—版本—验证映射，并区分编码前设计评审与收口前实现一致性评审。
- 更新 E1 主设计文档：状态调整为 `Implementing`，补充 contract 权威映射、跨进程持久化、原子失败和 job 最终状态的验收矩阵。
- 更新 `docs/roadmap.md` 和 E1 Epic 当前状态，明确 #65/#66/#67 已进入实现评审而不是待开发。
- Architect review 结论采用 Epic 总评 + Child Issue 分项反馈：#63 保存整体不变量和收口 gate，#65/#66/#67 保存各自可执行修正。
- 本次只更新设计与 review 记录，不修改 David 的 E1 实现，不关闭 Issue，不改变 Project `In review` 状态。
- 验证：Markdown 本地链接检查与 `git diff --check` 通过。

---

## 2026-08-24 — E1 完成收尾（#63 / #65 / #66 / #67）

- Architect Re-review round 3 接受 E1 技术实现 gate（commit `a587ccd`）。
- 更新 `docs/v2/epics/e1-persistence-api.md`：状态改为 `Implemented`，补充最终能力说明和代表证据。
- 待推送后关闭 #65/#66/#67，最后关闭 #63，并将 GitHub Project 状态改为 Done。
- 清理本地 API smoke 产生的临时 SQLite 文件和 runtime 测试产物。

---

## 2026-08-24 — E1 Architect Re-review 修正（round 2）

- #66：新增 `weekly_context_candidates` 表与 seed，`GET /api/findings/:batch_id` 返回非空且含关键字段的 weekly-context candidates；`POST /api/memories` 的 student/subject/subject_label/statement 改为服务端从引用 finding/batch 强制派生，忽略客户端覆盖。
- #67：job reconciliation 现在对带 stale pending/running 状态文件的任务也按文件 mtime 超时；活跃 job poller 会 touch 状态文件避免误杀。
- smoke：补充 weekly-context 非空/字段断言、memory 对抗性客户端 metadata 断言、带 pending 状态文件的 stale job reconciliation 断言，并让 created job 等待最终态后在重启后校验相同状态。
- 本地验证：JS 语法检查通过；完整两阶段 API smoke 全部通过。

---

## 2026-08-24 — E1 Architect Review 修正（#63 / #65 / #66 / #67）

- #65：split/confirmation 对齐 contract 1.1，补齐 `subject`、`subject_label` 与 confirmation item 学科字段；修正 `GET /api/sessions?student_id=` 的统计范围。
- #66：finding detail 补齐 `weekly_context_candidates`；`POST /api/memories` 从被引用 finding/batch 派生 student/subject/statement metadata。
- #67：新建 note 默认 `visibility=private`，并校验允许值；新增 Hermes job 启动 reconciliation，未终止且过期 job 会进入 `timeout`。
- 更新 `src/api/scripts/smoke_api.mjs`：增加 endpoint-specific contract/version/required-key 断言、atomic failure 断言、API 重启持久化验证、synthetic completed job/result 验证和 stale job reconciliation 验证。
- 统一 Hermes job 错误响应为稳定 `error` + 人类可读 `message`。
- 本地验证：JS 语法检查通过；完整两阶段 API smoke 全部通过。

---

## 2026-08-24 — E1 #67 Note/Report API 与 Hermes Job 数据库迁移本地实现（#67）

- 新增 `src/api/routes/notes.js`：笔记列表、单条查询与创建；`note_id` 由服务端生成。
- 新增 `src/api/routes/reports.js`：周报索引与单份周报查询，单份报告读取公开 demo 文件。
- 更新 `src/api/server.js`：Hermes job 状态写入 `hermes_jobs` 表，bash 状态文件仍作为桥接，API 轮询后回写数据库；`GET /api/hermes/jobs/:job_id` 以数据库为准。
- 修复 job 子进程启动失败导致服务器崩溃的问题：`spawn("bash")` 的 `error` 事件会稳定写为 `failed` 状态。
- 扩展 `src/api/scripts/smoke_api.mjs`，覆盖 notes、reports 与 job 状态查询。
- 本地验证：JS 语法检查通过；扩展后的 API smoke 全部通过。
- 遗留事项：尚未 commit/push，等待开发者说“上传 GitHub”。

---

## 2026-08-24 — E1 #66 Finding/Memory/Action API 本地实现（#66）

- 新增 `src/api/routes/findings.js`：实现 finding batch 列表、单批 findings、memory decisions 查询与批量 upsert。
- `GET /api/findings/:batch_id` 返回嵌套 `memory_candidates` 与 `action_candidates`，兼容现有 learning findings JSON。
- `POST /api/memories` 按 `(finding_id, finding_batch_id)` 唯一约束更新或插入；不存在 finding 时返回 400。
- 扩展 `src/api/scripts/smoke_api.mjs`，覆盖 findings、memories、写入回读和非法 finding 错误路径。
- 本地验证：JS 语法检查通过；扩展后的 API smoke 全部通过。
- 遗留事项：尚未 commit/push，等待开发者说“上传 GitHub”。

---

## 2026-08-24 — E1 #65 Session/Question/Confirmation API 本地实现（#65）

- 新增 `src/api/routes/sessions.js`：实现 session 索引、upload 元数据、split、confirmation 查询与确认结果批量覆盖写入。
- 更新 `src/api/server.js`：挂载 `/api` 路由，并新增通用 `/api/health`。
- 更新 `src/api/db/seed.js`：demo 数据内部 `student_id` 统一规范为 `student_demo`，与 E1 设计文档一致。
- 新增 `src/api/scripts/smoke_api.mjs`：覆盖 health、sessions、split、confirmation 写入/回读、400 与 404 错误路径。
- 本地验证：JS 语法检查通过；`npm ci` 安装 API 依赖；smoke 全部通过。
- 验证结果：`GET /api/sessions` 返回 2 个 session；confirmation 写入后重新读取仍存在；非法 question_id 返回 400；不存在 upload 返回 404。
- 遗留事项：尚未 commit/push，等待开发者说“上传 GitHub”。

---

## 2026-08-23 — E1 设计文档按新规范重写（#63）

- 同步远端 `a0ff284`，采用新文档架构：`design_docs/` 已迁入 `docs/v1/`，V2 复杂 Epic 使用 `docs/v2/epics/`。
- 按 `docs/epic-design-guidelines.md` 新建 `docs/v2/epics/e1-persistence-api.md`，写入 E1 的成果、范围、基线、不变量、失败恢复、实现映射和验收。
- 将已确认的 6 项 E1 决策落实到新文档：job 状态方案 A、确认结果按 upload 整批覆盖、服务端生成 note/report ID、默认单学生、双 health 端点、先做 API smoke。
- 更新 `docs/v2/README.md`，增加 E1 设计文档入口。
- 验证：Markdown 未做构建级检查；本地文件结构符合 `docs/epic-design-guidelines.md` 的位置和命名要求。尚未 commit/push。

---

## 2026-08-23 — 版本化设计文档与 Epic 设计规范（#85）

- 将历史 `design_docs/` 按用途整理到 `docs/v1/`，并增加 V1 能力边界与导航。
- 初始化 `docs/v2/` 和 `docs/v3/`，分开维护当前架构、实施入口与未来方向。
- 新增 `docs/README.md` 作为统一文档入口，新增 `docs/epic-design-guidelines.md`，明确复杂 Epic 可以由 owner 自主建立独立设计文档，普通实现无需增加长文档审批。
- 将长期技术决策迁移到 `docs/decisions/architecture-decisions.md`，同步更新 README、路线图、交付材料、prompt 和 skill 中的旧路径。
- 合并保留远端最新的 E0 验收记录、Quickstart、seed 幂等修复说明和 AI 上传协议；补充终评提交收尾 Epic #86 与 V3 方向。
- 验证：Markdown 本地链接检查通过，未发现残留 `design_docs` 路径，`git diff --check` 通过。本次仅调整文档和文档引用，未运行应用构建。
- 遗留事项：无。

---

## 2026-08-23 — E0 验收：从零跑通（#85）

按照 `docs/quickstart.md` 模拟新开发者从零执行：在临时目录建立干净仓库副本（无依赖、无产物），逐步验证 Web UI、数据库、API 与页面。

- ✅ Web UI：`npm install` → `npm run build`（首次遇到 Rollup 原生模块问题，按 quickstart 排查表修复后成功）→ `validate:data` 120/120。
- ✅ 数据库：`init.js` 建库 13 张表；`seed.js` 连续执行两次行数不变（seed 幂等修复在全新环境生效）。
- ✅ API：健康检查、job 创建、状态查询、状态文件落位全部通过（验收使用 8001 端口）。
- ✅ 页面：dev server HTTP 200，React 入口正常加载。
- ⚠️ 已知遗留：完整 job 链路需在 Linux/macOS/WSL 补跑 `smoke_test_jobs.sh` 3/3；8/22 的旧 API 服务（PID 20304）仍占用 8000 端口，需管理员终端结束或重启。
- 📄 验证详情已记录到 `docs/roadmap.md` 附录 A.5。
- ✅ GitHub issue 对齐完成：#85 已发布 E0 验证评论；#12/#15/#16 移入 v3.0 里程碑；#17/#18/#19/#23 已确认带 `type:deliverable` 标签；E1–E4 依赖关系已建立（#63 ← #68/#13/#69，见仓库 issue）。
- ✅ 协作约定：新增「与 AI 协作的 Git 上传协议」（CONTRIBUTING.md）——说「上传GitHub」时自动执行 add/commit/pull/merge/push，冲突时先询问。
- ✅ 修正两个问题：① 提交作者名统一为 GitHub 用户名 `LaoLiuHaHaHaHaXiao`（历史提交已重写并强推）；② #85 评论乱码已删除并用 UTF-8 重新发布。已加 git 钩子校验提交身份，并在 CONTRIBUTING.md 记录 UTF-8 规则，防止再犯。

---

## 2026-08-22 — E0：v2 基线与协作启用（#85）

今天是 v2 开发的开工日，按 E0 计划完成了本地基线验证与协作文档。

### 基线验证结果

- ✅ Web UI：`npm install` + `npm run build` 通过（vite 6.4.2）；`validate:data` 120/120 通过。
- ✅ SQLite：`init.js` 建库成功（13 张表）；`seed.js` 样例导入成功。
- ✅ API：`/api/hermes/health` 正常；三种 job（教材摘要/学习洞察/周报）的创建、状态查询、结果接口全部验证通过。

### 代码修复

- 🔧 `src/api/db/seed.js`：修复 `action_candidates` 表重复导入时行数翻倍的幂等缺陷（该表无唯一键，`INSERT OR IGNORE` 失效）；改为按 `finding_id` 先删后插，重复执行 seed 行数稳定（验证：两次导入后仍为 5 条）。

### 新增文档

- 📄 `docs/roadmap.md`：v2 路线图（E0–E4 目标、范围、完成标准、依赖顺序、E0 验证记录、遗留 issue 归属建议）。
- 📄 `docs/quickstart.md`：本地快速开始指南（首次运行 5 步 + 常见问题排查表）。
- 📄 `CHANGELOG.md`：本文档。

### 文档更新

- ✏️ `README.md`：更新"当前进展"（v1 完成、v2 启动），文档入口增加 roadmap 与 quickstart 链接。

### 环境与已知限制

- 本机无系统级 Node/Git，已用便携版工具链完成验证（Node v22.22.2、Git 2.47、Python 3.12，与 VPS 版本对齐）。
- ⚠️ job runner 脚本（bash + python3，POSIX 路径）在 Windows 本地**无法完整运行**（python3 校验步骤打不开 `/c/...` 路径，中文路径会乱码）；完整 job 链路需在 Linux/macOS/WSL 验证（VPS 上 v1 已通过 smoke test 3/3，见 issue #14）。
- ⚠️ Windows 构建需注意 Rollup 原生可选依赖缺失问题，处理方式已写入 quickstart。

### E0 收尾待办

- [ ] GitHub issue 依赖与里程碑对齐（#12/#15/#16 → v3.0；#17/#18/#19/#23 → 线下交付物标签）
- [ ] 推送本日改动到 `main`（README、docs/、seed.js、CHANGELOG）
- [ ] 找一名新开发者按 `docs/quickstart.md` 从零跑通一次，作为 E0 验收
