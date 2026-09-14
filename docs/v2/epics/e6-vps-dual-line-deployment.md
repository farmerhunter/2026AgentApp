# E6：VPS 双线部署与端到端验收

> **P0 暂停版本（#118，2026-09-14）**：Human 已批准 A 作为临时止损。此候选只保留公开 `/demo`；生产与测试全部真实 API、上传/OCR/重试、Hermes、已有结果查看与打印均暂停，旧数据原地保留。新增真实调用与真实验收预算为 0。下文真实流程及 E6 验收是历史/恢复后的设计参考，不是当前可执行操作；不能通过环境变量或 restore 恢复。代码验证不代表线上已生效，main merge、具体主机激活及 Epic closure 仍须分别授权。后续恢复功能另行设计与批准，A 不自动完成整个 Epic。

## P0 定向激活与安全撤回准备

候选代码的 `src/api/server.js` 不加载 DB、migration、业务 routes、profile 或恢复队列；固定只监听 loopback。`GET /api/health` 返回 `200 {"status":"protected_disabled"}`，只表示停用进程存活，其他请求一律 `503 p0_protected_disabled`、`Cache-Control: no-store`。公开 Nginx API 包括 health 全拒绝。`fallback-demo.sh` 固定报告 `LIVE_PROTECTED_DISABLED`，不把 health 200 当作真实服务可用。真实 UI 为静态暂停说明，没有轮询或自动重试。

两个 E5 CLI 和旧 shell jobs 在读取输入/DB/profile 前停止，包括 fixture 模式；需要独立 fixture 验证时使用隔离 harness 和 route/domain 模块，生产入口不提供 fixture 开关。OCR 底层导出与 Hermes bridge 真实执行始终拒绝；旧 probe 和实验入口也在私有读取前退出。历史端到端 smoke 依赖已暂停的 production server，不再是该候选的成功 oracle；本地执行 `node src/api/scripts/test-p0-protection.mjs`、Web build 与 demo 数据验证。

**未绑定事实**：实际生产/测试 release、测试构建 basename、vhost/snippet、service/upstream、直接端口、旧任务/子进程和 operator 安装位置尚未读回。模板仅为待审候选，禁止整份覆盖测试或共享配置。仓库模板去掉了共享 `/`；生产 unit 移除 provider EnvironmentFile，仅保留监听端口。测试 unit 必须在实际只读核验后生成精确 diff，不猜路径或加载生产 secret。

取得精确主机范围授权后，由唯一 host writer 执行：

1. 先读回上述绑定，列出只涉及两个 app 的配置与 release 目标；保护规则同时覆盖裸 API 前缀、尾斜杠、深层对象与规范化路径，检查更长 location/别名没有覆盖拒绝。确认静态 demo/assets/data 指向已审公开构建，不指向 runtime 数据。
2. 在批准窗口先关闭两个环境外部真实入口，再停止已识别 API、子进程和自动任务；不等待旧队列排空，不杀未知进程，不碰 Chatbox/3000。关联执行进程不明时保持拒绝并停止激活。
3. 定向安装已审 release、operator、unit 与最小 Nginx diff。保留原数据、secret、快照与现有公开 demo；不运行旧 `deploy.sh`（现已直接拒绝），不使用旧 release/operator 回开真实功能。`restore` 在任何数据/服务操作前拒绝。
4. 验证 Nginx 语法、两环境所有方法/业务路径拒绝、直接 loopback 状态、受控 service restart 后仍停用、无遗留执行、demo 首页/深链/刷新/无真实 API 请求，以及其他 app 配置无变更。此处 Linux/systemd/Nginx/runtime 验收尚未执行。
5. 激活失败时保留入口拒绝、停止真实 service、保留静态 demo 与当前数据；允许撤回不合格候选，不允许恢复旧公开 paid 状态。旧在途请求和迟到收费为未知，停止本地进程不等于云端撤销；不得以零新增执行宣称零历史费用。

受保护路由候选关闭原始 URI/query access log，不复制或删除历史日志；实际日志作用域随精确 diff 审阅。恢复查看/打印、OCR、Hermes 或共享身份运维均是后续 Work，必须另有权限和费用条件。


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
