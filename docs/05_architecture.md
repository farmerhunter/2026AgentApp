# 架构

第一版演示是一个基于文件存储的主动学习智能体。Hermes 或类似的智能体运行时触发分析任务，调用 LLM，写入 Markdown/JSON 输出，并将这些输出暴露给 Web 前端。

## 主流程

1. 学生上传文件或提交文本。
2. 摄取模块提取可用文本和元数据。
3. 分析模块请求 LLM 识别学习进展、薄弱点和建议。
4. 规划模块基于最新洞察生成每日或每周学习计划。
5. 提醒模块记录主动提醒和后续跟进事件。
6. 存储模块保存 Markdown/JSON 文件。
7. Web 前端读取已存储文件，并渲染最新历史、洞察、计划和提醒。

## 源码模块

- `src/agent/ingest/`：文本、图片、PDF 和上传内容解析
- `src/agent/analysis/`：LLM 调用和学习洞察生成
- `src/agent/planner/`：学习计划生成和调整规则
- `src/agent/reminders/`：提醒、定期摘要和事件触发
- `src/agent/storage/`：Markdown/JSON 读写辅助工具
- `src/web_ui/`：用于查看生成结果的 Web 前端
- `src/prompts/`：分析和规划使用的提示词模板
- `src/skills/`：技能策略文件，例如 `study_assistant.skill.md`
- `src/tests/`：验证和演示测试

## 存储模型

运行时应用会将生成记录写入 `runtime/`，该目录已被 Git 忽略。公开示例保存在 `data/sample_outputs/`。

预期的运行时记录包括：

- `student_profile.md`
- `history.md`
- `insight.md`
- `plan.md`
- `chat_history.md`
- `events.log`

这种方式让第一版保持简单，同时保留后续迁移到数据库的路径。

## 部署目标

计划部署目标是轻量级腾讯云服务器或 Docker 容器，运行智能体运行时、Webhook 服务、Web 前端和 LLM 集成。
