# 本地快速开始指南

> 目标：一个新开发者拿到本仓库后，能在 30 分钟内完成首次本地运行，并跑通全部可验证的基线。
> 完整计划见 [roadmap.md](roadmap.md)。

## 1. 环境要求

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | 22.x（开发验证使用 v22.22.2） | 前端构建、API、校验脚本 |
| npm | 10.x | 依赖管理 |
| bash + python3 | macOS/Linux 自带；Windows 需 Git Bash/WSL | Hermes job runner 脚本（仅 Linux/macOS 完整支持） |

> ⚠️ Windows 注意：
> - job runner 脚本以 POSIX 路径方式调用 python3，在 Windows + Git Bash + 原生 python3 下无法完整运行（见 [roadmap.md](roadmap.md) 附录 A.3）。Web UI、SQLite、API 表面均可在 Windows 验证。
> - 仓库路径请避免使用非 ASCII 字符，否则 MSYS 路径转换可能乱码。

## 2. 首次运行（5 步）

### 第 1 步：Web UI

```bash
cd src/web_ui
npm install
npm run build        # 构建通过 = 前端基线 OK
node scripts/validate-demo-data.mjs   # 120 项数据校验
```

需要手动浏览界面时：

```bash
npm run dev -- --host 127.0.0.1
```

### 第 2 步：数据库

```bash
cd src/api
npm install
node db/init.js      # 创建 hermes.db 与 13 张表
node db/seed.js      # 导入脱敏样例数据（可重复执行，幂等）
```

### 第 3 步：API

```bash
cd src/api
npm start            # 默认 http://localhost:8000
```

健康检查：

```bash
curl http://localhost:8000/api/hermes/health
```

### 第 4 步：Hermes job（Linux/macOS）

```bash
cd src/agent/jobs
bash smoke_test_jobs.sh    # fixture 模式 3/3 通过
```

通过 API 触发单个任务：

```bash
curl -X POST http://localhost:8000/api/hermes/jobs \
  -H 'Content-Type: application/json' \
  -d '{"job_type":"weekly_report","week_start":"2026-05-18","week_end":"2026-05-24"}'
```

### 第 5 步：浏览器验收

打开 `http://localhost:5173`（前端 dev server）或 `http://localhost:8000` 检查五个主视图：首页、学习成果、输入备注、历史周报、学习内容。

## 3. 常见问题排查

| 现象 | 原因 | 处理 |
|---|---|---|
| `npm run build` 报 `MODULE_NOT_FOUND ... rollup/dist/native.js` | Windows 下 Rollup 原生可选依赖未装（v1 issue #14） | `npm install --no-save @rollup/rollup-win32-x64-msvc@4.60.4` |
| `npm install` 时 better-sqlite3 走 node-gyp 编译失败 | 预编译二进制下载失败 | Windows 设置 `npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3` 后重装 |
| job 一直 pending 且 `runtime/public/job_status` 无 completed 文件 | Windows 下 bash 脚本 POSIX 路径与原生 python3 不兼容 | 在 Linux/macOS/WSL 中运行 job；Windows 只验证 API 表面 |
| `validate-demo-data.mjs` 报错 | demo 数据与契约不一致 | 检查 `data/` 与 `src/web_ui/public/data/` 是否同步 |

## 4. 贡献流程

1. 从当前 Milestone/Epic 的目标出发；若已有 GitHub Issue，先确认目标、验收标准和相关设计文档；
2. 改动前跑一遍本指南第 2 节的基线命令，确认环境可用；
3. 保持 commit 聚焦，一次 commit 只表达一个逻辑变化；
4. 产品边界、跨模块架构、contract、prompt、skill、demo flow 或部署方式发生实质变化时，按 [`docs/README.md`](README.md) 更新相应文档；
5. Push 后在 issue/PR 记录变更和验证结果；负责维护者完成 self-review、远端核验和 Project 状态同步后可自主合并并关闭，独立 review 按风险选用（见 [CONTRIBUTING.md](../CONTRIBUTING.md)）。
