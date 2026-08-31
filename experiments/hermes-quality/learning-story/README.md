# 两批学习故事：有界文字实验

状态：A 批 → 两条用户接受记忆 → B 批 → 周报的真实 Hermes 文字实验已完成，合计 3 次调用；没有重跑 A 或继续调参。见[周报原文](weekly-report.md)、[记忆决定](accepted-memories.json)与[实际检查及限制](review.md)。不是产品 contract、正式 Skill 或 E5 验收；图片/OCR/产品持久化与 UI 链路尚未验证。

## 本轮范围

- 使用[两批仿真练习](../two-batch-learning-fixture/README.md)中六道重点题的已核对文字，不将教师批改、参考答案、预期错因或周报结论传给模型。
- 最多三个真实 Hermes CLI job：A 批、B 批、周报。每 job 180 秒，无 runner 自动重试；沿用 `run_probe.py` 的隔离 home、空工具集、关闭环境记忆和调用设置。Provider/SDK 可能有内部重试，用实际 usage 记录，费用未知时保持 unknown。
- 模型沿用现有 studyv2 profile 的 DeepSeek 配置；不切 Provider，不直接调用其 API。VPS 共享 checkout 不修改，使用新建私有实验目录。
- A 批之后检查真实输出，将最多两条实际候选交用户明确接受；未接受前不将候选当成历史记忆传给 B。B 与周报不因未获回答自动执行。
- 本实验的记忆决定用独立 JSON 留证，不写产品数据库。它证明显式上下文的内容行为，不证明 SQLite/产品接受按钮已接通。
- 超时或无法使用的输出要保存结果，不自动重试。局部数学表述/证据问题如实记录，不一律阻断下一项独立实验；严重到无法解释后续结果时才停止相应步骤。任何情况下都不为修补输出自动追加提示词和调用。此处修正了 A 批后过宽的暂停条件，不改写既有失败记录。

## 复用方式与身份

复用上层 `run_probe.py`，每次用一个 case 容纳一批题。Q1/Q2/Q3 仅是旧 runner 的实验步骤别名，不是题号。下面两个 Skill 文件通过旧 runner 的固定加载别名 `confirmed-mistake-analysis-probe` 注入，各自有独立快照/hash；这不是正式产品 Skill 命名决定。

- `analysis.skill.md`：按最新已确认目标写的两批分析候选，去掉旧版默认追问/新练习要求，增加受控历史输入；不含具体样本解法。
- `weekly.skill.md`：按已确认设计综合同周 findings 与原始作答，不生成记忆候选；不含预期重复/改善结论。
- `cases-a.json`：第一批输入，无历史。
- `accepted-memories.json`：用户明确接受的 A06/A10 原始候选、来源及适用范围；A09 候选未接受。
- `cases-b.json`：第二批输入，只带上述两条已接受记忆，不带参考答案或人工预期。
- `cases-weekly.json`：直接关联六条真实 findings 与各自原题/学生作答，另带实际接受的两条记忆及接受决定；仿真同周，不含人工预设周报。
- `results/a`、`results/b`、`results/weekly`：实际 CLI 最小记录；`weekly-report.md` 仅摘录真实正文与 actions，未人工润色。
- `check-story.mjs`：对一次真实运行检查输入快照、Skill hash、空工具/关闭记忆、输出结构、题目与知识/记忆引用。用法：`node check-story.mjs <本地脱敏运行记录目录>`；不执行模型调用，不评价内容正确性。

所有 `exp_story_*` 标识仅在本实验内使用，不能冒充 upload/question/finding/memory 的产品数据库 ID。后续生成 B/周报输入时，从实际输出和用户决定组装来源关系，不预制 findings 或记忆。

## 检查与预期边界

结构与引用由离线检查执行；内容按[质量策略](../../../docs/v2/hermes-analysis-quality.md)对照实际 CLI 输入检查。数学、忠于证据、判断边界、建议可执行与知识映射分别记录，不用总分遮盖错误。同一助手的检查不是独立教师复核，也不把小样本结果称作普遍准确率。

文字输入与图片生成相互独立。图片必须另行逐题检查，OCR/切题与产品端到端另行验证。试卷上的教师分数、批注不是学生过程；当前 E4 只允许补缺失答案，不能编辑已有 OCR 答案，不能假定红笔混入后已有通用编辑功能。
