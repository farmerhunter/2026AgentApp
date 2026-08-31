# E5 单题质量实验

状态：实验资产，不是正式 E5 Skill、API contract 或验收通过证据。

新增 [两批仿真练习文字稿](two-batch-learning-fixture/README.md)：每批 10 题，题干/模拟作答与人工参考分开，供后续累积分析与周报验证使用。当前仅完成文字材料自查，没有启动新一轮模型或 OCR 实验。

**当前没有通过质量验收的 Skill。** [第三轮结果](results/2026-08-31-round03/review.md)完成 6 次真实调用：v0.3 的证据/分类一致性有改善，但数学推广、补写过程、无效对比题仍有问题，因此整版未采用，实验入口恢复为有已知缺陷的 v0.1。v0.2 的[第二轮失败](results/2026-08-31-round02/review.md)与全部候选快照也保留。连续两个候选未收敛，暂停追加提示词，先讨论收窄输出目标；不能据此部署。

后续决定：用户已拒绝澄清问答及 UI 变更，只接受围绕原题解释关系和有依据的局部发现；无明显收益就不继续深挖单题。旧实验输出及 Skill 快照不改写，也不是已适配新目标的发布版。本次未创建 v0.4 或追加调用，累积信息能力边界见[质量设计](../../docs/v2/hermes-analysis-quality.md)。

归档与续接：本目录随 E5 设计一起版本管理，保留合成输入、原始最终 JSON、用量、最小 preflight 结果、版本快照和检查记录，不包含完整 Hermes home、诊断日志、凭证或真实学生资料。各轮 `review.md` 中“未提交”“下一轮待讨论”等是当时的历史状态，不会随归档改写；当前方向以上述后续决定、质量设计和 [E5 续接记录](https://github.com/farmerhunter/2026AgentApp/issues/13#issuecomment-5470684921)为准。离线检查不调用模型；取回文件不意味着启动下一轮实验。

已有 [2026-08-31 首轮真实结果与质量检查](results/2026-08-31-baseline-v01/review.md)：三次调用成功，但 Q2 过度归因与数学推广表述需修正。复跑机械检查：`node experiments/hermes-quality/check_results.mjs`；它不替代人工内容检查。

三个合成案例分别覆盖：根式有错误步骤、同题只有错误答案、一次函数斜率正确但漏求截距。预期答案不传给 Hermes；调用时传入当前 E3 知识地图的紧凑节点。检查方法见 [质量设计](../../docs/v2/hermes-analysis-quality.md)。

`skills/confirmed-mistake-analysis-probe/SKILL.md` 是当前实验 Skill，通过真实 Hermes `--skills` 预加载；首轮 v0.1 原文保留在对应结果目录的 `skill-snapshot.md`。每个案例有独立临时 Hermes home、新会话、空工具集、关闭的环境记忆，不写产品数据库。并未证明正式 HermesBridge 或 lab/runtime profile 可用。

`run_probe.py` 用 VPS 上安装 Hermes 的 Python 运行。必须显式传入安装目录、现有凭证 profile、知识地图文件和一个尚不存在的输出目录。不加 `--run` 只做本地配置/Skill 检查，不调用模型；加 `--run` 最多运行三个单题任务，每题最多 180 秒，失败即停止，无脚本主动重试。Hermes 应用级重试设为一次尝试，但不把它宣传为 SDK 层绝无重试的费用硬上限。

对照实验只增加三个可选参数：`--cases-file` 选择合成输入文件，`--only Q2` 选择其中案例，`--skill-file` 指向旧版快照。没有自动调参、循环重试或模型裁判。第二轮测前方案与结果记录见 [round02](results/2026-08-31-round02/review.md)；`holdout-round02.json` 是冻结候选后编写的两道新题，检查后即成为普通回归题，不能继续宣称未见题。机械检查可传入具体批次目录：`node experiments/hermes-quality/check_results.mjs <结果目录>`。

`holdout-round03.json` 保留第三轮的一次函数有/无备注对照；H3/H4 现在也属于已见回归题，不再是下一轮的未见题。第三轮未改 runner/checker，未建设新的测试设施。

凭证由 Hermes 自己从已有 profile 解析，只经子进程环境传递，不复制或打印。原始输出、用量、配置与 Skill 快照存入指定私有实验目录。不要将整个 Hermes home、状态数据库或诊断日志提交 Git；运行输出不等于人工检查通过。

执行前先做 preflight，核对零工具和正确 Skill 已加载。真实调用会使用现有 Provider 额度，不能把它当作免费测试；用量报告若没有费用数字就记录 unknown，不能写成零费用。首轮完成后先人工检查，再决定是否需要下一轮，禁止自动循环改 Skill 和调用模型。
