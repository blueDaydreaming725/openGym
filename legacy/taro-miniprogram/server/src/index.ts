import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { config } from './config.js'
import { db, exportAll } from './db.js'
import { agentRouter } from './agent.js'

const app = express()
app.use(express.json({ limit: '8mb' }))

/** 静态托管 H5 版小程序（构建时由 fitness-app/dist 拷入 public/） */
const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/** 单用户 token 鉴权 */
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization ?? ''
  if (auth !== `Bearer ${config.apiToken}`) {
    res.status(401).json({ code: 401, message: 'unauthorized' })
    return
  }
  next()
})

// 健康检查（无需鉴权，供监控/探测）
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

app.get('/api/ping', (_req, res) => {
  res.json({ code: 0, message: 'pong', data: null })
})

// M2 agent 端点：拍照算卡路里 + 补剂推荐
app.use('/api/agent', agentRouter)

// 饮食记录与周期复盘的上行同步（整包 upsert）
app.put('/api/diet/:id', (req, res) => {
  db.prepare(
    `INSERT INTO diet_records (id, data) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
  ).run(req.params.id, JSON.stringify(req.body))
  res.json({ code: 0, message: 'ok', data: null })
})

app.put('/api/reviews/:id', (req, res) => {
  const cycleId = String(req.body?.cycleId ?? 'unknown')
  db.prepare(
    `INSERT INTO cycle_reviews (id, cycle_id, data) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, created_at = datetime('now')`,
  ).run(req.params.id, cycleId, JSON.stringify(req.body))
  res.json({ code: 0, message: 'ok', data: null })
})

/** 数据全量导出/备份 */
app.get('/api/export', (_req, res) => {
  res.json({ code: 0, message: 'ok', data: exportAll() })
})

// ── 数据同步（M2 完整 CRUD 前的通版 upsert：整包覆盖写） ──

app.put('/api/plans/:id', (req, res) => {
  db.prepare(
    `INSERT INTO plans (id, data) VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
  ).run(req.params.id, JSON.stringify(req.body))
  res.json({ code: 0, message: 'ok', data: null })
})

app.put('/api/records/:id', (req, res) => {
  const cycleId = String(req.body?.cycleId ?? '')
  const status = String(req.body?.status ?? 'completed')
  db.prepare(
    `INSERT INTO session_records (id, cycle_id, status, data) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, status = excluded.status, updated_at = datetime('now')`,
  ).run(req.params.id, cycleId, status, JSON.stringify(req.body))
  res.json({ code: 0, message: 'ok', data: null })
})

// ── M2 占位：周期复盘 agent（下一阶段在此接入 codecare 蓝本 runtime） ──

app.post('/api/agent/review', (_req, res) => {
  res.status(501).json({
    code: 501,
    message: 'agent runtime 未接入（M2）；当前复盘在端上用规则引擎（src/core/progression.ts）',
    data: null,
  })
})

// 阅后即焚：体检报告解析——不落库、不打日志（M2 接入）
app.post('/api/agent/health-parse', (_req, res) => {
  res.status(501).json({ code: 501, message: 'M2 接入', data: null })
})

app.listen(config.port, () => {
  console.log(`[ironday-server] listening on :${config.port} (db: ${config.dbPath})`)
})

// ── H5 静态资源（放最后：API 优先，其余 GET 回退 index.html） ──
import { existsSync } from 'node:fs'
app.use(express.static(publicDir))
app.use((req, res, next) => {
  if (req.method !== 'GET') return next()
  if (req.path.startsWith('/api') || req.path === '/healthz') return next()
  const index = join(publicDir, 'index.html')
  if (existsSync(index)) return res.sendFile(index)
  next()
})
