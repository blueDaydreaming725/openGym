# ironday-server 部署（Ubuntu，无 Docker）

> 目标机器：Ubuntu 2C4G（与 OpenClaw 共存，本服务约 100MB 内存，无冲突）。

## 1. 安装 Node 20 与 pm2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm i -g pm2
```

## 2. 部署

```bash
cd ~/fitness-app/server
cp .env.example .env
# 编辑 .env：改 API_TOKEN（随机长串）、填 LLM_API_KEY（DeepSeek）
npm install
npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup   # 开机自启
```

验证：`curl http://127.0.0.1:3300/healthz` → `{"ok":true,...}`

## 3. 小程序侧联调（域名未备案期间）

1. 微信开发者工具 → 详情 → 本地设置 → 勾选 **「不校验合法域名…」**
2. `src/services/request.ts`：`BASE_URL` 填 `http://<服务器IP>:3300/api`，`API_TOKEN` 与 .env 一致
3. 手机真机预览/体验版：右上角「打开调试」开启后同样跳过域名校验
4. 防火墙放行端口：`sudo ufw allow 3300/tcp`（或仅在安全组放行给自己的 IP）

## 4. 域名备案通过后（转正式）

```bash
sudo apt-get install -y caddy
# /etc/caddy/Caddyfile:
#   fit.你的域名.com {
#     reverse_proxy 127.0.0.1:3300
#   }
sudo systemctl reload caddy
```

- Caddy 自动申请/续期 Let's Encrypt 证书
- 微信小程序后台 → 开发管理 → 服务器域名：把 `https://fit.你的域名.com` 加入 request 合法域名
- `request.ts` 的 `BASE_URL` 换成正式域名，关闭「不校验合法域名」

## 5. 备份

```bash
sqlite3 data/app.db ".backup backup-$(date +%F).db"   # 热备
curl -H "Authorization: Bearer $API_TOKEN" http://127.0.0.1:3300/api/export > export-$(date +%F).json
```

## 6. 与 OpenClaw 联动（可选彩蛋）

OpenClaw 与本服务同机，可让个人助理查健身数据：给 OpenClaw 配一个技能，用 `curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3300/api/export` 拉取数据（仅本机回环，不暴露公网）。M2 后可升级为正式 MCP server。
