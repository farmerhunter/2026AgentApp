# E6：VPS 双线部署与端到端验收

**Status：Proposed / implementing**  
**Epic：** E6 / [#69](https://github.com/farmerhunter/2026AgentApp/issues/69)  
**Owner：** David / `epic/69-vps-dual-line-deployment`  
**Base：** `main@3ccefce4971dbb5798c2ea2578a0c5174147785a`

## 1. 冻结的公共路径

- `/`：极简静态应用索引，不依赖 React/API/DB。
- `/apps/xuetuzhiban/`：302 到 `/apps/xuetuzhiban/demo/`。
- `/apps/xuetuzhiban/demo/`：脱敏静态演示，失败时也不依赖 API/OCR/Hermes。
- `/apps/xuetuzhiban/app/`：真实应用。
- `/api/xuetuzhiban/`：真实 API。

当前使用 `http://49.233.203.222`，不硬编码 hostname；未来 ICP 备案后只替换域名并启用 HTTPS，路径保持不变。

## 2. VPS 生产目录（拟定，落地前以 readback 为准）

- 源码：`/opt/hermes/2026AgentApp`
- 生产部署：`/opt/hermes/2026agentapp-prod`
  - `app/`：exact commit checkout
  - `web/dist/`：Nginx 静态构建产物
  - `data/sqlite/`：业务 SQLite
  - `data/uploads/`：私有原图
  - `snapshots/`：`baseline-ab`、`last-run`、manifest
  - `logs/`
- 环境文件：`/opt/hermes/2026agentapp-prod/env/xuetuzhiban.env`
- secrets：仍从 `/opt/hermes/.secrets/2026agentapp/dev/tencent-ocr.env` 读取

## 3. runtime

- API service：`xuetuzhiban-api.service`
- API 绑定：`127.0.0.1:8001`
- Web：Nginx 直接服务 `web/dist`，无独立 Node web service。
- Nginx：`/etc/nginx/sites-available/xuetuzhiban`
- Chatbox 与端口 3000 不受影响。

## 4. 配置对齐

- Vite `base=/apps/xuetuzhiban/`
- React Router basename `/apps/xuetuzhiban`
- API base `/api/xuetuzhiban`
- Nginx `/api/xuetuzhiban/` proxy 到 `127.0.0.1:8001/api/`
- 图片 URL 由 API 返回相对 `/api/xuetuzhiban/uploads/...`

## 5. 可恢复演示状态

Operator 命令：

```bash
sudo xuetuzhiban-demo snapshot baseline-ab
sudo xuetuzhiban-demo restore baseline-ab
sudo xuetuzhiban-demo verify baseline-ab
```

- 只操作 `2026agentapp-prod/data` 下的合成 production 数据根。
- restore 前保存 `last-run`，只停 API service，不碰 Nginx/Chatbox/3000。
- 不调用 OCR/Hermes。
- fail-closed：路径越界、active job、manifest 不匹配时停止。

## 6. 验收循环

`baseline-ab -> 导入 C -> showcase-abc -> restore baseline-ab -> verify baseline-ab`

C 卷只确认 C05/C06；C05 表达根式合并的局部变化，C06 表达负数加法的重复；不把 C01-C04 计入错题。

## 7. 不做什么

- 不增加登录、Basic Auth、VPN、rate limit、COS/PostgreSQL/Redis、worker、高可用或大型监控。
- 不迁移或修改 Chatbox。
- 不公开密钥、真实学生资料、私有原图或完整外部响应。
