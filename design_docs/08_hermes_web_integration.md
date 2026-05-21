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

## 阶段 G：后端基础设施（SQLite + REST API）

阶段 G 在 VPS 上部署 SQLite + Express REST API，让前端从"只读静态 JSON"升级为"可写入、可查询、可累积"。

1. 结构化数据写入 SQLite（见 `10_storage_design.md` 第 7 节），文件仍存 VPS 本地磁盘
2. Web 前端通过 REST API 查询和写入：
   - 上传记录、题目元数据、人工确认结果
   - job 状态（`hermes_jobs` 表替代文件系统状态存储）
   - 学习发现、待确定记忆、行动候选（阶段 G 先插样例数据，阶段 F 动态生成）
   - 历史周报、笔记
3. 数据流：

Web 上传学习资料 → 保存到 SQLite + 本地磁盘 → （阶段 F）Hermes skill 调用 LLM 生成 findings → 写入 SQLite → REST API → Web 前端查询/渲染上传结束页、待确定记忆、跨学科总览和学科分区

4. API 不可用时前端自动降级到 `public/data/` 静态 JSON，与阶段 B 行为一致
5. 优点：支持数据写入与累积、多技能查询、长期历史记录；限制：单 VPS 部署，无高可用

## 阶段 F：接入 LLM 动态生成 findings

阶段 F 在阶段 G 的基础设施上，将静态样例 findings 替换为真实 DeepSeek API 调用：

1. `learning_insight_update` job 调用 LLM，基于上传材料和人工确认结果生成 findings
2. 生成的 findings、memory_candidates、action_candidates 写入阶段 G 的 SQLite 表
3. 前端 `FindingCard`、`MemoryCandidateCard` 等组件直接消费真实数据，无需改动
4. 数据流与阶段 G 相同，只是 findings 来源从"预生成 JSON"变为"LLM 实时生成"

## 第二阶段（未来）：腾讯云 COS + PostgreSQL/MySQL

竞赛结束后如需扩展：

1. 大文件迁移到腾讯云 COS
2. SQLite 迁移到 PostgreSQL/MySQL（Drizzle ORM 支持平滑迁移）
3. 保持前端 API 契约不变
