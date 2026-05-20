# Weekly Report Skill 设计

本文档定义 `weekly_report` skill。该 skill 对应 `docs/03_design_brief.md` 的用例 5：生成阶段性学习分析和周报。

## 1. 目标

`weekly_report` 的目标是将一段时间内的学习材料、local findings、记忆状态和行动候选整理成学生和家长可读的跨学科周报。

术语约定：

- finding / 发现：来自一次上传、一道重点题或一条备注的局部判断。
- insight / 见解：经过 consolidation 后，对多个 findings 或历史模式形成的阶段性判断。

它回答：

- 本周整体学习情况如何？
- 各学科分别有哪些进展、问题和重点题？
- 哪些问题值得下周继续跟进？
- 下周应该做哪些具体行动？

## 2. 输入

第一版输入：

- 本周上传记录。
- `learning_insight_update` 输出的 local findings。
- 重点题记录。
- 文字备注。
- 教材摘要。
- 短期记忆和长期记忆摘要。
- 上一周周报，可选。

不建议周报 skill 直接重新深度分析所有原始材料。它应优先消费 `learning_insight_update` 形成的 local findings，避免重复推理和不一致结论。

## 3. 输出

输出应符合：

- `weekly_report.contract.json`
- `week_reports_index.contract.json`

周报内容包括：

- 周期。
- 学生和年级信息。
- 跨学科总览。
- 各学科分区。
- 上传材料摘要。
- 重点题记录。
- 主要问题分析。
- consolidated insights / 聚合见解。
- 复习建议。
- 下周行动计划。

## 4. Hermes 边界

Hermes 负责：

- 汇总本周学习证据。
- 对本周 local findings 做 consolidation。
- 组织跨学科总览。
- 按学科生成清晰总结。
- 将 consolidated insights 转化为周报语言。
- 生成下周行动计划。

Hermes 不负责：

- 在周报阶段重新确认题目是否重要。
- 在证据不足时编造趋势。
- 输出过长、不可执行的建议。
- 暴露真实隐私数据。

## 5. 与 UI 的关系

对应 UI：`历史周报` 视图。

触发方式：

```text
定时任务或手动按钮
  -> 触发 weekly_report job
  -> 读取本周学习洞察和学习材料
  -> 生成 weekly_report JSON
  -> 更新 week_reports_index JSON
  -> UI 展示周报
```

第一版可以使用静态 JSON 模拟已经生成的周报。长期阶段再通过 REST API 或 job runner 触发真实生成。

## 6. 与 Learning Insight Update 的关系

`weekly_report` 依赖 `learning_insight_update` 的结果。

分工：

- `learning_insight_update`：基于局部学习证据生成 local findings、memory candidates 和 action candidates。
- `weekly_report`：第一阶段负责执行 consolidation，选择、合并、组织和表达一周内最重要的 findings，形成 consolidated insights。

如果周报中需要新的学习建议，应尽量基于已有 findings 和 memory，而不是重新从原始材料推断。

第一阶段 consolidation 放在 `weekly_report` job 中，但需要作为独立步骤保留：

```text
load weekly findings
  -> group by subject / concept / problem pattern
  -> identify repeated or high-priority patterns
  -> create consolidated insights
  -> update memory candidates
  -> render weekly report
```

未来可以拆出独立 `finding_consolidation` job。

## 7. 质量标准

- 周报要短、清晰、可行动。
- 跨学科总览不能替代学科分区。
- 每条重要建议应能追溯到上传材料、备注、finding 或 consolidated insight。
- 不应将一次偶发错误夸大成长期趋势。
- 下周行动计划数量应有限，避免不可执行。
- 周报必须区分 local finding 和 consolidated insight。

## 8. 后续扩展

- 支持月报。
- 支持趋势图。
- 支持家长版和学生版不同表达。
- 支持周报生成前人工预览和编辑。
- 支持从周报反向创建提醒任务。
