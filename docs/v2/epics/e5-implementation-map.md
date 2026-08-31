# E5 实施映射（Implementation Map）

**状态：E5 工程分支实施说明。** 对应 Epic [#13](https://github.com/farmerhunter/2026AgentApp/issues/13)，核心设计与质量边界见 PR #99 中的 `docs/v2/epics/e5-hermes-learning-analysis.md`、`docs/v2/hermes-runtime-and-skills.md` 和 `docs/v2/hermes-analysis-quality.md`。

## 1. 旧 job 与新 Skill 的关系

| 旧 job / 资产 | E5 处理 |
| --- | --- |
| `learning_insight_update` | 保留 E1/demo 兼容；产品错题分析改用新 job `confirmed_mistake_analysis`，不复用旧的样例 findings。 |
| `weekly_report` | 保留 E1/demo 兼容；产品周报改用新 job `weekly_learning_report`，不再读取 `data/sample_outputs` 或 `insight_consolidations`。 |
| 旧 `src/skills/learning_insight_update.skill.md`、`weekly_report.skill.md` | 仍作为历史/demo 资产，不进入产品 runtime。 |

新 Skill 源码：

- `src/skills/confirmed_mistake_analysis.skill.md`
- `src/skills/weekly_learning_report.skill.md`

## 2. Endpoint 与 job 参数

- `POST /api/hermes/jobs`
  - `job_type = "confirmed_mistake_analysis"`，必填 `source_ids[0]` 为已确认错题的 `upload_id`。
  - `job_type = "weekly_learning_report"`，`week_start` / `week_end` 可选；缺省按服务器本地自然周（周一至周日）计算。
- `GET /api/hermes/jobs/:job_id` 与 `GET /api/hermes/jobs/:job_id/result` 复用现有 job 状态/结果接口。
- 结果也通过现有 `/api/findings`、`/api/memories`、`/api/reports` 读取。

## 3. 运行模式

- `HERMES_JOB_MODE=real`：通过 HermesBridge 调用 Hermes `studyv2-runtime` CLI。
- `HERMES_E5_TEST_MODE=fixture`：仅在隔离测试/smoke 中使用，用于验证进程、事务、校验和页面边界；不作为产品真实结果。
- E5 job 不静默回退 demo 数据。没有 real 也没有显式 test mode 时直接失败。

## 4. 输入/输出 contract

分析输出由 `confirmed-mistake-analysis` Skill 返回：

```json
{
  "contract": "confirmed_mistake_analysis",
  "contract_version": "1.0",
  "findings": [
    {
      "question_id": "...",
      "scope": "local",
      "finding_type": "procedure_gap",
      "statement": "...",
      "evidence_summary": "...",
      "mistake_reasons": ["procedure_gap"],
      "confidence": "medium",
      "is_recurring": false,
      "source_memory_ids": [],
      "concept_links": [],
      "action_candidates": [],
      "memory_candidates": []
    }
  ]
}
```

周报输出由 `weekly-learning-report` Skill 返回：

```json
{
  "contract": "weekly_learning_report",
  "contract_version": "1.0",
  "analysis": {
    "overall_summary": "分析范围 / 主要问题 / 可见变化与限制 / 下一步"
  },
  "evidence_links": [],
  "actions": []
}
```

## 5. 数据表与迁移

`src/api/db/migrate-e5.js` 新增：

- `findings.question_id`、`findings.upload_id`、`findings.source_memory_ids_json`：把 finding 与已确认题目、作答、记忆引用关联起来。
- `weekly_reports.report_json`、`weekly_reports.generated_by`：周报正文直接存 SQLite，避免依赖静态 public 文件。
- `hermes_jobs.skill_version`、`hermes_jobs.skill_sha256`、`hermes_jobs.output_json`：记录本次 job 使用的 Skill 版本和内容 hash。

复用 E1/E3/E4 表：`learning_findings`、`findings`、`action_candidates`、`weekly_context_candidates`、`memory_decisions`、`weekly_reports`、`knowledge_map_registry`。

## 6. 页面消费者

- `/app/analysis`：选择已确认错题批次 → 触发 `confirmed_mistake_analysis` → 轮询 → 展示 findings；对待确认记忆做接受/拒绝。
- `/app/report`：触发 `weekly_learning_report` → 轮询 → 展示 `analysis.overall_summary` 并支持打印。

## 7. 失败状态与测试入口

- HermesBridge 分离 stdout/stderr，解析唯一 JSON；非零退出、超时、无效 JSON 都转 `failed`，不写部分领域数据。
- 分析校验要求每题至多一条主 finding，并覆盖全部已确认错题；非空知识 ID 必须存在于当前 E3 地图。
- 周报无可用数据时不调用 Hermes，返回 `no_data`；重新生成失败保留上一次成功报告。
- 测试：`cd src/api && npm run smoke:e5`（用项目配套 Node 22）。
