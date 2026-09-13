# 学途智伴测试环境

## 环境边界

| 项目 | 正式环境 | 测试环境 |
| --- | --- | --- |
| Web | `/apps/xuetuzhiban/` | `/apps/xuetuzhiban-test/` |
| API | `/api/xuetuzhiban/` | `/api/xuetuzhiban-test/` |
| API 端口 | `127.0.0.1:8001` | `127.0.0.1:8011` |
| systemd | `xuetuzhiban-api.service` | `xuetuzhiban-test-api.service` |
| 根目录 | `/opt/hermes/2026agentapp-prod` | `/opt/hermes/2026agentapp-test` |
| SQLite | `data/sqlite/xuetuzhiban.db` | 独立的 `data/sqlite/xuetuzhiban.db` |
| 上传文件 | `data/uploads` | 独立的 `data/uploads` |

测试环境的初始状态来自已验收的 `baseline-ab`，包含 A、B 卷、6 道确认题和周报 2.0。测试环境使用真实 OCR/Hermes 模式，但所有业务写入、任务状态和上传文件均落在测试目录。

测试服务使用较低的 CPU/IO 调度权重，并限制为 70% 单核 CPU、900 MiB 内存软上限和 1400 MiB 硬上限。资源紧张时系统优先保障正式服务。

## 访问地址

- 应用：`http://49.233.203.222/apps/xuetuzhiban-test/app/`
- 周报：`http://49.233.203.222/apps/xuetuzhiban-test/app/report`
- 健康检查：`http://49.233.203.222/api/xuetuzhiban-test/health`

## 重置测试数据

```bash
sudo xuetuzhiban-test-demo restore baseline-ab
sudo xuetuzhiban-test-demo verify baseline-ab
```

这个包装命令固定使用测试根目录、测试服务和 `8011`，不会停止或修改正式服务。

## 开发和部署约定

1. 在 `codex/...` 分支和独立 worktree 开发。
2. 前端测试构建使用：

   ```bash
   VITE_APP_BASE_PATH=/apps/xuetuzhiban-test \
   VITE_APP_API_BASE_URL=/api/xuetuzhiban-test \
   npm run build
   ```

3. 只把代码和前端构建产物部署到 `/opt/hermes/2026agentapp-test`。
4. 只重启 `xuetuzhiban-test-api.service`。
5. 验收测试页面、测试 API 和测试数据库后，再决定是否合并或发布到正式环境。

终评期间禁止更新 `/opt/hermes/2026agentapp-prod`、重启 `xuetuzhiban-api.service` 或运行正式环境的数据写入测试。
