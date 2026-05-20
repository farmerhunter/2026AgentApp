# Contributing

这是一个两人协作的比赛项目。优先保持改动清晰、可验证、可追踪，并让 GitHub issue 反映真实进展。

## 工作流

1. 从一个 GitHub issue 开始工作，先确认目标、验收标准和相关设计文档。
2. 保持 commit 聚焦，一次 commit 只表达一个清楚的逻辑变化。
3. 行为、架构、prompt、skill、demo flow 或部署方式变化时，同步更新 `design_docs/`。
4. 修改 demo 数据时，同时考虑 `data/` 和 `src/web_ui/public/data/` 是否需要保持一致。
5. Push 后不要自动关闭 issue，也不要在 commit 或评论里使用 `Closes #N` / `Fixes #N`。
6. Push 后把 GitHub Project 状态移到 `In review`，在 issue 里记录变更和验证结果，等待人工确认后再关闭。

## 本地验证

Web UI 相关改动至少运行：

```bash
cd src/web_ui
npm run build
```

Demo JSON 或 question session 相关改动还应运行：

```bash
cd src/web_ui
node scripts/validate-demo-data.mjs
```

需要手动检查交互时运行：

```bash
cd src/web_ui
npm run dev -- --host 127.0.0.1
```

本机验证通过后，再同步到 VPS 做部署验证。VPS 验证重点是 `git pull`、依赖安装、构建、Nginx 静态访问和公开数据路径。

## 代码组织

- Web UI code belongs in `src/web_ui/`.
- Prompt templates belong in `src/prompts/`.
- Hermes skill definitions belong in `src/skills/`.
- JSON contracts belong in `data/contracts/`.
- Public demo inputs belong in `data/sample_inputs/`.
- Public demo outputs belong in `data/sample_outputs/`.
- Runtime-generated local data belongs in `runtime/` and should not be committed unless explicitly sanitized.
- Tests and validation scripts should stay close to the component they verify when possible.

## 文档组织

- 正式设计文档放在 `design_docs/`。
- Prompt 模板的正式说明放在 `design_docs/18_prompt_template_design.md`。
- `src/prompts/README.md` 只保留轻量入口和使用说明。
- 比赛交付材料放在 `deliverables/`，不要混入开发过程草稿。

## Demo 数据

Demo 数据必须能支撑第一版演示闭环：

- 教材或学习材料输入
- 试卷/作业 question session
- 重点题人工确认
- finding / insight / memory 相关输出
- 周报和行动建议
- Web UI 可读取的静态 JSON 和图片路径

如果需要展示真实扫描效果，优先使用合成或脱敏图片，不提交真实学生试卷。

## 隐私与安全

不要提交 API Key、真实学生记录、真实试卷图片、原始聊天记录、private notes、未脱敏截图或原始比赛 PDF。

公开仓库里只能放公开文档、脱敏样例、合成素材、可复现的 demo 数据和不含 secret 的代码。
