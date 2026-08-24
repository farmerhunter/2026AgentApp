# 2026AgentApp

面向中学生学习过程的 AI 学习智能体项目，用于参加 2026 北京青少年人工智能应用实践活动的 `AI 智能体应用` 方向。

项目应用名为「学途智伴」。当前智能体内核名为 Hermes。

Hermes 的目标不是做一个普通聊天机器人，也不是只替代错题本，而是把学生日常学习材料中的 `evidence` 逐步加工成可解释的学习问题、学习记忆和后续行动建议。V2 中，教材先在线下整理成知识底图；学生在线上传练习/试卷图片后，系统完成 OCR 切题、错题确认、学习分析、记忆确认、周报生成和 Web 展示。

## 核心设计

当前设计把学习理解分成几个层级：

- `evidence`：原始学习证据，例如教材摘要、试卷图片、切题结果、学生确认的重点题、作业记录和备注。
- `finding`：基于证据得到的局部学习发现，例如某个知识点不熟、某类题型步骤不稳、某次作业暴露出计算习惯问题。
- `insight`：跨多次证据和 finding 整理出的稳定学习洞察，例如一段时间内反复出现的能力短板、学习策略问题或可迁移的提升方向。
- `memory candidate`：一次任务中产生的待确定记忆，表示可能值得保留、但需要确认或后续 consolidation 的学习问题模式。
- 短期记忆：近期学习状态、重点题和待观察问题。
- 长期记忆：经过整理后保留下来的稳定学习画像、知识薄弱模式和行动偏好。

这些层级合在一起，形成 Hermes 对学生更高价值的输出：重点题记录、可解释的问题模式、下一步练习建议、周报，以及后续可被 skill 和 prompt 继续引用的学习记忆。

## 当前进展

- **v1.0 静态演示版已完成**（2026-05）：Vite/React Web、静态 JSON、脱敏样例数据和 fixture Hermes job 已展示完整学习闭环，无真实 LLM、真实用户写入、鉴权或多用户隔离。
- **v2.0 开发进行中**（2026-08）：E1 持久化 API 已完成；当前按 E2–E6 推进 VPS 双线，`/demo` 保留静态兜底，`/app` 接真实 OCR、Hermes、记忆和周报。完整计划见 [`docs/roadmap.md`](docs/roadmap.md)。
- 前端目录为 `src/web_ui/`，构建产物部署到 `/var/www/hermes-web/`；Demo 数据通过 `src/web_ui/public/data/` 暴露给前端。
- `data/contracts/` 定义 finding、insight、memory、report 等 Hermes 输出契约；`src/skills/` 和 `src/prompts/` 保存可执行的 skill 与 prompt。
- 工程文档已按 V1 历史基线、V2 当前设计和 V3 未来方向重新分层。

## 核心演示流程

```text
离线教材知识底图 + 在线练习/试卷图片
  -> 腾讯 OCR 切题并识别题干和学生作答
  -> 学生勾选错题
  -> Hermes 结合知识节点生成 finding、memory candidate 和 action
  -> 学生接受或拒绝待确定记忆
  -> 手工触发 Hermes 周报
  -> Web 展示周报，并可浏览器打印
```

## 文档入口

- [`CHANGELOG.md`](CHANGELOG.md)：更新日志（每次开发会话追加，记录改了什么、验证结果与遗留事项）
- [`docs/v2/development-guide.md`](docs/v2/development-guide.md)：给 David 的 V2 一页开发说明
- [`docs/roadmap.md`](docs/roadmap.md)：V2 E1–E6 路线图和终评交付约束
- [`docs/quickstart.md`](docs/quickstart.md)：本地快速开始指南（首次运行 5 步 + 常见问题）
- [`docs/README.md`](docs/README.md)：统一文档入口和维护规则
- [`docs/epic-design-guidelines.md`](docs/epic-design-guidelines.md)：复杂 Epic 独立设计文档的判断和维护规范
- [`docs/v1/README.md`](docs/v1/README.md)：已完成的 V1 能力边界和历史资料导航
- [`docs/v2/README.md`](docs/v2/README.md)：当前 V2 双线目标、架构和实施入口
- [`docs/v2/hermes-runtime-and-skills.md`](docs/v2/hermes-runtime-and-skills.md)：Hermes CLI、profile、产品记忆和 Skill 迭代设计
- [`docs/decisions/architecture-decisions.md`](docs/decisions/architecture-decisions.md)：长期架构决策记录

## 仓库结构

- `docs/`：路线图、版本文档、历史基线和架构决策
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
