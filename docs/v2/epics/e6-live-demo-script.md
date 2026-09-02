# E6 现场演示设计：baseline-ab -> C -> showcase-abc

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
