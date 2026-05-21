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

### 1.2 静态 demo job 链路

第一阶段不是简单隐藏“分析教材”“学习洞察更新”“生成周报”等按钮，而是让这些按钮走静态 demo job 链路。这样评委看到的是完整的智能体执行体验：用户点击任务按钮，页面进入处理中状态，然后读取已准备好的 sample result 渲染结果。

阶段 B 应补齐一层前端静态 job adapter：

```text
用户点击 Hermes 任务按钮
  -> runHermesJob(payload)
  -> static mode: 读取 demo job manifest
  -> 模拟 pending / running / completed 状态
  -> fetch result_url
  -> 渲染 sample result
```

执行模式由前端环境变量控制：

```text
VITE_HERMES_EXECUTION_MODE=static   # 1.0 默认，使用 sample data 模拟 job
VITE_HERMES_EXECUTION_MODE=api      # 2.0，调用 /api/hermes/jobs
```

如果需要在网页中切换执行模式，应把它设计成受控的 demo/debug 能力，而不是替代发布配置。默认发布模式仍由 `VITE_HERMES_EXECUTION_MODE` 决定；网页切换只在显式开启时可用：

```text
VITE_ENABLE_HERMES_MODE_SWITCH=true
```

前端执行模式解析顺序：

```text
1. 如果 VITE_ENABLE_HERMES_MODE_SWITCH=true，优先读取 localStorage.hermesExecutionMode
2. 如果 localStorage 没有值，使用 VITE_HERMES_EXECUTION_MODE
3. 如果环境变量也没有值，默认 static
```

建议封装：

```text
getHermesExecutionMode()
setHermesExecutionMode(mode)
subscribeHermesExecutionMode(listener)
```

网页切换控件建议放在非主流程区域，例如页眉右侧的“小型开发模式切换器”或设置抽屉，不放在学生主要任务路径中。控件只允许两个值：

```text
static = 静态演示
api = API 实时
```

切换行为：

- 从 `static` 切到 `api`：后续任务按钮调用 `/api/hermes/jobs`，已有页面数据不强制清空。
- 从 `api` 切回 `static`：后续任务按钮读取 `/data/demo_jobs/`，并停止新建 API job。
- 如果 API 不可用且用户选择 `api`，UI 应显示“API 不可用，可切回静态演示”，但不要自动污染用户选择。
- 模式选择保存在浏览器 `localStorage`，刷新后保持；不同浏览器或设备互不影响。
- 提供“恢复默认模式”操作，删除 localStorage override，回到构建时环境变量。

约束：

- v1 公开评审链接默认应使用 `VITE_HERMES_EXECUTION_MODE=static`。
- 是否开启网页切换由部署者决定；正式提交版本不应依赖用户切换才能正确演示。
- 切换状态只影响前端任务执行来源，不改变业务数据 contract，不写入后端数据库。
- 不应把 API key、模型名或 secret 暴露到前端切换器。

建议新增公开 demo job 数据：

```text
/data/demo_jobs/index.json
/data/demo_jobs/textbook_summary_math_demo.json
/data/demo_jobs/textbook_summary_chinese_demo.json
/data/demo_jobs/learning_insight_update_math_demo.json
/data/demo_jobs/learning_insight_update_chinese_demo.json
/data/demo_jobs/weekly_report_20260518_20260524_demo.json
```

`/data/demo_jobs/index.json` 负责把 job payload 映射到 sample result：

```json
{
  "contract": "demo_jobs_index",
  "contract_version": "1.0",
  "execution_mode": "static",
  "jobs": {
    "textbook_summary": {
      "textbook_math_grade8_demo": "/data/textbooks/textbook_math_grade8_demo/textbook_content_summary.json",
      "textbook_chinese_grade8_demo": "/data/textbooks/textbook_chinese_grade8_demo/textbook_content_summary.json"
    },
    "learning_insight_update": {
      "upload_20260518_001": "/data/learning_findings/findings_20260518_math.json",
      "upload_20260518_002": "/data/learning_findings/findings_20260518_chinese.json"
    },
    "weekly_report": {
      "2026-05-18_2026-05-24": "/data/week_reports/week_20260518_20260524.json"
    }
  }
}
```

单个 demo job status 示例：

```json
{
  "job_id": "demo_job_learning_insight_update_math",
  "job_type": "learning_insight_update",
  "status": "completed",
  "mode": "static",
  "source_ids": ["upload_20260518_001"],
  "result_url": "/data/learning_findings/findings_20260518_math.json",
  "result_label": "数学反比例函数学习发现样例"
}
```

前端应封装统一接口，而不是让组件直接判断 API 或 static：

```text
runHermesJob(payload)
  -> static: runStaticDemoJob(payload)
  -> api: createHermesJob(payload) + pollHermesJob(job_id)
```

UI 组件只消费统一结果：

```json
{
  "job_id": "demo_job_learning_insight_update_math",
  "job_type": "learning_insight_update",
  "status": "completed",
  "mode": "static",
  "result_url": "/data/learning_findings/findings_20260518_math.json",
  "result": {}
}
```

第一阶段验收要求：

- `VITE_HERMES_EXECUTION_MODE=static` 时不请求 `/api/hermes/*`。
- 教材分析、学习洞察更新和生成周报按钮仍可点击，并展示处理中状态。
- 任务完成后从 `/data/...` 读取对应 sample result。
- 静态 demo job 数据纳入 `validate-demo-data.mjs` 校验。

### 1.3 周报历史检索

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
