# 更新日志（Changelog）

记录每个开发会话的主要改动，让团队成员（尤其不直接参与编码的人）快速了解"今天改了什么"。

## 记录规范

- 每次开发会话在**文件顶部**插入一条 `## YYYY-MM-DD` 条目。
- 条目内容：做了什么、改了哪些文件、验证结果、遗留事项。
- 关联 GitHub issue 编号（如 `#85`）。
- 推送代码时与改动一起提交，条目顺序与提交历史保持一致。

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
