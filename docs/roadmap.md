# 学途智伴 v2 路线图

> 本文档是 v2 开发的统一计划入口，与 GitHub 仓库的 Epic issue 和 Milestone 保持一致。
> 关联 issue：[#85 E0](https://github.com/farmerhunter/2026AgentApp/issues/85)、[#63 E1](https://github.com/farmerhunter/2026AgentApp/issues/63)、[#68 E2](https://github.com/farmerhunter/2026AgentApp/issues/68)、[#13 E3](https://github.com/farmerhunter/2026AgentApp/issues/13)、[#69 E4](https://github.com/farmerhunter/2026AgentApp/issues/69)

## 1. 版本总览

| 版本 | 里程碑 | 状态 | 说明 |
|---|---|---|---|
| v1.0 | v1.0 Static Demo | ✅ 已完成（2026-05） | 静态全链路演示：Web UI + `/data/` JSON + fixture job 链路，无真实 LLM |
| v2.0 | v2.0 Real AI + API | 🔄 进行中（自 2026-08） | 持久化 API + 真实 LLM 生成闭环 + VPS 稳定运行 |
| v3.0 | v3.0 Multi-user Production | 📋 规划中 | 多用户、权限与数据隔离、COS + PostgreSQL 演进 |

## 2. v2.0 Epic 一览

v2.0 由 5 个 Epic 组成，按依赖顺序执行：

```text
E0 基线与协作启用
  └─> E1 持久化学习数据 API
        └─> E2 Web API 优先与静态降级
              └─> E3 真实 Hermes 生成闭环
                    └─> E4 v2 发布与运行
```

### E0：v2 基线与协作启用（#85）

- **目标**：开发者可以在本地复现项目、验证基线，并自行开始 v2.0 开发。
- **范围**：
  - 验证 Web UI、API、fixture Hermes job 与 SQLite init/seed 的基线；
  - 对齐陈旧文档、Milestone、Issue 依赖与当前代码；
  - 让新开发者按仓库文档完成首次本地运行和贡献。
- **完成标准**：路线图与 GitHub Epic 一致；本地启动与验证路径可重复。
- **非目标**：不扩展业务功能、不接入真实 LLM、不做 VPS 发布。
- **本 Epic 产出**：`docs/roadmap.md`、`docs/quickstart.md`、README 更新、基线验证记录（见附录 A）。

### E1：持久化学习数据 API（#63）

- **目标**：SQLite 与 REST API 能保存并查询学习过程，替代纯静态只读数据。
- **范围**：
  - Session、题目与人工确认（#65）；
  - Finding、memory decision 与 action candidate（#66）；
  - 备注、周报与 Hermes job 状态的数据库化（#67）。
- **完成标准**：保存确认、备注和记忆决策后刷新不丢失；API 响应兼容既有 JSON contract。
- **子 Issue 状态**：#64 数据库 schema 与样例 seed ✅ 已完成；#65/#66/#67 🔄 待开发。

### E2：Web API 优先与静态降级（#68）

- **目标**：前端在 API 可用时读写真实数据；API 不可用时仍可完成 v1.0 静态演示。
- **范围**：统一 API-first / static-fallback 数据访问；接入确认保存、记忆决策和备注创建；显示加载、保存失败和 API 不可用状态。
- **完成标准**：两种模式可独立验证；后端暂不可用时，前端不失去演示能力。
- **依赖**：E1（#63）的持久化 API。

### E3：真实 Hermes 生成闭环（#13）

- **目标**：Hermes 基于真实输入生成可追溯的 finding、待确定记忆、行动建议和周报。
- **范围**：保留 fixture 模式用于回归；接入真实 LLM，写入前校验输出 contract；管理 job 的 pending/running/completed/failed 与 timeout 状态；记忆候选必须经人工接受、忽略或调整后才成为稳定记忆。
- **完成标准**：从材料确认到周报的完整链路可重复运行；LLM 失败不会损坏已有数据。
- **依赖**：E1（#63）的持久化 API 与 E2（#68）的前端读写路径。

### E4：v2 发布与运行（#69）

- **目标**：v2 能在 VPS 稳定运行，且真实数据不暴露在公开静态目录。
- **范围**：API 的 systemd 运行与 Nginx 反向代理；`/data/` 仅保留脱敏 demo，真实文件和运行记录放入私有目录；备份、恢复和线上 smoke test。
- **完成标准**：部署后可完成一次真实写入和 Hermes job；服务重启后数据与服务可恢复。
- **依赖**：E1、E2 与 E3。

## 3. Milestone 与 Issue 依赖对齐

- v1.0 里程碑：已关闭（4 个 issue，全部完成）。
- v2.0 里程碑：挂载 5 个 Epic（#85、#63、#68、#13、#69），其中 #64 已完成、#65/#66/#67 属于 E1。
- 依赖关系（GitHub issue dependency）：
  - #68 依赖 #63；#13 依赖 #63 与 #68；#69 依赖 #63、#68、#13。✅ 已于 2026-08-23 在 GitHub 上建立并核验（#63 blocking=3；#68 blocked_by=1；#13 blocked_by=2；#69 blocked_by=3）。
  - E0（#85）无前置依赖，已进入收尾验收。
- 遗留 issue 归属（2026-08-23 已执行）：
  - #12/#15/#16 → v3.0 里程碑（规划类）；
  - #17/#18/#19/#23 → 已确认带 `type:deliverable` 标签（线下比赛交付物）。

## 4. 遗留 open issue 的归属建议

| Issue | 标题 | 归属建议 |
|---|---|---|
| #12 | 规划微信端和长期存储演进 | 规划类，并入 v3.0 里程碑 |
| #15 | 设计 Tencent QuestionSplitOCR 集成 | 规划类，并入 E3（真实链路需要真实切题） |
| #16 | 设计上传服务或 Webhook | 规划类，并入 E1/E4（真实上传依赖持久化 API） |
| #17/#18/#19/#23 | 比赛技术文档、演示视频、公开链接、创作者声明 | 线下比赛交付物，不占 v2 开发里程碑，状态保持 open 直至比赛提交 |

## 5. 非目标与纪律

- 不在任一 Epic 中提交真实学生数据、API Key 或未脱敏素材。
- fixture 模式永久保留，作为回归基线；real 模式输出必须过 contract 校验才能落盘。
- 单次上传只产生 finding；insight 必须跨多次证据合并；记忆候选必须人工确认。

## 6. 终评提交收尾

终评提交收尾是独立 Epic [#86](https://github.com/farmerhunter/2026AgentApp/issues/86)。它延续 v1.0 已完成的技术和演示成果，用于准备终评材料，不计入 v2 产品能力范围。

- 技术文档与架构图；
- 两分钟以内的产品演示视频；
- 稳定、脱敏的公开作品链接；
- 创作者声明与最终隐私合规检查。

完成标准：终评材料能独立说明产品价值、演示完整流程，且不包含真实学生隐私、密钥或内部材料。

## 7. v3.0 未来方向

v3.0 只在 v2 的真实单学生闭环稳定后启动：E5 负责多用户、角色授权、数据隔离和审计；E6 负责私有对象存储、PostgreSQL 迁移、后台队列、监控、备份恢复和成本控制。详细入口见 [`v3/README.md`](v3/README.md)。

## 8. 与设计文档的关系

路线图表达版本和 Epic 成果，版本架构表达跨 Epic 边界，数据 contract 表达机器可校验结构，GitHub Issue 表达具体工作。工程文档统一从 [`README.md`](README.md) 进入。

具有合适复杂度的 Epic 可以建立独立设计文档，用于承载跨模块设计、持久化或 migration、API/data contract、重大失败处理，以及多人或多 Agent 交接上下文。判断标准、推荐结构和维护方式见 [Epic 设计文档规范](epic-design-guidelines.md)。普通实现步骤无需为满足流程而新增长篇设计文档。

## 附录 A：E0 基线验证记录（2026-08-22）

### A.1 Web UI

- ✅ `npm install` 成功（129 包）
- ✅ `npm run build` 成功（vite 6.4.2，52 模块）
- ✅ `npm run validate:data` 120/120 通过
- ⚠️ Windows 已知问题：Rollup 原生可选依赖可能缺失，需手动 `npm install --no-save @rollup/rollup-win32-x64-msvc@4.60.4`（对应 v1 issue #14）

### A.2 SQLite

- ✅ `node db/init.js` 建库成功（13 张表）
- ✅ `node db/seed.js` 种子导入成功（students/uploads/questions/confirmations/findings/memory/actions/notes/reports/focus records）
- ✅ 幂等性：修复 action_candidates 重复导入缺陷后，重复 seed 行数稳定（[seed.js](../src/api/db/seed.js) 增加按 finding_id 先删后插）

### A.3 API 与 fixture job

- ✅ `GET /api/hermes/health` 正常（fixture 模式）
- ✅ `POST /api/hermes/jobs` 支持三种 job type；状态文件写入 `runtime/public/job_status/`
- ✅ `GET /api/hermes/jobs/:job_id` 与 `/result` 行为符合契约
- ⚠️ Windows 限制：job runner 为 bash + python3 脚本，路径按 POSIX 生成（macOS/Linux 原生），在 Windows + MSYS + 原生 python3 下输出校验步骤无法打开 `/c/...` 路径；**完整 job 链路请在 Linux/macOS（或 WSL/容器）验证**，VPS 上 v1 已通过 smoke test 3/3（issue #14）

### A.4 建议的后续修复（新 issue 候选）

1. `seed.js` 幂等修复已合入本仓库副本（E0 范围内）。
2. Windows 下 job 脚本 POSIX 路径兼容（可选，若要让 Windows 本地跑通 job 链路）。

### A.5 从零验收记录（2026-08-23）

验收方法：在临时目录创建干净仓库副本（无 node_modules / dist / 数据库文件），模拟新开发者严格照 docs/quickstart.md 逐步执行。

- 第 1 步 Web UI：✅ `npm install` 129 包；`npm run build` 首次失败（Rollup 原生模块），按 quickstart 排查表修复后构建成功（23s）；`validate:data` 120/120。
- 第 2 步 数据库：✅ `init.js` 建库 13 张表；`seed.js` 导入成功；连续执行两次 seed 后行数不变（action_candidates 稳定 5 条，幂等修复在全新环境生效）。
- 第 3 步 API：✅（部分）健康检查正常；job 创建 202 + 状态查询 + 状态文件落位全部通过；完成态在 Windows 受已知限制（见 A.3）。
- 第 5 步 页面：✅ dev server 返回 HTTP 200，React 入口（#root）正常加载；真实浏览器渲染留待人工确认。

结论：

- Windows 本地可验证路径已全部跑通，quickstart 步骤与排查表有效；
- 剩余一项严格验收：在 Linux/macOS（或 WSL/容器）执行 smoke_test_jobs.sh 确认 fixture 3/3；
- 注意：8/22 启动的旧 API 服务（PID 20304）仍占用 8000 端口且权限较高，需在管理员终端 taskkill /F /PID 20304 或重启后释放；验收改用 8001 端口完成。
