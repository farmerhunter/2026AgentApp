# 更新日志（Changelog）

记录每个开发会话的主要改动，让团队成员（尤其不直接参与编码的人）快速了解"今天改了什么"。

## 记录规范

- 每次开发会话在**文件顶部**插入一条 `## YYYY-MM-DD` 条目。
- 条目内容：做了什么、改了哪些文件、验证结果、遗留事项。
- 关联 GitHub issue 编号（如 `#85`）。
- 推送代码时与改动一起提交，条目顺序与提交历史保持一致。

---

## 2026-08-31 — 仿真练习补充教师批改（#13）

- 在两批练习逐题补充模拟红笔勾叉、部分得分和少量订正要求，增加卷首总分及卷末批改记录；每题 5 分，两卷均为 39/50。
- 同步材料入口和人工核对说明：教师批改与学生作答分层、部分得分题仍需确认、评分规则一致；不预写深层错因、学生订正或复批，B09 保留无过程。
- 验证：20 题批改标记/分数与参考一致，分项及总分加总一致，原始题干和作答保留、本地链接及 `git diff --check`。仅材料自查，不是独立复核或模型验收。
- 遗留：当前仍是文字/制图说明，未制作试卷图片、运行 OCR/Hermes 或新增产品 UI。通过原设计 PR #99 继续同步。

## 2026-08-31 — E5 两批仿真练习文字稿（#13）

- 新增 `experiments/hermes-quality/two-batch-learning-fixture/`：两批各 10 题及模拟作答、独立人工核对说明和使用入口；每批 4 道选择、4 道填空、2 道解答，二次根式与一次函数各 5 题。
- 重点错题为 A06/A09/A10、B06/B09/B10，分别支持根式加法重复、函数求解步骤局部改善、单次乘积错误和只有答案时的判断边界；不预填 findings、记忆或周报。
- 验证：20 题逐题推导、本地算术与 8 道选择题检查、20 行参考答案与 6 道故意错误一致性、B09 无过程保留、本地链接及 `git diff --check`。这是编写会话自查，不是独立教师复核。
- 遗留：材料拟真程度待用户审阅；图片/OCR、真实 Hermes、记忆与周报、产品保存/展示均未在本轮执行。设计及材料通过既有 PR #99 同步，E5 不因此关闭或视为验收通过。

## 2026-08-31 — E5 用户向核心设计与周报边界（#13）

- 新增 `docs/v2/epics/e5-hermes-learning-analysis.md`，面向 David 和评委解释错题分析、记忆复用、周报综合的价值、策略和取舍。
- 同步文档入口、架构、运行与质量设计、开发指南和实施计划：两批各 10 题、约 6 道重点错题；周报同时读取 findings 与对应作答，记忆候选只从错题分析产生。
- 在 V3 延后清单记录行动—反馈—调整闭环、按效果修正记忆和稳定学习趋势的后续设计方向。
- 验证：文档一致性自查、本地 Markdown 链接检查、`git diff --check`；本次不修改产品代码、不调用模型、不操作 VPS，E5 仍待实现和验收。

## 2026-08-30 — 共同维护者平权与 E4 自主交付规划（#88 / #93 / #94）

- 明确项目负责人和 David 是权限平等的共同维护者；David 可以独立完成未来 Epic 的设计、实现、测试、VPS/Hermes 运维、合并、部署、发布和收尾。
- 将独立 Architect/Final Gate 从权限门槛改为按风险选用的质量复核；高影响工作保留对所有维护者一致的留痕、脱敏、验证和恢复责任。
- 更新 `CONTRIBUTING.md`、Epic 协作规范、Epic 设计规范、快速开始和文档入口；E4 当前执行规划与 VPS/OCR 支持信息同步到 #88/#93/#94。
- 验证：`git diff --check`、治理措辞检索、GitHub Issue/Project 属性和 VPS `hermes` session 只读核查。

## 2026-08-27 — E3 教材知识底图实现（#87）

