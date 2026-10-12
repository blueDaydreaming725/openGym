# 部署交接 v2（给 OpenClaw / 运维 agent）· 代码以 tarball 到位

> 给主人：把本文件全文发给服务器上的 Claw，并先在 Mac 上执行一条 scp 把包传上去（见文末）。

## 与 v1 的差异

1. **代码来源改为 tarball**：主人会把 `ironday-deploy.tar.gz` 上传到服务器 `~/ironday-deploy.tar.gz`（无 git 仓库、无凭证）。
2. **防火墙决策（主人已拍板）：选 A，放行公网 3300**。原因：本次要提供**公网 H5 体验地址**（手机浏览器直开），仅靠 API_TOKEN 鉴权 + 后续可随时收紧。请在汇报里确认安全组规则已由主人在腾讯云控制台添加（你无需操作）。
3. 新增验证：`GET /` 应返回 HTML（服务现在同时托管 H5 前端）。

## 步骤

```bash
# 0. 解包（代码到位）
mkdir -p ~/fitness-app && tar -xzf ~/ironday-deploy.tar.gz -C ~/fitness-app
cd ~/fitness-app/server

# 1. 依赖
npm install

# 2. 配置
cp .env.example .env
# API_TOKEN 用 openssl rand -hex 24 生成写入（不要回显内容）
# LLM_API_KEY 留空（主人稍后自填）

# 3. 构建 + 启动
npm run build
pm2 start ecosystem.config.cjs && pm2 save
# pm2 startup 若输出 sudo 命令，用 env "PATH=$PATH" 前缀执行

# 4. 防火墙（选 A）
# ufw 若 inactive 则无需动作；公网放行由主人在腾讯云控制台安全组添加 3300/TCP
```

## 验收（原样汇报输出）

```bash
curl -s http://127.0.0.1:3300/healthz                 # {"ok":true,...}
curl -s -H "Authorization: Bearer $(grep API_TOKEN .env | cut -d= -f2)" http://127.0.0.1:3300/api/ping
                                                       # {"code":0,...,"message":"pong"}
curl -s http://127.0.0.1:3300/api/ping                 # {"code":401,...}
curl -s http://127.0.0.1:3300/ | head -c 120           # <!DOCTYPE html>（H5 首页）
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3300/js/$(ls public/js | head -1)
                                                       # 200（静态资源）
pm2 ls                                                 # ironday-server online
```

## 最终汇报需包含

1. 服务器**公网 IP**（主人要用它生成体验地址 `http://<公网IP>:3300/`）
2. 上述每条 curl 的实际输出（**API_TOKEN 不要出现在任何输出/日志里**）
3. pm2 状态
4. 遗留问题清单

## 禁止事项（同 v1）

- 不回显 API_TOKEN / .env 内容
- 不修改 `src/` 与 `public/` 里的文件
- 不做任务书外的系统级变更、不动 OpenClaw
