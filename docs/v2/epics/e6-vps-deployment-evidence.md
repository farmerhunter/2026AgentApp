# E6 VPS 部署与演示循环证据

**日期：** 2026-09-02（Asia/Shanghai）  
**分支：** `epic/69-vps-dual-line-deployment`  
**VPS 生产根：** `/opt/hermes/2026agentapp-prod`

## 1. Runtime readback

- API：`127.0.0.1:8001`，`xuetuzhiban-api.service` active
- Web dist：`/opt/hermes/2026agentapp-prod/web/dist`
- Nginx snippet：`/etc/nginx/snippets/xuetuzhiban.conf`
- 公共路径均 200：`/`、`/apps/xuetuzhiban/`、`/apps/xuetuzhiban/app/analysis`、`/api/xuetuzhiban/health`

## 2. 真实演示循环

1. `baseline-ab` 已建立并 snapshot：
   - A/B 真实 worksheet 图片 OCR
   - A 接受 A06/A10、拒绝 A09
   - B 复用 A06 记忆
   - 基线周报生成
2. 导入 C 卷：
   - worksheet-c-v1.png OCR 成功
   - 确认 C05/C06
   - Hermes 分析并重新生成周报
3. `showcase-abc` 已 snapshot。
4. `restore baseline-ab` 成功，活动数据只剩 A/B。

已完成两次完整 `baseline-ab -> C -> showcase-abc -> restore baseline-ab` 循环。

## 3. 恢复失败回滚

用损坏的 `showcase-abc` 数据库触发 restore：

- restore 返回 1
- 自动回滚到 `last-run`
- 随后 `verify baseline-ab` health ok

## 4. 残余事项

- 60–90 秒录屏
- 隐私扫描
- 现场兜底切换脚本演练
