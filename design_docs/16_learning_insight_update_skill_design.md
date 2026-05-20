# Learning Insight Update Skill 设计

本文档定义 `learning_insight_update` skill。它对应 `design_docs/03_design_brief.md` 的用例 4：生成重点题记录并更新记忆。

这是项目的关键智能体能力。它不只是“错题总结”，而是将各种学习证据转化为可积累、可追踪、可行动的学习发现。

术语约定：

- `finding`：中文建议译为“发现”或“局部发现”。它来自一次上传、一道重点题、一条备注或一组相近材料，是局部、可追溯、带置信度的判断。
- `insight`：中文建议译为“见解”。它必须经过 consolidation，对多个 findings、短期记忆和历史模式进行归并后形成，不能把单次局部判断直接称为 insight。
- `memory`：学习记忆。它不是单条 finding，而是系统保留下来的近期上下文、长期薄弱点、已确认模式和后续跟进状态。

## 1. 核心定位

`learning_insight_update` 的职责是：

```text
学习证据
  -> Hermes 理解、归因、归类、判断优先级
  -> learning finding / 局部发现
  -> memory candidate / 记忆候选
  -> action candidate / 行动候选
  -> weekly context candidate / 周报上下文候选
```

它要回答：

- 学生这次暴露了什么学习问题？
- 这个问题属于知识点不会、概念混淆、审题问题、表达问题、计算失误，还是学习习惯问题？
- 这个问题是偶发，还是和历史记录重复出现？
- 它和教材章节、知识点、近期学习内容有什么关系？
- 它是否应该进入长期学习记忆？
- 它是否应该进入本周周报？
- 它需要什么后续行动？
- 优先级多高，原因是什么？

它不负责直接生成最终全局见解。全局见解应在 consolidation 步骤中形成。

## 2. 输入来源

第一版输入可以来自：

- `textbook_content_summary.json`
- `upload_meta.json`
- `question_split_result.json`
- `question_confirmation_result.json`
- `text_note.json`
- 已有重点题记录
- 历史周报摘要

后续可扩展输入：

- 微信文字消息。
- 家长或老师反馈。
- 学习计划完成情况。
- 课堂笔记。
- 测验成绩。
- 复习打卡记录。

## 3. 输出

第一版输出至少包括：

- `focus_question_records.contract.json` 对应的重点题记录。
- local findings / 局部发现。
- memory candidates / 记忆候选。
- action candidates / 行动候选。
- weekly context candidates / 周报上下文候选。

建议增加独立 contract：

```text
learning_findings.contract.json
```

建议字段：

```json
{
  "finding_batch_id": "findings_20260518_001",
  "student_id": "demo_student",
  "subject": "math",
  "subject_label": "数学",
  "source_refs": [],
  "findings": [
    {
      "finding_id": "finding_20260518_001_01",
      "scope": "local",
      "finding_type": "procedure_gap",
      "statement": "",
      "evidence_summary": "",
      "concept_links": [],
      "mistake_reasons": [],
      "confidence": "medium",
      "memory_candidates": [],
      "action_candidates": [],
      "weekly_context_candidates": []
    }
  ],
  "created_at": "2026-05-18T20:00:00+08:00"
}
```

需要同步设计：

- `learning_memory_snapshot.contract.json`：用于保存短期和长期记忆快照。
- `insight_consolidation.contract.json`：用于保存经过 consolidation 后形成的见解。第一阶段可由 `weekly_report` job 生成，后续再拆成独立 job。

## 4. 内部能力模块

这个 skill 可以先作为一个 skill 实现，但内部逻辑应按模块组织。

### 4.1 Evidence Normalization

将不同来源统一成学习证据：

- 题目确认记录。
- 学生备注。
- 教材章节。
- 上传材料。
- 历史问题。

输出应保留来源引用，方便解释建议来自哪里。

### 4.2 Concept Mapping

将学习证据关联到教材章节、学习单元和知识点。

原则：

- 能确定则明确关联。
- 不能确定则标注 `uncertain`。
- 不要强行把所有问题映射到知识点。

### 4.3 Error Reasoning

分析可能问题类型。

建议第一版分类：

- `concept_gap`：概念不清。
- `procedure_gap`：步骤或方法不熟。
- `calculation_error`：计算错误。
- `reading_comprehension`：审题或阅读理解问题。
- `expression_issue`：表达、书写或组织答案问题。
- `memory_recall`：记忆不牢。
- `carelessness`：粗心或检查不足。
- `study_habit`：学习习惯问题。
- `unknown`：证据不足。

不同学科应允许差异：

- 数学：概念、步骤、计算、建模、审题。
- 语文：阅读理解、表达结构、文本证据、字词积累。
- 英语：词汇、语法、阅读理解、表达准确性、听说输入。

### 4.4 Memory Candidate

判断某个 finding 是否应成为记忆候选。

默认规则：

- local finding 默认进入短期记忆或本周上下文候选。
- local finding 不应直接覆盖长期记忆。
- 长期记忆只接受经过 consolidation 或人工确认的稳定模式。

进入长期记忆候选的条件可以包括：

- 同类问题重复出现。
- 学生明确标注为不理解。
- 影响后续学习的基础知识点。
- 老师或家长强调。
- 本周多次相关。

不应进入长期记忆的情况：

- 证据不足。
- 单次偶发小错误。
- 无法确定学科或知识点。
- 隐私或敏感内容。

### 4.5 Action Candidate

生成可执行的后续行动候选。它们不是最终 action plan。

行动类型建议：

- `redo_question`：重做题目。
- `review_concept`：复习概念。
- `read_textbook_section`：回看教材章节。
- `make_summary`：整理笔记。
- `practice_set`：做专项练习。
- `ask_for_help`：向老师/家长/智能体追问。
- `check_again`：下次复查。

