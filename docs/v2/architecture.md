# V2 系统架构

**状态：Current design / 部分待实现。** E1 已完成，其余能力以 GitHub Epic 状态为准。

## 1. 最终能力倒推

终评时系统必须能解释并展示：学生上传一张有作答内容的数学练习图片，系统识别题目，学生确认错题，系统结合教材知识分析错误、形成可确认的学习记忆，并生成一份有代表性的周报。

为了让这条真实路径的风险不拖垮展示，V2 在同一 VPS 上保留完全隔离的静态演示线。

```text
                         ┌─ /demo：V1 静态数据，只读完整流程
浏览器 -> Nginx ────────┤
                         └─ /app：真实 UI -> REST API -> SQLite/私有文件
                                                   │
            教材知识地图 JSON ─────────────────────┤
            腾讯 QuestionSplitOCR <── exercise 图 ┤
            Hermes CLI bridge <── 2 个在线 Skill ─┘
                     └── DeepSeek（Hermes 内已配置的推理 Provider）
```

## 2. 两条展示线

### `/demo`：冻结的可靠兜底

- 使用 V1 脱敏静态 JSON，保留完整页面流程。
- 不调用 API、OCR 或 Hermes，不产生真实写入。
- V2 开发不得把真实链路的 loading、错误或数据状态塞回 `/demo`。

### `/app`：真实能力主线

- 只通过 API 读取和写入；API 不可用时明确报错，不自动切换静态数据。
- V2 只需一个共享展示密码，不建设多用户账号系统。
- 早期稳定为四个页面：本周概览、练习导入与确认、分析与记忆、周报与打印。

## 3. 模块职责

### 教材知识底图

- V2 只支持人教版八年级下册数学。
- 原始 PDF 在线下用 Codex/Hermes TUI 和人工检查处理一次，产出仓库内版本化的只读 JSON。
- SQLite 只保存知识地图版本和节点引用。
- 在线 PDF 上传、OCR、切页、进度、重试、教材后台和多教材管理延后到 V3。

### Exercise 输入与 OCR

- 产品文案统一使用“练习/试卷图片”，数据域可使用 `exercise`，不把普通作业强行叫 quiz。
- 单次一张 JPG/PNG，原始文件最大 7 MiB；原图保存到 VPS 私有目录。
- 腾讯云官方 Node SDK 封装为一个 QuestionSplitOCR adapter，使用 Base64 直传和环境变量密钥。
- `UseNewModel` 等厂商开关不凭印象写死：E4 用一份脱敏图片做真实探测后固定配置和字段映射。
- OCR 保存题干、学生作答、bbox 和原始响应必要元数据；前端按 bbox 显示区域，不生成每题裁图文件。
- 学生勾选错题。V2 不自动判错；只有 OCR 缺失时才补录答案文本。

### API、SQLite 与私有文件

- E1 已提供 Session、Finding、Memory、Note、Report 和 Job 的持久化 API 基础。
- 后续 Epic 只做必要扩展：文件 `storage_key`、OCR 作答/bbox、知识节点引用和新 job 类型。
- SQLite 保存结构化数据；私有目录保存真实原图；公开目录只允许脱敏 demo 数据。

### 简单任务执行

V2 只有三类 job：

```text
exercise_ocr | mistake_analysis | weekly_report
queued -> running -> succeeded
                 └-> failed
```

- 一个 API 进程内的串行执行器，前端轮询状态，失败后人工重试。
- 进程重启时遗留的 `running` job 标记为 `failed/interrupted`。
- 任何外部失败都不能部分写入领域结果。
- 不做 Redis、独立 worker、并发队列、百分比进度、取消、优先级、自动重试和历史版本管理。

E1 现有 `pending/running/completed/failed/timeout` 是已实现兼容词汇。目标词汇的迁移或兼容映射应在相关 Epic 设计时处理，不能未经迁移直接破坏 E1 API。

### Hermes

- 应用不直接调用 DeepSeek；DeepSeek 是 VPS 上 Hermes 已配置的模型 Provider。
- 应用通过 `HermesBridge` 启动本地、非交互 Hermes CLI 子进程，stdin/stdout 传 JSON，stderr 只作诊断，并检查退出码、超时和输出 contract。
- 产品不通过 tmux `send-keys` 驱动 TUI。TUI 只用于人类快速试验 Skill。
- 产品学习记忆以 SQLite 为准，显式传给 Hermes；不读取 Hermes 的 ambient memory。

两个在线 Skill 的价值与分析策略见 [E5 核心能力设计](epics/e5-hermes-learning-analysis.md)；运行接入见 [Hermes 运行与 Skill 设计](hermes-runtime-and-skills.md)。教材整理 Skill 在线下使用，不计为在线任务。

## 4. 真实业务流

1. 系统加载版本化教材知识地图。
2. 学生上传一张练习/试卷图片。
3. OCR 切题并识别题干与学生作答。
4. 学生查看结果并勾选错题，单批最多 10 题。
5. 一次确认批次创建一个 `mistake_analysis` job。
6. Hermes 结合错题、知识节点和已接受记忆，返回 findings、memory candidates 和 actions。
7. 服务端校验成功后原子保存；学生接受或拒绝 memory candidate。只有接受的记忆会在以后复用。
8. 用户在本自然周有数据时手工触发周报。系统只保留最新成功结果，通过 Web 展示并用浏览器打印。

V2 不实现 memory 编辑、合并、去重或自动 consolidation，也不自动定时生成周报。

此处不做的是独立的自动聚合和记忆维护流程；周报任务内部应综合本周不同题目的 findings、对应已确认题干/作答/已有备注、行动建议和必要的已接受记忆，表达有证据的共性、重复或变化。本周 findings 不要求先被接受为记忆。V2 记忆候选只从错题分析产生，周报不新增候选或自动改写历史记录。这些能力尚待真实接入与验证，不新增澄清问答、UI 页面或聚合服务。

## 5. 代表性展示数据

展示材料为 2 批仿真练习、每批 10 题，共 20 题，重点覆盖第 16 章二次根式和第 19 章一次函数。每批约 3 道重点错题，形成约 6 条 findings，最多 2 条已接受记忆；这只是展示规模，不是新增系统配额。

第二批用不同题目体现一次同类问题再次出现、一次可见步骤的局部改善和证据不足的情况。正确题用于还原完整练习，不引入自动判分或正确题分析。具体题目不写死在系统架构中；来源标为模拟材料，最终通过真实链路生成并保存结果。材料与周报要求见 [E5 核心能力设计](epics/e5-hermes-learning-analysis.md)。

## 6. 失败边界

- OCR 失败：保留原图和失败 job，可人工重试；不创建已确认题目。
- Hermes 失败或无效 JSON：job 失败，不写 finding/memory/action。
- 周报失败：保留上一份成功周报，不产生半份新报告。
- 页面或 API 故障：切换到独立 `/demo` 或已保存真实结果，而不是在同一流程中静默 fallback。
- 所有密钥来自环境变量；真实学生材料不得提交 Git 或公开静态目录。

## 7. V2 明确裁剪

V2 是中学生可维护的展示系统，不追求 production 级安全、弹性和通用性。完整延后清单见 [V3 延后能力](../v3/deferred-capabilities.md)。