- 新增 `data/contracts/textbook_knowledge_map.contract.json`，定义版本化 `(map_id, map_version)` 知识地图契约。
- 新增 `data/knowledge_maps/renjiao_math_grade8_v2/1.0.0.json`：全册五章目录，重点细化第 16 章二次根式与第 19 章一次函数；来源身份与重点章节已由项目负责人确认。
- 新增 `src/api/scripts/validate-knowledge-map.mjs`，校验必填字段、ID 唯一性、版本路径、状态/coverage 和悬空引用。
- 在 `src/api/db/schema.sql` 新增 `knowledge_map_registry`，只保存版本身份、artifact 定位、hash 和 current 状态，不复制节点内容。
- 新增 `src/api/scripts/promote-knowledge-map.mjs`，按 `BEGIN IMMEDIATE -> 降旧 current -> upsert 新 current -> commit` 顺序原子切换。
- 新增 `src/api/routes/knowledgeMap.js` 并注册，提供 current/chapters/points 四类只读 API。
- 新增 `src/api/scripts/smoke-knowledge-map.mjs` 和 E4/E5 consumer fixtures，验证正确引用成功、错误版本/未知 ID 被拒绝、非法 filter 返回 400。
- 验证：`validate:knowledge-map` 208/208；`smoke:knowledge-map` 通过；`npm run build` 通过；`npm run validate:data` 120/120；`node --check` 通过。
- 首版 `1.0.0` 已完成人工抽样，`review_status=reviewed`；未来新版本仍需抽样。

## 2026-08-26 — Final Gate 后的 Epic 端到端收尾授权

- 更新 `docs/epic-collaboration-protocol.md`：普通 Epic 在独立 Final Gate 绑定 exact head 并通过后，由 David 完成 merge、远端核验、状态整理和 Epic closure，不再逐次等待项目负责人批准机械收尾。
- 保留 Human Gate：产品取舍、Human trial、隐私/安全、secret、外部费用、数据迁移、生产部署、release、E6/终评收口以及 destructive operation 仍需明确决定。
- 更新 `CONTRIBUTING.md`，使 Git push/Issue closure 规则与上述受控站立授权一致。
- 验证：Markdown diff 和 `git diff --check`；E2 #68 / PR #95 将作为首个按新规则交由 David 收尾的 Epic。

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

## 2026-08-25 — E2 Final Gate 修正（#68）

- 重新生成 `src/web_ui/package-lock.json` 并加入 Windows Rollup/ESBuild 原生依赖；`npm ci --ignore-scripts` 与 `npm run build` 均通过。
- 新增 `src/web_ui/src/lib/demoJobs.js`，将 demo job runner 与 appApi 完全解耦；demo 相关组件不再 import `appApi.js` 或 `hermesJobs.js`。
- `/app` 四个页面补充子请求 loading/error/retry：import 的 split/confirmation、analysis 的 finding detail/memories、report detail 均会进入 failed，并提供重试。
- 修复 empty 时隐藏 E4/E5 `not_ready` 的问题；action-level not_ready 与列表 empty 独立展示。
- 本地验证：`npm ci --ignore-scripts` 通过；`npm run build` 通过；`npm run validate:data` 120/120；Vite 路由 200。

---

## 2026-08-25 — E2 实现进行中（#68）

- Architect Gate `accepted`，开始在 `epic/68-dual-entry-ui` 实现 E2。
- 引入 `react-router-dom`，建立 `/demo` 与 `/app` 双路由树。
- 拆分 `demoApi.js` 与 `appApi.js`，删除混合数据层 `api.js`。
- `/demo` 移除 Hermes mode switch，保持 static-only。
- 新增 `/app` 四页骨架：overview、import、analysis、report。
- 新增 `NotReadyState`、`SavedState` 状态组件。
- 本地验证：`npm run validate:data` 120/120；`npm run build` 通过；Vite dev server 各路由返回 200。

---

## 2026-08-25 — E2 设计文档（#68）

- 按 `docs/epic-design-guidelines.md` 新建 `docs/v2/epics/e2-dual-entry-ui.md`。
- 设计 `/demo` 与 `/app` 双路由、四页真实工作台骨架、demoApi/appApi 数据访问边界和失败状态。
- 更新 `docs/v2/README.md`，加入 E2 设计文档入口。
- 按 Architect Gate 意见补齐 transport 边界、四页 E1 endpoint 映射、状态语义和路由/Network 验收证据，并提交到 Epic 分支待复审。

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
