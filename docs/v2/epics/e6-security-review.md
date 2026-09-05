# E6 安全现状与加固建议

## 1. 当前边界

- 公网当前无认证。
- 只允许合成或脱敏演示数据。
- 不处理真实学生、账号、成绩等敏感数据。
- API 只绑定 `127.0.0.1:8001`，公网经 Nginx 进入。

这个边界让 V2 MVP 能快速演示，但一旦公开写接口，任何访问者都可能调用。

## 2. 已识别的安全风险

| 风险 | 说明 | 当前影响 |
| --- | --- | --- |
| 未认证写接口 | 任何人可上传图片、创建 OCR/Hermes job、改 memory/confirmation | 高：消耗费用、磁盘、制造脏数据 |
| 费用滥用 | OCR 与 Hermes 调用会产生腾讯云/模型费用 | 高：无限调用可刷账单 |
| 磁盘滥用 | 未登录用户持续上传图片 | 中：占满私有目录 |
| CORS 过宽 | 当前 `Access-Control-Allow-Origin: *` | 中：允许任意网站借用浏览器发起 API 请求 |
| 无 HTTPS | 当前 HTTP，流量可被窃听/篡改 | 中：域名备案后必须切换 |
| 无速率限制 | 没有请求频率上限 | 高：放大费用滥用 |
| 原图可读 | 拥有 upload_id 即可读私有图片 | 中：ID 随机但无授权 |
| 无审计 | 不知道谁在什么时候调用了写接口 | 中：出问题难追溯 |
| 密钥暴露面 | OCR secret 只应存在于 VPS，不进入 Git/前端 | 中：当前边界正确，但需持续扫描 |

## 3. 加固优先级

### 终评前建议不做的

- 不临时加复杂登录，避免影响现场演示。
- 不做 IP 白名单，可能挡住评委网络。

### 终评后建议尽快做

1. 公网只读保护
   - `/apps/xuetuzhiban/demo/` 保持公开
   - `/apps/xuetuzhiban/app/` 与 `/api/xuetuzhiban/` 加共享访问口令

2. 简单 shared-token 方案
   - Nginx 对写接口要求固定 Header
   - 前端演示页通过服务端注入 token 或维护者提前输入 token
   - 更稳妥是 Nginx Basic Auth

3. 限制写接口
   - 默认只允许 `GET`
   - `POST` 只开放必要路径

4. 速率限制
   - Nginx `limit_req_zone` 限制 API 请求频率
   - 业务侧限制单用户/单 IP 上传数量

5. 配额与失败上限
   - 每日 OCR/Hermes job 上限
   - 上传文件大小保持 7 MiB，且限制总 upload 数量

6. 收紧 CORS
   - 只允许 `https://jingyun.bj.cn` 或同源
   - 不允许 `*`

7. HTTPS
   - ICP 备案完成后启用 TLS
   - 强制 HTTP 跳转 HTTPS

8. 原图访问授权
   - 图片接口走 token 校验
   - 返回 `Cache-Control: private, no-store`

9. 审计日志
   - 写接口记录时间、来源 IP、job_id
   - 不记录图片内容和完整 secret

10. 密钥与隐私扫描
   - 部署后自动运行 `xuetuzhiban-privacy-scan`
   - 禁止 secret 进入 Git/前端/public

## 4. 最小落地顺序

```text
1. shared token / Basic Auth
2. Nginx 限制 POST + rate limit
3. CORS 收紧
4. OCR/Hermes job 配额
5. HTTPS
6. 审计与告警
```

## 5. 不建议做

- 不立即引入完整用户系统、OAuth、RBAC
- 不引入 COS/Redis/复杂 WAF
- 不把“现在加了 token”解释为生产级安全
