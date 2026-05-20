# Hermes Prompt 模板设计

本文档记录 Hermes prompt 模板的正式设计。`src/prompts/` 目录只保存 job runner 直接读取的 prompt 模板文件；prompt 体系、使用方式和与 skill / contract / job runner 的关系在本文档维护。

## 1. Prompt 与 Skill 的关系

Prompt 和 skill 分工不同：

- `src/skills/`：定义 Hermes capability 的稳定行为规则，例如任务目标、输入边界、输出要求、禁止事项和质量标准。
- `src/prompts/`：定义 job runner 实际交给 LLM 的具体任务模板。
- `data/contracts/`：定义 prompt 输出必须满足的 JSON shape。
- `src/agent/jobs/`：后续 job runner 会读取 input data、选择对应 skill 和 prompt、调用 LLM 或 fixture implementation、校验输出并写入结果。

简单说：

```text
Skill = 稳定行为规范
Prompt = 单次 LLM 任务模板
Contract = 输出 JSON 结构
Job runner = 读取输入、执行 prompt、校验输出、写入结果
```

## 2. 第一版 Prompt 模板

第一版包含三个 task-specific prompt：

- `textbook_summary.prompt.md`：支持 `textbook_summary` job。
- `learning_insight_update.prompt.md`：支持 `learning_insight_update` job。
- `weekly_report.prompt.md`：支持 `weekly_report` job。

这些 prompt 已经和 #45 中同步回来的 task-specific skill 文件核对：

- `src/skills/textbook_summary.skill.md`
- `src/skills/learning_insight_update.skill.md`
- `src/skills/weekly_report.skill.md`

这些 prompt 也已经引用 #53 中新增的 finding / insight / memory contracts：

- `data/contracts/learning_findings.contract.json`
- `data/contracts/insight_consolidation.contract.json`
- `data/contracts/learning_memory_snapshot.contract.json`

## 3. Job Runner 使用方式

后续 #46 的 job runner 应按以下顺序使用 prompt：

1. 读取相关 JSON inputs。
2. 读取匹配的 skill rules。
3. 读取 `src/prompts/` 中的一个 prompt template。
4. 将输入数据、contract example 和必要 metadata 填入 prompt。
5. 要求 LLM return JSON only。
6. 用对应 contract 校验输出。
7. 将结果写入 runtime output 目录或 public demo data。

## 4. 通用 Prompt 规则

所有 Hermes prompt 必须遵守：

- Return JSON only，不要用 Markdown fences 包裹 JSON。
- `subject` 保持 internal code：`chinese`、`math`、`english`。
- `subject_label` 用于中文展示文本。
- 保留 source references，让结果可以追溯到 evidence。
- 对 OCR、model inference、concept mapping 中的不确定内容显式标注。
- 不虚构 source materials、student answers、scores 或 teacher comments。
- 不暴露 local absolute paths、API keys、private notes 或真实 student privacy。
- 建议必须具体、数量有限，并适合 middle school student 执行。

## 5. Skill 对齐记录

### 5.1 `textbook_summary.prompt.md`

已与 `textbook_summary.skill.md` 对齐：

- 保留 `subject` / `subject_label`。
- 输出 `textbook_content_summary` JSON。
- 不虚构章节、学习单元或知识点。
- 对 textbook structure 不确定的地方显式标注。
- 不保存长篇 textbook 原文。

### 5.2 `learning_insight_update.prompt.md`

已与 `learning_insight_update.skill.md` 对齐：

- 将该 prompt 定位为 Hermes core capability。
- 产出 local findings，不直接产出 global insights。
- 使用 `learning_findings.contract.json` 作为 primary output shape。
- 当 job runner 需要 output bundle 时，可以把 focus question records 作为 secondary output。
- memory candidates 与 short-term memory / long-term memory writes 保持分离。
- 不把当前 Web UI 的上传流程当作 skill 能力边界；未来可以接 WeChat messages、parent feedback、teacher feedback、quiz scores 等 evidence。

### 5.3 `weekly_report.prompt.md`

已与 `weekly_report.skill.md` 对齐：

- 优先消费 local findings 和 memory，不从 raw evidence 重新做完整深度分析。
- 保持 consolidation 为明确独立步骤。
- 允许 high-confidence、high-priority 的 single finding 形成 `early_stage` consolidated insight。
- 不把 single minor 或 low-confidence finding 夸大为 insight。
- next actions 必须数量有限、具体、可执行。

## 6. 与 Phase F 的关系

Prompt 模板处在 Phase F 的中间层：

```text
#53 data contracts and sample data
  -> #45 task-specific skills
  -> #54 prompt templates
  -> #46 job runner
  -> #47 API trigger
  -> #48 Web UI job state and trigger
```

因此 prompt 模板不负责真实 LLM 调用，也不负责写文件；它只定义单次 LLM task 如何理解输入、遵守 skill、输出符合 contract 的 JSON。

## 7. 后续维护原则

- 如果 skill 行为规则变化，应同步检查对应 prompt。
- 如果 contract 字段变化，应同步更新 prompt 的 Required Output。
- 如果 job runner 增加新的 input bundle 方式，应更新 prompt 的 Input Variables。
- 如果发现 LLM 容易输出 Markdown、过度推断或隐私风险，应优先在 prompt 的 Forbidden / Quality Rules 中加约束。
