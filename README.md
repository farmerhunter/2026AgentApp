# 2026AgentApp

面向中学生学习过程的 AI 学习智能体项目，用于参加 2026 北京青少年人工智能应用实践活动的 `AI 智能体应用` 方向。

项目应用名为「学途智伴」。当前智能体内核名为 Hermes。

Hermes 的目标不是做一个普通聊天机器人，也不是只替代错题本，而是把学生日常学习材料中的 `evidence` 逐步加工成可解释的学习问题、学习记忆和后续行动建议。学生上传教材、试卷、作业和备注后，系统完成材料整理、重点题确认、学习分析、周报生成和 Web 展示。

## 核心设计

当前设计把学习理解分成几个层级：

- `evidence`：原始学习证据，例如教材摘要、试卷图片、切题结果、学生确认的重点题、作业记录和备注。
- `finding`：基于证据得到的局部学习发现，例如某个知识点不熟、某类题型步骤不稳、某次作业暴露出计算习惯问题。
- `insight`：跨多次证据和 finding 整理出的稳定学习洞察，例如一段时间内反复出现的能力短板、学习策略问题或可迁移的提升方向。
- `memory candidate`：一次任务中产生的临时记忆候选。
- 短期记忆：近期学习状态、重点题和待观察问题。
- 长期记忆：经过整理后保留下来的稳定学习画像、知识薄弱模式和行动偏好。

这些层级合在一起，形成 Hermes 对学生更高价值的输出：重点题记录、可解释的问题模式、下一步练习建议、周报，以及后续可被 skill 和 prompt 继续引用的学习记忆。

## 当前进展

- 第一阶段采用演示优先路线：VPS 本地文件存储 + 静态 JSON + Nginx + Vite/React 前端。
- 前端目录为 `src/web_ui/`，构建产物部署到 `/var/www/hermes-web/`。
- Demo 数据通过 `src/web_ui/public/data/` 暴露给前端，覆盖周报、question sessions、重点题确认和合成试卷扫描图。
- `data/contracts/` 已开始定义 Hermes 输出契约，包括 finding、insight、memory、report 等结构。
- `src/skills/` 已包含教材摘要、学习洞察更新、周报生成等 Hermes skill 设计。
- `src/prompts/` 已包含与 skill 对齐的 prompt 模板；正式设计说明见 `design_docs/18_prompt_template_design.md`。
- 试卷图像处理采用“试卷切题/OCR + 学生人工确认 + Hermes 总结”的路线。
- 第二阶段计划迁移到腾讯云 COS + database + REST API，支持长期存储、检索和多学生数据管理。

## 核心演示流程

```text
上传教材、试卷、作业或备注
  -> Hermes/OCR 读取材料并生成 evidence
  -> Web 前端展示切题区域和题目列表
  -> 学生手动选择需要记录的重点题
  -> 学生补充得分、知识点、错因和备注
  -> Hermes 生成 finding 和 memory candidate
  -> Hermes 整理短期记忆，并在合适时沉淀长期记忆
  -> Hermes 生成周报 JSON
  -> Web 前端展示周报、重点问题和行动建议
```

## 文档入口

- `design_docs/01_competition_rules.md`：比赛规则和报名方向整理
- `design_docs/02_product_brief.md`：产品目标、用户和核心能力
- `design_docs/03_design_brief.md`：设计简报和第一版用例
- `design_docs/04_technical_decisions.md`：技术决策记录
- `design_docs/05_architecture.md`：系统架构
- `design_docs/06_frontend_technical_route.md`：前端技术路线，包含 Vite/React/Tailwind 和部署决策
- `design_docs/07_website_design_note.md`：Hermes Web 页面草图、视图关系和页面生成指令模板
- `design_docs/08_hermes_web_integration.md`：Hermes 周报 JSON 与 Web 前端集成方案
- `design_docs/09_question_capture_workflow.md`：试卷/错题本上传、切题、重点题确认流程
- `design_docs/10_storage_design.md`：VPS 本地存储、公开目录、COS 和数据库演进方案
- `design_docs/11_deployment.md`：部署说明
- `design_docs/12_demo_script.md`：演示脚本
- `design_docs/13_reference_links.md`：参考链接
- `design_docs/14_hermes_agent_runtime.md`：Hermes 智能体运行时、skill、job runner 和 Web 触发设计
- `design_docs/15_textbook_summary_skill_design.md`：教材摘要 skill 设计
- `design_docs/16_learning_insight_update_skill_design.md`：学习洞察更新 skill 设计
- `design_docs/17_weekly_report_skill_design.md`：周报生成 skill 设计
- `design_docs/18_prompt_template_design.md`：Hermes prompt 模板设计

## 仓库结构

- `design_docs/`：产品、架构、前端、部署、比赛和智能体设计文档
- `scripts/`：部署和运维脚本
- `src/web_ui/`：Vite + React + Tailwind Web 前端
- `src/prompts/`：可复用 prompt 模板
- `src/skills/`：Hermes skill 定义和策略文件
- `data/contracts/`：公开 JSON contract
- `data/sample_inputs/`：公开、脱敏或合成的样例输入
- `data/sample_outputs/`：公开、脱敏的样例输出
- `runtime/`：本地运行生成数据，不提交真实数据
- `media/`：公开图示、截图和演示素材
- `deliverables/`：比赛交付材料

## 本地验证

Web UI：

```bash
cd src/web_ui
npm run build
```

Demo 数据检查：

```bash
cd src/web_ui
node scripts/validate-demo-data.mjs
```

本地开发服务器：

```bash
cd src/web_ui
npm run dev -- --host 127.0.0.1
```

`src/web_ui/.npmrc` 使用 Huawei npm mirror，方便在本机和 VPS 上保持一致的依赖安装路径。

## Web 部署

VPS 上推荐使用：

```text
/opt/hermes/2026AgentApp/        # 源码目录
/var/www/hermes-web/             # React 构建后的 Web 前端
/var/www/html/data/              # 演示阶段公开 JSON 和图片数据
```

部署脚本：

```bash
bash scripts/deploy_web_ui.sh
```

脚本默认从 `/opt/hermes/2026AgentApp` 拉取最新代码，进入 `src/web_ui` 构建前端，并把 `dist/` 发布到 `/var/www/hermes-web/`。

## 公开仓库原则

不要提交真实学生数据、API Key、原始比赛 PDF、私人聊天记录、真实试卷图片或运行时生成记录。

可以提交脱敏后的样例数据、合成图片、样例输出、公开文档、设计说明和演示素材。
