# V2：VPS 双线能力展示版

**状态：Current。**

V2 的目标不是做生产系统，而是在一台 VPS 上可靠展示两条彼此隔离的路线：

- `/demo`：保留 V1 完整静态流程。只读、脱敏、不依赖 API/OCR/Hermes，是可靠兜底。
- `/app`：真实能力主线。上传练习图片，经真实 OCR、人工确认错题、Hermes 分析和周报生成，所有结果通过 API/SQLite 保存。

```text
离线教材知识底图
          +
练习/试卷图片 -> 腾讯 OCR 切题与识别作答 -> 学生确认错题
          -> Hermes 分析 -> finding / 待确认记忆 / action
          -> 学生接受或拒绝记忆 -> 手工触发周报 -> Web 展示/浏览器打印
```

## 五条不可破坏的边界

1. `/demo` 和 `/app` 不混用数据源或写入逻辑。
2. 腾讯 OCR 负责识别与切题，学生负责确认错题，Hermes 负责学习分析。
3. 教材知识底图和学生学习记忆是两类数据，不能混为一体。
4. SQLite 是产品学习记忆的唯一事实来源；Hermes 自带的环境记忆不进入产品逻辑。
5. 外部服务失败时不写入半份 finding、memory 或 report；密钥和真实材料不进入公开目录。

## 先读什么

- [给 David 的 V2 一页开发说明](development-guide.md)：最短的开发入口和优先级。
- [V2 系统架构](architecture.md)：模块、数据流、失败边界和裁剪范围。
- [E1–E6 实施计划](implementation-plan.md)：总体 Epic 分工和终评 R1 约束。
- [Hermes 运行与 Skill 设计](hermes-runtime-and-skills.md)：Hermes、DeepSeek、profile、CLI bridge 和 Skill 迭代方式。
- [E1 设计文档](epics/e1-persistence-api.md)：已经完成的持久化 API 基础。
- [E2 设计文档](epics/e2-dual-entry-ui.md)：`/demo` 与 `/app` 双入口、四页真实工作台骨架和失败边界。
- [V3 延后能力清单](../v3/deferred-capabilities.md)：V2 明确不做但后续不能遗忘的内容。

实时状态、负责人和具体任务以 GitHub Project、Epic Issue 和 PR 为准。Epic 内部 issue 在该 Epic 启动设计时再拆，不在总体规划阶段提前锁死。

## 开发自主权

David 可以自主选择低风险实现方式、拆分任务、提交、合并和部署。涉及真实学生隐私、外部付费、账号权限、不可逆迁移或产品方向变化时再与产品负责人确认。
