# E6 现场演示设计：baseline-ab -> C -> showcase-abc

> **P0 保护当前状态（[#118](https://github.com/farmerhunter/2026AgentApp/issues/118)，2026-09-14）**：A/E/S 已从 `main@db475daa7085bfb015d43116db82b95daac8c6d8` 部署到生产和测试环境。当前演示只使用仓库公开样例的 `/demo`；真实 API、上传/OCR/重试、Hermes、已有结果查看与打印均暂停，旧数据原地保留，新增真实调用与真实验收预算为 0。下文真实流程是历史或未来恢复参考，当前不可执行；不能通过环境变量、旧 release、旧 deploy 或 restore 绕过保护。实际激活、公开 demo 浏览器验证和后续选择性恢复状态集中记录在 #118。


## 0. 终评主流程决定（2026-09-11）

终评主流程使用已经通过程序与人工验收的 `showcase-abc` 保存周报，不把现场 OCR 或 Hermes 成功作为继续答辩的前提。演示前恢复 `showcase-abc`，硬刷新页面后直接讲解 A/B/C 三卷形成的重点、变化、判断边界与行动，并展示证据折叠和打印。

下文 `baseline-ab -> C -> showcase-abc` 保留为完整链路演练或可选真实调用流程。现场如需展示一次真实调用，应与主讲流程解耦；失败或超时后立即回到保存结果继续。

## 1. 目标

用可重复的 A/B/C 三份合成试卷，演示一条真实链路：

```text
已有 A/B 基线
  -> 现场导入 C
  -> OCR 切题
  -> 学生确认 C05/C06
  -> Hermes 分析
  -> 接受/拒绝记忆
  -> 重新生成周报
  -> 页面展示与打印
```

## 2. 材料

- A 卷：`worksheet-a-v1.png`，10 题，错题 A06/A09/A10。
- B 卷：`worksheet-b-v1.png`，10 题，错题 B06/B09/B10。
- C 卷：`worksheet-c-v1.png`，6 题，现场错题 C05/C06。

C 卷故事：

- C05：已经正确化简为 `4√3 + 5√3`，但系数相加写成 `8√3`。
- C06：已经正确求出一次函数表达式，但最后 `-6 + 2` 写成 `-8`。

## 3. 演示前恢复

运维者在 VPS 上执行：

```bash
sudo xuetuzhiban-demo restore baseline-ab
sudo xuetuzhiban-demo verify baseline-ab
```

`baseline-ab` 固定包含：

- A/B 两个 upload
- 6 道已确认错题
- findings、已接受/拒绝 memory decisions
- 一份基线周报

## 4. 现场步骤

### 步骤 1：打开导航页

访问根路径 `http://49.233.203.222`，展示 Jingyun Apps 导航页，点击“真实运行版”。

### 步骤 2：展示 A/B 基线

进入 `/apps/xuetuzhiban/app/report`：

- 显示基线周报
- 显示最后生成时间
- 显示证据范围条数

### 步骤 3：导入 C 卷

进入 `/apps/xuetuzhiban/app/import`，上传 `worksheet-c-v1.png`。

### 步骤 4：OCR 与确认

等待 OCR 完成后：

- 只勾选 C05、C06
- 若 OCR 没有识别出学生作答，则补录对应作答
- 保存确认

### 步骤 5：触发分析

进入 `/apps/xuetuzhiban/app/analysis`，选择 C 上传批次，点击“开始分析”。

### 步骤 6：记忆决策

如果产生 pending memory candidates，展示接受/拒绝；如果没有，说明 C 题证据不足，系统不会强行生成记忆。

### 步骤 7：重新生成周报

进入 `/apps/xuetuzhiban/app/report`，点击“生成周报”。

对比：

- 分析范围从 2 批变为 3 批
- 已确认错题从 6 道变为 8 道
- 周报最后生成时间晚于基线
- evidence scope 增加

### 步骤 8：打印

点击“打印周报”，展示打印样式。

## 5. 兜底

如果 OCR/Hermes 失败：

```bash
xuetuzhiban-fallback
```

指向静态 `/apps/xuetuzhiban/demo/`，不依赖外部服务。

## 6. 演示后恢复

```bash
sudo xuetuzhiban-demo restore baseline-ab
sudo xuetuzhiban-demo verify baseline-ab
```

下一场演示仍可重复使用同一张 C 卷。
