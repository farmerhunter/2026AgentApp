# Learning Insight Update Skill 设计

本文档定义 `learning_insight_update` skill。它对应 `docs/03_design_brief.md` 的用例 4：生成重点题记录并更新记忆。

这是项目的关键智能体能力。它不只是“错题总结”，而是将各种学习证据转化为可积累、可追踪、可行动的学习洞察。

## 1. 核心定位

`learning_insight_update` 的职责是：

```text
学习证据
  -> Hermes 理解、归因、归类、判断优先级
  -> 学习洞察更新
  -> 重点问题记录
  -> 推荐行动
  -> 周报上下文
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
- 学习洞察更新条目。
- 推荐行动。
- 可进入周报的上下文条目。

建议长期增加独立 contract：

```text
learning_insight_update.contract.json
```

建议字段：

```json
{
  "insight_update_id": "insight_20260518_001",
  "student_id": "demo_student",
  "subject": "math",
  "subject_label": "数学",
  "source_refs": [],
  "evidence_summary": "",
  "concept_links": [],
  "problem_patterns": [],
  "mistake_reasons": [],
  "confidence": "medium",
  "memory_updates": [],
  "recommended_actions": [],
  "weekly_context_entries": [],
  "created_at": "2026-05-18T20:00:00+08:00"
}
```

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

### 4.4 Memory Update

判断是否写入长期学习记忆。

进入长期记忆的条件可以包括：

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

### 4.5 Action Recommendation

生成可执行的后续行动。

行动类型建议：

- `redo_question`：重做题目。
- `review_concept`：复习概念。
- `read_textbook_section`：回看教材章节。
- `make_summary`：整理笔记。
- `practice_set`：做专项练习。
- `ask_for_help`：向老师/家长/智能体追问。
- `check_again`：下次复查。

行动必须具体、可执行、数量有限。

### 4.6 Weekly Context Selection

判断哪些洞察应进入本周周报。

进入周报的内容应满足：

- 与本周学习目标相关。
- 有代表性或重复性。
- 能转化为下周行动。
- 对家长或学生有解释价值。

## 5. Hermes 边界

Hermes 负责：

- 综合多来源学习证据。
- 做归纳、归因、优先级判断。
- 生成学习记忆更新和行动建议。
- 保留可解释的来源引用。

Hermes 不负责：

- 代替学生确认哪些题重要。
- 第一版不自动可靠识别老师红笔、给分和扣分原因。
- 不在证据不足时伪造知识点或错因。
- 不保存真实隐私数据。

## 6. 与 UI 的关系

当前 UI 只是第一批输入来源，不应限制这个 skill 的能力边界。

第一版触发点：

```text
上传材料子流程保存确认结果
  -> 触发 learning_insight_update
  -> 生成重点题记录、学习洞察和推荐行动
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

## 7. 与周报的关系

`learning_insight_update` 和 `weekly_report` 分工如下：

- `learning_insight_update`：材料级或事件级分析，更新学习记忆。
- `weekly_report`：阶段性汇总，读取学习记忆和本周上下文，生成跨学科周报。

周报不应重新从原始材料开始做全部深度分析，而应优先复用学习洞察更新结果。

## 8. 质量评估

这个 skill 的质量决定系统价值，建议建立单独评估方法。

评估维度：

- 证据引用是否清楚。
- 错因分类是否合理。
- 是否避免过度推断。
- 行动建议是否具体。
- 是否保留多学科差异。
- 是否能处理证据不足。
- 是否能发现重复问题。
- 是否能输出给周报使用的稳定上下文。

第一版可以用 3-5 组虚构样例人工评审输出质量。

## 9. 后续扩展

- 增加独立 `learning_insight_update.contract.json`。
- 增加长期 memory store。
- 支持趋势分析。
- 支持学生反馈“这个建议有用/无用”。
- 支持家长和老师补充反馈。
- 支持跨学科学习习惯问题识别。
