# E6 终评前最小安全防护设计：Basic Auth

## 目标

只在“真实版”入口和 API 上增加一个共享密码；导航页和演示版继续公开。

保护范围：

- `/apps/xuetuzhiban/app/`
- `/api/xuetuzhiban/`

保持公开：

- `/`
- `/apps/xuetuzhiban/`
- `/apps/xuetuzhiban/demo/`
- 前端静态资源 `/apps/xuetuzhiban/assets/`
- `/apps/xuetuzhiban/data/`

## 账号与密码

- 用户名：`xuetuzhiban`
- 密码：由 David 设置，不写入 Git、不打印在 issue。
- 密码文件：`/opt/hermes/2026agentapp-prod/auth/htpasswd`
- 权限：`640`，owner `ubuntu:www-data` 或 `root:www-data`

生成密码文件：

```bash
sudo mkdir -p /opt/hermes/2026agentapp-prod/auth
sudo sh -c 'printf "xuetuzhiban:%s\n" "$(openssl passwd -apr1)" > /opt/hermes/2026agentapp-prod/auth/htpasswd'
```

如果交互式设置密码：

```bash
sudo openssl passwd -apr1
```

然后把输出写成：

```text
xuetuzhiban:$apr1$xxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Nginx 设计

在 `/etc/nginx/snippets/xuetuzhiban.conf` 中使用以下顺序：

```nginx
location = / {
    root /opt/hermes/2026agentapp-prod/root-index;
    try_files /index.html =404;
}

location = /apps/xuetuzhiban/ {
    return 302 /apps/xuetuzhiban/demo/;
}

# 真实应用：需要密码
location /apps/xuetuzhiban/app/ {
    auth_basic "XueTuZhiBan";
    auth_basic_user_file /opt/hermes/2026agentapp-prod/auth/htpasswd;
    alias /opt/hermes/2026agentapp-prod/web/dist/;
    try_files $uri $uri/ /apps/xuetuzhiban/index.html;
}

# 真实 API：需要密码
location /api/xuetuzhiban/ {
    auth_basic "XueTuZhiBan";
    auth_basic_user_file /opt/hermes/2026agentapp-prod/auth/htpasswd;
    proxy_pass http://127.0.0.1:8001/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

# 演示版：保持公开
location /apps/xuetuzhiban/demo/ {
    alias /opt/hermes/2026agentapp-prod/web/dist/;
    try_files $uri $uri/ /apps/xuetuzhiban/index.html;
}

# 演示数据：保持公开
location /apps/xuetuzhiban/data/ {
    alias /opt/hermes/2026agentapp-prod/web/dist/data/;
    try_files $uri =404;
}

# 其他静态资源：保持公开
location /apps/xuetuzhiban/ {
    alias /opt/hermes/2026agentapp-prod/web/dist/;
    try_files $uri $uri/ /apps/xuetuzhiban/index.html;
}
```

## 为什么这样设计

- Basic Auth 是最小改动，不引入用户系统。
- 前端和 API 使用同一个 Nginx Basic Auth realm，浏览器会记住凭据。
- demo 和静态资源不保护，现场演示不会被登录框打断。
- 后端仍只绑定 `127.0.0.1:8001`，公网入口统一由 Nginx 保护。

## 部署与验证

```bash
# 1. 更新 snippet
sudo cp /opt/hermes/2026agentapp-prod/app/deploy/e6/nginx-xuetuzhiban.conf /etc/nginx/snippets/xuetuzhiban.conf

# 2. 生成密码文件
sudo mkdir -p /opt/hermes/2026agentapp-prod/auth
sudo openssl passwd -apr1

# 3. 测试 Nginx
sudo nginx -t

# 4. 重载
sudo systemctl reload nginx

# 5. 验证
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/apps/xuetuzhiban/demo/
curl -I http://127.0.0.1/apps/xuetuzhiban/app/
curl -u xuetuzhiban:密码 -I http://127.0.0.1/apps/xuetuzhiban/app/
```

预期：

- `/` 返回 200
- `/apps/xuetuzhiban/demo/` 返回 200
- `/apps/xuetuzhiban/app/` 无凭据返回 401
- 带正确凭据返回 200

## 回滚

如果现场出现浏览器反复弹密码框：

```bash
sudo cp /etc/nginx/snippets/xuetuzhiban.conf.bak /etc/nginx/snippets/xuetuzhiban.conf
sudo nginx -t
sudo systemctl reload nginx
```

部署前先备份：

```bash
sudo cp /etc/nginx/snippets/xuetuzhiban.conf /etc/nginx/snippets/xuetuzhiban.conf.bak
```

## 不保护的内容

- 前端 JS/CSS 静态资源仍公开，这是 Basic Auth 方案正常现象。
- 原图接口也走 `/api/xuetuzhiban/`，因此会被同一 Basic Auth 保护。
- 服务器 SSH、Hermes、systemd 内部访问不属于公网 Basic Auth 范围。
