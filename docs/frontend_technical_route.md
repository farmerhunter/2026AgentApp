# Hermes Web 前端技术路线讨论结论

本文档整理 Hermes Web 前端开发、部署和页面生成方式的讨论结论，用于后续评审和实施决策。

## 1. 总体结论

Hermes Web 前端建议采用渐进式路线：

1. 演示阶段可以使用静态 JSON 文件作为数据源。
2. 前端页面可以先用 Vite + React 开发。
3. 构建后的静态文件由 VPS 上的 Nginx 提供服务。
4. Hermes 每周生成的周报 JSON 放在服务器固定目录中。
5. Web 前端通过 `fetch()` 读取索引文件和对应周报文件并渲染页面。
6. 长期阶段再从静态 JSON 迁移到数据库 + REST API。

简化架构：

```text
Hermes 技能 -> 周报 JSON -> VPS 静态目录 -> Nginx -> React 前端渲染
```

长期架构：

```text
Hermes 技能 -> 数据库 -> REST API -> React 前端渲染
```

## 2. Codex、Vite、React 的关系

Codex、Vite、React 分别承担不同职责：

```text
Codex: 编程助手，负责编写、修改、调试和部署辅助
Vite: 前端开发服务器和构建工具
React: 前端界面框架
Nginx: 线上 Web 静态资源服务器
```

使用 Codex 编程本身不要求 Vite。只有当项目选择现代前端技术栈，尤其是 React 前端时，Vite 才成为推荐工具。

如果 Hermes Web 只是一个极简演示，可以使用：

```text
index.html
style.css
app.js
```

如果 Hermes Web 需要长期维护、组件化、筛选器、图表、多学生、多周报切换等功能，建议使用：

```text
Vite + React
```

新增的试卷/错题本上传和重点题确认流程也适合使用 Vite + React 实现，因为它需要图片预览、题目框叠加、列表编辑、表单填写和状态切换。

## 3. 为什么选择 Vite + React

Vite + React 适合 Hermes Web 的原因：

1. React 适合组件化组织页面。
2. Vite 开发启动快，构建简单。
3. 构建结果仍然是普通静态文件，适合 Nginx 部署。
4. 第一阶段可以读取静态 JSON。
5. 第二阶段可以平滑切换到 REST API。
6. 后续可以加入趋势图、筛选器、权限、移动端适配等功能。

页面数量、页面关系、组件草图和布局设想不在本文档维护，统一记录在 `docs/website_design_note.md`。

## 4. Vite 的基本使用方式

创建项目：

```bash
npm create vite@latest hermes-web -- --template react
cd hermes-web
npm install
```

开发时：

```bash
npm run dev
```

通常访问：

```text
http://localhost:5173
```

构建时：

```bash
npm run build
```

构建输出：

```text
dist/
  index.html
  assets/
    index-xxxxx.js
    index-xxxxx.css
```

部署时只需要把 `dist/` 下的文件放到 Nginx 服务目录。

## 5. VPS 和 Nginx 部署方式

推荐 VPS 目录结构：

```text
/opt/hermes/2026AgentApp/
  src/web_ui/

/var/www/hermes-web/
  index.html
  assets/

/var/www/html/data/week_reports/
  week_reports_index.json
  week_YYYYMMDD_YYYYMMDD.json

/var/www/html/data/question_sessions/
  upload_20260518_001/
    question_split_result.json
    question_confirmation_result.json
    original/
    crops/
```

部署流程建议脚本化。可以在仓库中维护：

```text
scripts/deploy_web_ui.sh
```

脚本内容示例：

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /opt/hermes/2026AgentApp
git pull origin main

cd src/web_ui
npm ci
npm run build

rm -rf /var/www/hermes-web/*
cp -r dist/* /var/www/hermes-web/
sudo systemctl reload nginx
```

VPS 上部署时只需要执行：

```bash
bash scripts/deploy_web_ui.sh
```

Nginx 负责两类内容：

1. React 构建后的静态前端。
2. Hermes 生成的周报 JSON 静态数据。

示例 Nginx 配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/hermes-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /data/week_reports/ {
        alias /var/www/html/data/week_reports/;
        add_header Cache-Control "no-cache";
    }

    location /data/question_sessions/ {
        alias /var/www/html/data/question_sessions/;
        add_header Cache-Control "no-cache";
    }
}
```

## 6. Hermes JSON 数据集成

演示阶段，Hermes 每周生成：

```text
week_YYYYMMDD_YYYYMMDD.json
```

并更新索引文件：

```text
week_reports_index.json
```

前端读取索引：

```js
const reports = await fetch('/data/week_reports/week_reports_index.json')
  .then((res) => res.json());
```

用户选择某个周报后读取详情：

```js
const report = await fetch(`/data/week_reports/${selectedFile}`)
  .then((res) => res.json());
```

建议先用模拟 JSON 开发页面，等页面结构稳定后再接入真实 Hermes 输出。

试卷/错题本处理流程会新增两类 JSON：

```text
/data/question_sessions/{upload_id}/question_split_result.json
/data/question_sessions/{upload_id}/question_confirmation_result.json
```

其中 `question_split_result.json` 保存腾讯云试卷切题结果，`question_confirmation_result.json` 保存学生手动选择和补充的重点题记录。Hermes 后续再将确认后的重点题汇总进周报 JSON。

前端只依赖 `/data/...` 公开 URL，不直接读取 `/var/lib/hermes/data/` 内部存储目录。

## 7. 页面设计记录

页面数量、页面功能、页面关系、布局草图、组件草图和给 Codex 的页面生成指令模板，统一记录在：

```text
docs/website_design_note.md
```

开发者应先在该文件中用文字描述网站草图，再让 Codex 生成或修改前端页面。

## 8. 技术路线建议

演示阶段推荐：

```text
Vite + React
Tailwind CSS
静态 JSON
Nginx
脚本化部署到 VPS
```

长期阶段推荐：

```text
Vite + React
REST API
数据库
Nginx 反向代理
自动化部署脚本
```

第一阶段不要过早引入复杂后端和数据库。先把周报页面、JSON 格式、部署路径和渲染流程跑通。

## 9. 已确认决策

已确认的前端技术路线决策：

1. 使用 Vite + React 作为 Hermes Web 前端路线。
2. 演示阶段继续采用静态 JSON 文件。
3. 周报 JSON 文件固定放在 `/var/www/html/data/week_reports/`。
4. 前端项目放在 `src/web_ui/`。
5. 页面草图、功能关系和布局想法不放在本文档，改由 `docs/website_design_note.md` 维护。
6. 第一版加入 Tailwind CSS。
7. 第一版暂不引入 shadcn/ui 和 Recharts。
8. VPS 部署采用 `scripts/deploy_web_ui.sh` 脚本化流程。
9. 前端需要同时支持“重点题确认工作台”和“周报查看仪表盘”两个主要视图。
