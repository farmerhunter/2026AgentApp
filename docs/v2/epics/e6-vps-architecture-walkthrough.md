# E6 VPS 程序位置与架构速查

这份文档帮助你回答：“程序部署在哪里？”“数据在哪里？”“出问题去哪里看？”

## 1. 生产目录总览

```text
/opt/hermes/2026agentapp-prod/
  app/                 精确版本源码 checkout
  web/dist/            Nginx 直接服务的 Web 构建产物
  data/
    sqlite/            业务数据库
    uploads/           私有试卷原图
  snapshots/           baseline-ab / showcase-abc / last-run
  env/                 生产环境变量
  logs/
  root-index/          根导航页
```

## 2. 主要文件位置

| 内容 | 路径 |
| --- | --- |
| 后端 API 代码 | `/opt/hermes/2026agentapp-prod/app/src/api` |
| Web 前端代码 | `/opt/hermes/2026agentapp-prod/app/src/web_ui` |
| systemd 服务 | `/etc/systemd/system/xuetuzhiban-api.service` |
| Nginx 配置片段 | `/etc/nginx/snippets/xuetuzhiban.conf` |
| Nginx 站点入口 | `/etc/nginx/sites-available/default` |
| 恢复 operator | `/usr/local/sbin/xuetuzhiban-demo` |
| 兜底脚本 | `/usr/local/sbin/xuetuzhiban-fallback` |
| 隐私扫描 | `/usr/local/sbin/xuetuzhiban-privacy-scan` |
| OCR secret | `/opt/hermes/.secrets/2026agentapp/dev/tencent-ocr.env` |
| Hermes 安装 | `/home/ubuntu/.hermes/hermes-agent` |
| Hermes profile | `/home/ubuntu/.hermes/profiles/studyv2` |

## 3. 请求是怎么流动的

```text
浏览器
  -> Nginx :80
      -> /                      根导航页
      -> /apps/xuetuzhiban/demo/  静态演示
      -> /apps/xuetuzhiban/app/   真实应用 SPA
      -> /api/xuetuzhiban/*      代理到 127.0.0.1:8001/api/*
                                      -> Node API
                                            -> SQLite
                                            -> 腾讯 OCR
                                            -> Hermes CLI
                                                -> DeepSeek
```

## 4. 查看服务

```bash
systemctl cat xuetuzhiban-api
systemctl status xuetuzhiban-api --no-pager
journalctl -u xuetuzhiban-api -n 100
```

## 5. 查看 Nginx

```bash
sudo cat /etc/nginx/snippets/xuetuzhiban.conf
sudo nginx -T | grep -n "xuetuzhiban" -A 12
```

## 6. 查看源码和构建产物

```bash
ls /opt/hermes/2026agentapp-prod/app/src/api
ls /opt/hermes/2026agentapp-prod/app/src/web_ui/src
ls /opt/hermes/2026agentapp-prod/web/dist
```

## 7. 查看数据库和原图

```bash
ls -la /opt/hermes/2026agentapp-prod/data/sqlite
ls -la /opt/hermes/2026agentapp-prod/data/uploads
```

## 8. 查看快照

```bash
sudo ls -la /opt/hermes/2026agentapp-prod/snapshots
sudo cat /opt/hermes/2026agentapp-prod/snapshots/baseline-ab/manifest.json
```

## 9. 一句话回答评委

“生产程序在 `/opt/hermes/2026agentapp-prod`，Nginx 对外提供路径，Node API 只绑定 `127.0.0.1:8001`，业务数据在 `data/`，原图不公开；快照由 `/usr/local/sbin/xuetuzhiban-demo` 管理。”
