# 部署

## 目标

计划部署目标是轻量级云服务器或 Docker 容器。服务器可以运行：

- 智能体运行时
- Webhook 或上传服务
- Web 前端应用
- Markdown/JSON 存储
- LLM 提供方集成

## 配置

所有提供方密钥和部署相关设置都应使用环境变量。

示例变量名：

- `HERMES_DATA_SOURCE`
- `HERMES_STORAGE_PROVIDER`
- `HERMES_API_PORT`
- `HERMES_JOB_MODE`
- `HERMES_DATA_DIR`
- `HERMES_PUBLIC_DATA_BASE_URL`
- `DATABASE_URL`
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`
- `RUNTIME_DATA_DIR`
- `WEB_UI_PORT`

不要提交真实值。本地值应保存在 `.env` 中，该文件已被 Git 忽略。

## 版本配置矩阵

Hermes 的产品大版本通过配置组合区分，不通过修改前端业务逻辑区分。

| 版本 | 数据源 | Job 模式 | 文件存储 | 数据库 | 主要用途 |
|---|---|---|---|---|---|
| 1.0 | `HERMES_DATA_SOURCE=static` | `HERMES_JOB_MODE=fixture` | `src/web_ui/public/data/` 或 `/var/www/html/data/` | 无必需数据库 | 静态全链路演示 |
| 2.0 | `HERMES_DATA_SOURCE=api` | `fixture` 或 `real` | `HERMES_STORAGE_PROVIDER=local` | `DATABASE_URL=sqlite:////var/lib/hermes/hermes.db` | 真实 API、可写入数据、LLM 接入 |
| 3.0 | `HERMES_DATA_SOURCE=api` | `real` | `HERMES_STORAGE_PROVIDER=cos` | PostgreSQL/MySQL | 多用户真实场景 |

1.0 示例：

```text
HERMES_DATA_SOURCE=static
HERMES_JOB_MODE=fixture
HERMES_PUBLIC_DATA_BASE_URL=/data
```

2.0 示例：

```text
HERMES_DATA_SOURCE=api
HERMES_STORAGE_PROVIDER=local
HERMES_API_PORT=8000
HERMES_JOB_MODE=real
HERMES_DATA_DIR=/var/lib/hermes/data
DATABASE_URL=sqlite:////var/lib/hermes/hermes.db
LLM_PROVIDER=deepseek
LLM_MODEL=...
```

3.0 示例：

```text
HERMES_DATA_SOURCE=api
HERMES_STORAGE_PROVIDER=cos
HERMES_JOB_MODE=real
DATABASE_URL=postgresql://...
TENCENT_COS_BUCKET=hermes-study-data
TENCENT_COS_REGION=ap-beijing
```

前端数据访问函数应优先读取 `/api/...`，在 API 不可用时回退到 `/data/...`。这个降级策略是 1.0 到 2.0 迁移期的开发保障；3.0 是否保留 demo fallback 需要另行评估。

## 运行时数据

生成的记录在本地开发时应写入 `runtime/`，在生产环境中应写入已配置的数据目录。

## Web 前端部署

Web 前端源码建议放在 VPS 的 `/opt/hermes/2026AgentApp/src/web_ui/`。构建后的静态文件部署到 `/var/www/hermes-web/`，由 Nginx 提供服务。

Hermes 生成的周报 JSON 建议放在 `/var/www/html/data/week_reports/`，由 Nginx 作为静态数据提供给前端读取。
