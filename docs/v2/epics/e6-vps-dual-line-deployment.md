# E6：VPS 双线部署与端到端验收

> **P0 保护当前状态（[#118](https://github.com/farmerhunter/2026AgentApp/issues/118)，2026-09-14）**：A/E/S 已从 `main@db475daa7085bfb015d43116db82b95daac8c6d8` 部署到生产和测试环境。当前只保留使用仓库公开样例的 `/demo`；真实 API、上传/OCR/重试、Hermes、已有结果查看与打印均暂停，旧数据原地保留，新增真实调用与真实验收预算为 0。下文原真实流程及 E6 验收是历史或未来恢复参考，当前不可执行；不能通过环境变量、旧 release、旧 deploy 或 restore 绕过保护。实际激活和验证见 [E 回执](https://github.com/farmerhunter/2026AgentApp/issues/118#issuecomment-5662653371)、[S 回执](https://github.com/farmerhunter/2026AgentApp/issues/118#issuecomment-5662782474) 与 [Architect 验收](https://github.com/farmerhunter/2026AgentApp/issues/118#issuecomment-5662807192)。选择性恢复和 Epic 关闭状态以 #118 为准。

## P0 已激活保护与安全操作边界

当前 `src/api/server.js` 不加载 DB、migration、业务 routes、profile 或恢复队列，只监听 loopback。生产和测试分别绑定已合并 release 的 `127.0.0.1:8001` 与 `127.0.0.1:8011`。本地 `GET /api/health` 返回 `200 {"status":"protected_disabled"}`，只表示停用进程存活；其他请求返回 `503 p0_protected_disabled` 与 `Cache-Control: no-store`。公开 Nginx API 包括 health 全部拒绝。`fallback-demo.sh` 固定报告 `LIVE_PROTECTED_DISABLED`，不会把 health 200 当作真实服务可用。真实 UI 只显示暂停说明，不轮询或重试真实请求。

两个 E5 CLI 和旧 shell jobs 在读取输入、DB 或 profile 前停止，包括 fixture 模式；生产入口没有 fixture 解锁开关。OCR 底层导出与 Hermes bridge 的真实执行同样在私有读取或外部调用前拒绝，旧 probe 和实验入口也已封闭。合并代码完成了 P0 边界测试、Web build、demo 数据验证和独立 whole-change review；生产与测试的公开拒绝、进程退出、重启保持停用及浏览器 demo 路径均已有运行证据。

实际生产和测试 release 均绑定 `db475daa7085bfb015d43116db82b95daac8c6d8`。旧项目进程及已识别监听已停止且受控 restart 后未回开；两个安全 bootstrap 服务保留 loopback 监听。生产和测试 unit 不再加载 provider EnvironmentFile，只保留各自监听端口；测试的资源限制 drop-in 保留。已安装 operator 只能报告或维持 P0 状态，不能执行 restore。Chatbox 的 port 3000 未改动。

公开静态入口已切换到已审产物 `/opt/hermes/2026agentapp-prod/web/p0-db475daa7085bfb015d43116db82b95daac8c6d8`：

1. `/apps/xuetuzhiban/demo/` 提供 production 公开 demo；测试 demo 固定跳转到该入口，不再是独立测试 UI。
2. 根 `/data/` 及两个 app 的 data 前缀只提供同一份仓库公开样例；缺失数据返回 404，旧历史 data aliases 不再参与有效路由。
3. 生产和测试 `/app`、`/api` 入口保持 `503/no-store`；公开 demo 不请求真实 API、OCR 或 Hermes。
4. 外部域名当前仍被 DNSPod webblock 拦截，因此线上证据使用直连 IP；这不表示 DNS/TLS 已修复。

后续维护必须保持入口拒绝和已知公开静态来源。故障处理可以停用服务或撤回不合格的新候选，但不能恢复旧的公开或 paid 状态。恢复查看/打印、OCR、Hermes 或共享身份运维属于后续 Work，必须重新完成身份、对象权限、费用边界、代码 review 和精确主机授权。旧数据、历史日志、checkout、静态目录及配置备份仍保留；本 P0 未读取或审计旧资料内容，也未撤销切换前可能发生的迟到费用。

受保护路由关闭原始 URI/query access log，不复制或删除历史日志。当前保护状态的操作与结案证据集中记录在 #118。

## 历史 E6 设计参考

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
- 快照 manifest 同时支持历史周报与 `weekly_learning_report` 2.0；新版快照固定已验收周报的 contract、版本和正文 SHA-256，恢复后必须逐项一致。
- 使用非正式数据根做演练时，必须同时显式指定独立 API service 和 API base；否则 operator 立即退出，避免测试误停正式服务。

## 6. 验收循环

`baseline-ab -> 导入 C -> showcase-abc -> restore baseline-ab -> verify baseline-ab`

C 卷只确认 C05/C06；C05 表达根式合并的局部变化，C06 表达负数加法的重复；不把 C01-C04 计入错题。

## 7. 不做什么

- 不增加登录、Basic Auth、VPN、rate limit、COS/PostgreSQL/Redis、worker、高可用或大型监控。
- 不迁移或修改 Chatbox。
- 不公开密钥、真实学生资料、私有原图或完整外部响应。
