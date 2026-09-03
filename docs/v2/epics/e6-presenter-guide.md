# E6 终评讲解与现场准备指南

## 0. 当前结论

E6 V2 MVP 已完成：

- PR #101 已合并
- Epic #69 已完成
- VPS 部署、双线入口、真实 A/B/C 演示循环、快照恢复均可用
- 剩余不是 blocker：
  - 60–90 秒录屏
  - 证据文档润色
  - 极低概率故障的进一步生产级强化

## 1. 终评前检查

```bash
# 恢复并验证基线
sudo xuetuzhiban-demo restore baseline-ab
sudo xuetuzhiban-demo verify baseline-ab

# 确认 API
curl http://127.0.0.1:8001/api/health

# 确认兜底脚本
xuetuzhiban-fallback
```

浏览器确认：

- `http://49.233.203.222` 根导航页
- `/apps/xuetuzhiban/demo/`
- `/apps/xuetuzhiban/app/report`

## 2. 关键数据

| 状态 | 批次数 | 已确认错题 | 说明 |
| --- | --- | --- | --- |
| baseline-ab | 2 | 6 | A/B 各 3 道 |
| showcase-abc | 3 | 8 | A/B 各 3，C 2 |

## 3. 现场讲解顺序

1. 打开根导航页，说明这是 VPS 上的应用入口。
2. 点“真实运行版”，进入 `/app`。
3. 打开周报页，展示 A/B 基线周报、最后生成时间和证据范围。
4. 到导入页，上传 C 卷图片。
5. 展示 OCR 切题结果，只勾选 C05、C06。
6. 保存确认，触发分析。
7. 展示 findings / memory candidates。
8. 重新生成周报。
9. 对比：
   - 批次 2 -> 3
   - 错题 6 -> 8
   - 最后生成时间更新
   - evidence scope 更新
10. 打印周报。

## 4. 讲解用一句话

“我们先展示已经保存好的 A/B 学习基线；然后现场上传同一张 C 卷，走真实 OCR、错题确认、Hermes 分析、记忆决策，最后重新生成周报，让学生和家长看到证据范围从 A/B 变成 A/B/C。”

## 5. 需要强调的设计点

- 图片只放 VPS 私有目录，不公开。
- 应用只通过 Hermes 调用模型，不直接调 DeepSeek。
- SQLite 是产品记忆唯一事实来源。
- 只有被接受的记忆才会在后续分析复用。
- 同一题重跑不会被周报当作新证据。
- C05 展示方法局部变化；C06 展示与 B10 有证据的负数加法重复。
- C01–C04 不进入当前错题分析，不宣称掌握率。

## 6. 故障兜底

如果 OCR/Hermes 不稳定：

```bash
xuetuzhiban-fallback
```

然后打开：

```text
/apps/xuetuzhiban/demo/
```

## 7. 演示后恢复

```bash
sudo xuetuzhiban-demo restore baseline-ab
sudo xuetuzhiban-demo verify baseline-ab
```

下一场仍使用同一张 C 卷。

## 8. 可能被问的问题

- 为什么没有登录？当前 MVP 只处理脱敏/合成数据，未开启认证。
- 为什么有 demo 和 app 两条线？demo 不依赖 OCR/Hermes，作为外部服务不稳定时的稳定兜底。
- 记忆是什么？错题分析提出的候选，学生接受后才进入后续分析。
- 周报会不会把同题重跑当新证据？不会，已做同题去重。
- C 卷能重复用吗？可以，每次演示前恢复 baseline-ab。