行动候选必须具体、可执行、数量有限。最终 action plan 应由周报或未来独立 action planning 流程综合多个 findings 后生成。

### 4.6 Weekly Context Candidate

判断哪些 findings 应进入本周周报上下文候选。

进入周报的内容应满足：

- 与本周学习目标相关。
- 有代表性或重复性。
- 能转化为下周行动。
- 对家长或学生有解释价值。

## 5. Findings、Memory 和 Insights 的分级关系

`learning_insight_update` 每次处理的材料通常是碎片化的，因此它的直接产物必须是 local finding，而不是全局 insight。

推荐分级：

```text
Evidence / 学习证据
  -> Local Finding / 局部发现
  -> Short-term Memory / 短期记忆
  -> Consolidated Insight / 聚合见解
  -> Long-term Memory / 长期记忆
  -> Weekly Report / 周报
  -> Action Plan / 行动计划
```

### 5.1 Evidence

Evidence 是原始或半结构化学习证据，例如：

- 上传记录。
- 切题结果。
- 人工确认重点题。
- 文字备注。
- 教材摘要。
- 后续微信消息、家长反馈、课堂笔记和测验成绩。

### 5.2 Local Finding

Local finding 是对一组证据的局部解释。

特征：

- 来源明确。
- 结论局部。
- 带置信度。
- 可以进入短期记忆。
- 可以成为长期记忆候选。
- 可以被后续证据修正。

### 5.3 Short-term Memory

短期记忆保存近期上下文，例如本周 findings、待跟进行动、重点题和备注。

短期记忆可以较宽松地吸收 local findings，用于周报和后续分析。

### 5.4 Consolidated Insight

Consolidated insight 是经过 consolidation 后形成的见解。

它必须基于多个 findings、短期记忆或历史模式，不能只来自一次孤立事件。

第一阶段可以由 `weekly_report` job 内部执行 consolidation，但应在代码和数据结构中保持独立步骤，便于未来拆成单独 job。

### 5.5 Long-term Memory

长期记忆保存稳定学习画像、反复出现的问题模式和长期跟进事项。

写入长期记忆需要更严格条件：

- 同类问题重复出现。
- 学生、家长或老师确认。
- 连续周报中出现。
- 对后续学习有基础性影响。
- 行动计划执行后仍未改善。

## 6. Hermes 边界

Hermes 负责：

- 综合多来源学习证据。
- 生成 local findings。
- 生成记忆候选、行动候选和周报上下文候选。
- 保留可解释的来源引用。

Hermes 不负责：

- 代替学生确认哪些题重要。
- 在单次碎片材料上直接生成全局 insight。
- 直接覆盖长期记忆。
- 第一版不自动可靠识别老师红笔、给分和扣分原因。
- 不在证据不足时伪造知识点或错因。
- 不保存真实隐私数据。

## 7. 与 UI 的关系

当前 UI 只是第一批输入来源，不应限制这个 skill 的能力边界。

第一版触发点：

```text
上传材料子流程保存确认结果
  -> 触发 learning_insight_update
  -> 生成重点题记录、local findings 和行动候选
  -> 学习成果视图展示状态和摘要
```

也可以由备注保存后触发：

```text
保存文字备注
  -> 可选加入本周上下文
  -> 后台或手动触发 learning_insight_update
```

长期触发点：

- 定时批处理。
- 手动“更新学习洞察”按钮。
- 上传材料后自动触发。
- 微信端输入后触发。

## 8. 与周报的关系

`learning_insight_update` 和 `weekly_report` 分工如下：

- `learning_insight_update`：材料级或事件级分析，生成 local findings。
- `weekly_report`：阶段性汇总，执行第一阶段 consolidation，读取 findings 和 memory，生成跨学科周报。

周报不应重新从原始材料开始做全部深度分析，而应优先复用 local findings、短期记忆和长期记忆。

第一阶段 consolidation 放在 `weekly_report` 中触发，但要分离成独立部分：

```text
weekly_report job
  -> load findings
  -> consolidate insights
  -> update memory candidates
  -> render weekly report
```

未来可以拆成：

```text
finding_consolidation job
  -> consolidated insights
  -> memory update
```

## 9. 与未来 Action Plan 的关系

`learning_insight_update` 只生成 action candidates。

正式 action plan 应综合：

- local action candidates。
- consolidated insights。
- weekly report summary。
- long-term memory。
- 学生可用时间和优先级规则。

第一阶段 action plan 可以作为 `weekly_report` 的一部分输出。未来如需要，再拆成独立 `action_plan` skill 或 job。

## 10. 质量评估

这个 skill 的质量决定系统价值，建议建立单独评估方法。

评估维度：

- 证据引用是否清楚。
- 错因分类是否合理。
- 是否避免过度推断。
- 行动建议是否具体。
- 是否保留多学科差异。
- 是否能处理证据不足。
- 是否能生成清楚、可追溯的 findings。
- 是否避免把 local finding 误写成全局 insight。
- 是否能为后续 consolidation 提供稳定结构。
- 是否能输出给周报使用的稳定上下文。

第一版可以用 3-5 组虚构样例人工评审输出质量。

## 11. 后续扩展

- 增加独立 `learning_findings.contract.json`。
- 增加独立 `insight_consolidation.contract.json`。
- 增加独立 `learning_memory_snapshot.contract.json`。
- 增加长期 memory store。
- 支持趋势分析。
- 支持学生反馈“这个建议有用/无用”。
- 支持家长和老师补充反馈。
- 支持跨学科学习习惯问题识别。
