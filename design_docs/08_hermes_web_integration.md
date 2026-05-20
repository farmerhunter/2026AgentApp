# Hermes Web 前端集成设计

本文档记录 Hermes 输出如何被 Web 前端读取。第一阶段仍以静态 JSON 为主，但集成对象不再只有历史周报，还包括上传结束页需要展示的 `learning_insight_update` 结果。

## 第一阶段：演示阶段（静态 JSON 文件）

### 1.1 上传结束页与学习发现

重点题确认保存后，上传结束页应触发或提示触发 `learning_insight_update`。在静态 demo 阶段，可以用预生成 JSON 模拟 job 完成结果。

建议公开路径：

```text
/data/learning_findings/findings_YYYYMMDD_subject.json
/data/hermes_jobs/job_YYYYMMDD_NNN.json
```

前端流程：

```text
保存 question_confirmation_result
  -> 创建或模拟 learning_insight_update job
  -> 轮询或手动刷新 job 状态
  -> job completed
  -> fetch result_path
  -> 渲染 local findings、待确定记忆和行动候选
```

如果 API 不可用，前端可以直接读取 sample `learning_findings` JSON，并明确显示 demo 状态。

### 1.2 周报历史检索

1. Hermes 每周生成跨学科周报 JSON 文件，命名如 `week_YYYYMMDD_YYYYMMDD.json`，放在 `/var/www/html/data/week_reports/`
2. Hermes 生成索引文件 `week_reports_index.json`，列出历史周报
3. Web 前端页面通过 JavaScript 读取索引文件，生成用于选择周报的下拉列表
4. 用户选择后，读取对应 JSON 渲染周报内容（学生信息、跨学科总览、各学科总结、上传资料列表、重点题、学习建议）
5. 数据流：

Web 或微信上传带学科字段的学习资料 → Hermes skill 生成 local findings → 上传结束页确认待确定记忆 → Hermes 生成跨学科周报 JSON → 写入 `/week_reports/` 目录 → 更新 `week_reports_index.json` → Web 前端读取索引 → 读取对应周报 JSON → 渲染跨学科总览和学科分区

6. 第一版默认支持语文、数学、英语。周报不是按学科拆成多个独立文件，而是在一个周报文件中包含整体总结和各学科分区
7. 优点：实现简单、快速部署；限制：无法实时订阅、扩展性有限

## 第二阶段：长期部署（数据库方案）

1. Hermes 输出写入数据库（SQLite / MySQL / PostgreSQL），数据表包含 job、周报日期、学生、学科、上传文件、重点题、local findings、待确定记忆、推荐动作等
2. Web 前端通过 REST API 查询 job 状态、学习发现和历史周报，生成选择器和渲染页面，并支持在跨学科周报内按学科过滤或分区展示
3. 数据流：

Web 或微信上传带学科字段的学习资料 → Hermes skill 生成 findings 和周报数据 → 写入数据库 → REST API → Web 前端查询/渲染上传结束页、待确定记忆、跨学科总览和学科分区

4. 优点：支持多学生、多学科、多技能、分页检索、长期历史记录、趋势图展示和互动功能
