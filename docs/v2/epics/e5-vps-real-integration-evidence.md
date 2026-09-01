# E5 VPS 真实联调证据

**日期：** 2026-09-01（Asia/Shanghai）  
**分支：** `epic/13-hermes-analysis-report`  
**提交：** `c5cf049`  
**VPS worktree：** `/opt/hermes/2026agentapp-private/dev/e5-real`  
**产品 DB：** `/opt/hermes/2026agentapp-private/dev/e5-real.db`

## 1. 运行环境

- Hermes CLI：`/home/ubuntu/.hermes/hermes-agent/venv/bin/hermes`
- Hermes profile：`studyv2`
- API：`http://127.0.0.1:8000`，`HERMES_JOB_MODE=real`
- E5 超时：`HERMES_E5_TIMEOUT_MS=300000`
- OCR：`OCR_PROVIDER_MODE=real`，secret 来自 `/opt/hermes/.secrets/2026agentapp/dev/tencent-ocr.env`

## 2. Skill 版本

- `confirmed-mistake-analysis`：`e5-wip-0.1`
  - SHA-256：`019856D21BCDF079497AB927DD08D927D1BDD3D86FAC32A91A28459014088FFC`
- `weekly-learning-report`：`e5-wip-0.1`
  - SHA-256：`0D8972252EBA9BAF1A5AFF0719B1BF498AA1BE571C7A7BADDC40AC35D62BCDD7`

## 3. 真实图片 OCR 链路验证

- 上传图片：`/opt/hermes/2026agentapp-private/dev/ocr-samples/e4-synthetic-ch19-linear-functions.png`
- 上传 ID：`upload_20260901112903._90c012`
- OCR job：成功，`provider_request_id=0d31c7fb-5886-4b89-92c2-138f3540e68a`，切出 6 题。
- 确认 3 道后触发 `confirmed_mistake_analysis`：
  - job：`job_20260901112937._19a2eb` → `completed`
  - 结论：其中两题 OCR 识别出的学生答案实际正确，模型未编造错误，按证据不足/无错误处理；证明产品链不强行生成假错因。

## 4. 两批文字 fixture 最终链路

使用 PR #99 中 `experiments/hermes-quality/two-batch-learning-fixture/batch-a.md` / `batch-b.md` 的完整 10 题文本（每批 3 道重点错题），以 `student_demo` / `math` 写入独立 dev DB。

### A 批

- upload：`upload_exp_story_a`
- 完整 10 题，已确认错题 3 道：A06、A09、A10。
- 分析 job：`job_20260901113941._c41ad8` → `completed`
- finding batch：`findings_20260901114148._4a0e30`
- 生成 3 条 pending 记忆候选。
- 记忆决策：
  - `mem_exp_story_a06` → `accepted`
  - `mem_exp_story_a10` → `accepted`
  - `mem_exp_story_a09` → `rejected`

### B 批

- upload：`upload_exp_story_b`
- 完整 10 题，已确认错题 3 道：B06、B09、B10。
- 分析 job：`job_20260901114214._86c6df` → `completed`
- finding batch：`findings_20260901114435._7ed82e`
- 复用验证：
  - `exp_story_b06` 的 `is_recurring=true`
  - `source_memory_ids=["mem_exp_story_a06"]`
  - 证明第二批只复用了 SQLite 中已接受记忆，新 Hermes 会话没有依赖旧聊天历史。

### 周报

- 周报 job：`job_20260901114454._9b3bc5` → `completed`
- 周报 ID：`week_20260831_20260906`
- 内容包含分析范围、主要问题、可见变化与限制、下一步；给出 2 条 actions。
- 报告正文正确表达二次根式加法重复问题，以及一次函数“漏求截距”的局部变化，同时不把同题重跑当成新证据。

## 5. VPS `/app` 前端验证

- Vite dev server：`http://127.0.0.1:5173`
- `GET /` 返回 200
- `GET /api/health` 经 Vite proxy 返回 200，`mode=real`
- `/app/analysis` 与 `/app/report` 由同一 SPA 提供。

## 6. 已验证

- 真实 Hermes/DeepSeek 错题分析
- 真实 Hermes 周报综合
- 记忆候选默认 `pending`，接受/拒绝落 SQLite
- 第二批只复用 accepted 记忆
- 无效 JSON / 非零退出 / 超时不会写部分领域数据（本地 `smoke-e5.mjs` 覆盖）
- `/api/findings`、`/api/memories`、`/api/reports` 刷新后可读
- 真实 OCR 上传 → 切题 → 确认 → E5 分析

## 7. 已知限制

- 最终演示图片尚未生成，两批链路的题目/作答来自已核对文字 fixture，非 OCR 结果。
- 两个 Skill 仍为 `e5-wip-0.1`，未通过独立 Final Gate。
- 周报 job 当前按 `student_demo` / `math` 固定查询，尚未参数化。
