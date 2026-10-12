# ironday 融合分支

fork 自 [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)（AGPL-3.0，随 fork 继承）。

本分支在 openGym 底座上融合个人健身系统「铁日 IronDay」的领域能力：**底座用 openGym（UI/训练交互/同步/5600 动作库/Coach AI 体系），IronDay 补充它没有的领域模块**。

## 已融合

| 模块 | 位置 | 说明 |
|---|---|---|
| 周期护栏 | `api/ironday/domain.js` | 加重上限（≤5% 且 ≤2.5kg）、1RM 估算、连续失败减载——LLM 复盘提案必须过的规则层 |
| 循证补剂基础盘 | `api/ironday/domain.js` | 肌酸/蛋白/咖啡因/维D/鱼油/镁/电解质的规则推荐 + 体检冲突表（肾/血压/尿酸） |
| LLM 封装 | `api/ironday/llm.js` | OpenAI 兼容端点（GLM/Qwen/DeepSeek），零新依赖 |
| 餐食识别 | `POST /api/ironday/meal-parse` | 视觉模型 → 结构化食物清单（拍照算卡路里的服务端） |
| 体检解析 | `POST /api/ironday/health-parse` | 报告文字/照片 → 结构化指标；**阅后即焚**（不落库不落日志），flag 以规则表兜底 |
| 补剂对话 | `POST /api/ironday/supplement-chat` | 营养师聊天（上下文=体检指标+训练数据），响应附规则基础盘供前端对照 |
| Taro 小程序（归档） | `legacy/taro-miniprogram/` | 前一版微信小程序全套代码（训练闭环/复盘/饮食/补剂已验证），留作未来小程序客户端的对接参考；其 `server/` 已被本仓库 api 取代 |

## 部署（Linux + Docker 或裸 Node 均可）

ironday 模块的环境变量（在 openGym 原有配置之外）：

```bash
IRONDAY_LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
IRONDAY_LLM_KEY=<智谱 key>
IRONDAY_LLM_MODEL=glm-5.3-flash   # 原生多模态，文本+视觉一个模型
```

完整部署（docker compose 一键）见 [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)。无 Docker 时参考 `api/server.js` 的裸跑方式（Node 20+）。

## 与小程序的对接规划

openGym 的 REST API + passkey/密码登录即"健身大脑"；微信小程序作为纯 UI 客户端对接（`legacy/taro-miniprogram/src/services/request.ts` 的 BASE_URL 指向本服务即可复用已写好的训练/复盘 UI）。对接点：

- 训练数据读写：openGym 原生 sync API（`/api/state` 系列）
- AI 能力：`/api/coach/*`（计划/复盘）+ `/api/ironday/*`（餐食/体检/补剂）

## License

AGPL-3.0（继承自上游；本分支全部改动同样 AGPL-3.0）。
