# V1：静态全链路演示版

**状态：Historical / 已交付。**

V1 用 Vite/React、静态 JSON、脱敏样例数据和 fixture Hermes job 证明了下面的产品闭环：

```text
学习材料
  -> 重点题确认
  -> finding / 待确定记忆
  -> 周报与行动建议
  -> Web UI 展示
```

V1 的能力边界是“可演示完整体验”，不包含真实用户写入、真实 LLM、鉴权、多用户隔离或生产任务队列。这些能力从 V2 开始实现。

## 文档分区

产品：

- [产品简报](product/product-brief.md)
- [产品体验设计](product/experience-design.md)

系统：

- [系统架构基线](system/architecture-baseline.md)
- [Web 前端技术路线](system/frontend-architecture.md)
- [Web UI 设计记录](system/web-ui-design.md)
- [Hermes 与 Web 集成](system/hermes-web-integration.md)
- [试卷与错题本处理流程](system/question-capture-workflow.md)
- [存储设计记录](system/storage-design.md)
- [部署说明](system/deployment.md)

Hermes：

- [Runtime 设计记录](hermes/runtime-design.md)
- [Textbook Summary Skill](hermes/textbook-summary-skill.md)
- [Learning Insight Update Skill](hermes/learning-insight-update-skill.md)
- [Weekly Report Skill](hermes/weekly-report-skill.md)
- [Prompt 模板设计](hermes/prompt-design.md)

交付与历史：

- [终评要求摘要](delivery/competition-requirements.md)
- [演示脚本](delivery/demo-script.md)
- [参考链接](delivery/reference-links.md)
- [V1 时代的后端 API 草案](future-notes/backend-api-draft.md)

长期有效的决策没有放在本目录，而是集中维护在 [架构决策记录](../decisions/architecture-decisions.md)。

## 使用规则

这些材料保留原有详细风格和历史阶段名称，便于追溯当时的设计过程。文中“阶段 F”“阶段 G”、旧 Issue 编号和计划目录不代表当前排期，也不自动约束 V2 实现。

开发 V2 时优先阅读 [V2 入口](../v2/README.md) 和 [V2 架构](../v2/architecture.md)；只有需要理解原始产品意图、数据形状或历史取舍时，才回到本目录查阅。
