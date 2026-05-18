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

- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`
- `RUNTIME_DATA_DIR`
- `WEB_UI_PORT`

不要提交真实值。本地值应保存在 `.env` 中，该文件已被 Git 忽略。

## 运行时数据

生成的记录在本地开发时应写入 `runtime/`，在生产环境中应写入已配置的数据目录。

## Web 前端部署

Web 前端源码建议放在 VPS 的 `/opt/hermes/2026AgentApp/src/web_ui/`。构建后的静态文件部署到 `/var/www/hermes-web/`，由 Nginx 提供服务。

Hermes 生成的周报 JSON 建议放在 `/var/www/html/data/week_reports/`，由 Nginx 作为静态数据提供给前端读取。
