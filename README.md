# 2026AgentApp

面向初中学习的 AI 学习智能体项目，用于参加 2026 北京青少年人工智能应用实践活动的 `AI 智能体应用` 方向。

项目目标是演示一个主动式学习助手：学生上传作业、试卷、错题本、笔记或学习问题后，系统完成材料整理、重点题确认、学习分析、周报生成和后续行动建议，并通过 Hermes Web 前端展示。

## 当前设计结论

- 第一阶段采用演示优先路线：VPS 本地文件存储 + 静态 JSON + Nginx + Vite/React 前端。
- 前端目标目录为 `src/web_ui/`，构建产物部署到 `/var/www/hermes-web/`。
- Hermes 周报 JSON 对外发布到 `/var/www/html/data/week_reports/`，前端通过 `fetch()` 读取。
- 试卷和错题本图像处理采用“腾讯云试卷切题 + 学生人工确认 + Hermes 总结”的路线。
- 第一阶段不把自动理解老师红笔批注、给分、扣分原因作为核心能力。
- 第二阶段计划迁移到腾讯云 COS + 数据库 + REST API，支持长期存储、检索和多学生数据管理。

## 核心演示流程

```text
上传试卷/错题本图像
  -> 腾讯云 QuestionSplitOCR 试卷切题
  -> Web 前端展示题目框和切题列表
  -> 学生手动选择需要记录的重点题
  -> 学生补充得分、知识点、错因和备注
  -> Hermes 生成重点题记录和学习建议
  -> Hermes 生成周报 JSON
  -> Web 前端展示历史周报和行动建议
```

## 文档入口

- `docs/01_competition_rules.md`：比赛规则和报名方向整理
- `docs/02_product_brief.md`：产品目标、用户和核心能力
- `docs/03_design_brief.md`：设计简报
- `docs/04_technical_decisions.md`：技术决策记录
- `docs/05_architecture.md`：系统架构
- `docs/06_frontend_technical_route.md`：前端技术路线，包含 Vite/React/Tailwind 和部署决策
- `docs/07_website_design_note.md`：Hermes Web 页面草图、视图关系和页面生成指令模板
- `docs/08_hermes_web_integration.md`：Hermes 周报 JSON 与 Web 前端集成方案
- `docs/09_question_capture_workflow.md`：试卷/错题本上传、切题、重点题确认流程
- `docs/10_storage_design.md`：VPS 本地存储、公开目录、COS 和数据库演进方案
- `docs/11_deployment.md`：部署说明
- `docs/12_demo_script.md`：演示脚本
- `docs/13_reference_links.md`：参考链接
- `docs/14_hermes_agent_runtime.md`：Hermes 智能体运行时、skill、job runner 和 Web 触发设计
- `docs/15_textbook_summary_skill_design.md`：教材摘要 skill 设计
- `docs/16_learning_insight_update_skill_design.md`：学习洞察更新 skill 设计，项目核心智能体能力
- `docs/17_weekly_report_skill_design.md`：周报生成 skill 设计

## 仓库结构

- `docs/`：产品、架构、前端、部署、比赛和设计文档
- `scripts/`：部署和运维脚本
- `src/agent/`：智能体摄取、分析、计划、提醒和存储模块占位
- `src/web_ui/`：计划中的 Vite + React 前端目录
- `src/prompts/`：可复用提示词模板
- `src/skills/`：智能体策略文件
- `data/`：公开的脱敏样例输入和输出
- `runtime/`：本地运行生成数据，不提交真实数据
- `media/`：公开图示、截图和演示素材
- `deliverables/`：比赛交付材料

## Web 部署

VPS 上推荐使用：

```text
/opt/hermes/2026AgentApp/       # 源码目录
/var/www/hermes-web/            # React 构建后的 Web 前端
/var/www/html/data/week_reports/ # 演示阶段周报 JSON
```

部署脚本：

```bash
bash scripts/deploy_web_ui.sh
```

脚本默认从 `/opt/hermes/2026AgentApp` 拉取最新代码，进入 `src/web_ui` 构建前端，并把 `dist/` 发布到 `/var/www/hermes-web/`。

## 公开仓库原则

不要提交真实学生数据、API Key、原始比赛 PDF、私人聊天记录、真实试卷图片或运行时生成记录。

可以提交脱敏后的样例数据、样例输出、公开文档、设计说明和演示素材。
