# Hermes Web 前端集成设计：周报历史检索

## 第一阶段：演示阶段（静态 JSON 文件）

1. Hermes 每周生成 JSON 文件，命名如 week_YYYYMMDD_YYYYMMDD.json，放在 /var/www/html/data/week_reports/
2. Hermes 生成索引文件 `week_reports_index.json`，列出历史周报
3. Web 前端页面通过 JavaScript 读取索引文件，生成用于选择周报的下拉列表
4. 用户选择后，读取对应 JSON 渲染周报内容（学生信息、总结、上传资料列表、学习建议）
5. 数据流：

微信上传资料 → Hermes 技能生成周报 JSON → 写入 `/week_reports/` 目录 → 更新 `week_reports_index.json` → Web 前端读取索引 → 读取对应周报 JSON → 渲染页面

6. 优点：实现简单、快速部署；限制：无法实时订阅、扩展性有限

## 第二阶段：长期部署（数据库方案）

1. Hermes 输出写入数据库（SQLite / MySQL / PostgreSQL），数据表包含周报日期、学生、总结、上传文件、推荐动作等
2. Web 前端通过 REST API 查询历史周报，生成选择器和渲染页面
3. 数据流：

微信上传资料 → Hermes 技能生成周报数据 → 写入数据库 → REST API → Web 前端查询/渲染

4. 优点：支持多学生、多技能、分页检索、长期历史记录、趋势图展示和互动功能
