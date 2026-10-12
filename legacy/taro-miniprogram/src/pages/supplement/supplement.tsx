import { useEffect, useState } from 'react'
import { View, Text, Input, Picker, Textarea } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import './supplement.scss'
import {
  listSupplementPlans,
  saveSupplementPlan,
  getHealthMetrics,
  saveHealthMetrics,
  getProfile,
  listPlans,
} from '../../services/storage'
import { supplementChat, healthParse } from '../../services/agent'
import type { ParsedHealthMetric } from '../../services/agent'
import { fileToDataUrl } from '../../utils/image'
import { genId } from '../../core/plan-templates'
import type { HealthFlag, HealthMetric } from '../../types/agent'
import type { SupplementPlan } from '../../types/models'

const FLAGS: Array<{ key: HealthFlag; label: string }> = [
  { key: 'normal', label: '正常' },
  { key: 'low', label: '偏低' },
  { key: 'high', label: '偏高' },
  { key: 'critical', label: '危急' },
]

type ChatMsg = { role: 'user' | 'assistant'; content: string; planItems?: Array<{ name: string; dosage: string; timing: string }> }

const CHAT_KEY = 'fa:supp-chat'

/** 补给管理：体检指标（文字/照片批量录入，仅本机）+ AI 营养师对话 + 已定计划 */
export default function Supplement() {
  const [plans, setPlans] = useState<SupplementPlan[]>([])
  const [metrics, setMetrics] = useState<HealthMetric[]>([])

  // 体检报告解析
  const [reportText, setReportText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseErr, setParseErr] = useState('')
  const [parsed, setParsed] = useState<ParsedHealthMetric[]>([])
  const [parsedFlags, setParsedFlags] = useState<Record<number, HealthFlag>>({})

  // AI 对话
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)

  useDidShow(() => {
    void (async () => {
      setPlans(await listSupplementPlans())
      setMetrics(await getHealthMetrics())
      try {
        const res = await Taro.getStorage({ key: CHAT_KEY })
        setChat((res.data as ChatMsg[]) ?? [])
      } catch { /* 无历史 */ }
    })()
  })

  useEffect(() => {
    // 新消息后滚到底（尽力而为）
    if (chat.length > 0 || thinking) {
      Taro.pageScrollTo({ scrollTop: 999999, duration: 200 }).catch(() => {})
    }
  }, [chat.length, thinking])

  const persistChat = (msgs: ChatMsg[]) => {
    setChat(msgs)
    void Taro.setStorage({ key: CHAT_KEY, data: msgs })
  }

  /** 解析体检报告（粘贴文字或拍照） */
  const parseReport = (imageDataUrl?: string) => {
    if (!imageDataUrl && reportText.trim().length <= 20) {
      Taro.showToast({ title: '粘贴至少 20 字的报告内容', icon: 'none' })
      return
    }
    void (async () => {
      setParsing(true)
      setParseErr('')
      try {
        const result = await healthParse(
          imageDataUrl ? undefined : reportText.trim(),
          imageDataUrl,
        )
        setParsed(result.metrics)
        setParsedFlags(
          Object.fromEntries(result.metrics.map((m, i) => [i, m.flag])) as Record<number, HealthFlag>,
        )
      } catch (e) {
        setParseErr((e instanceof Error ? e.message : '解析失败').slice(0, 60))
      } finally {
        setParsing(false)
      }
    })()
  }

  const pickReportPhoto = () => {
    Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: res => {
        const path = res.tempFiles[0]?.tempFilePath
        if (!path) return
        void fileToDataUrl(path).then(dataUrl => parseReport(dataUrl))
      },
    })
  }

  const setParsedFlag = (idx: number, flag: HealthFlag) => {
    setParsedFlags(prev => ({ ...prev, [idx]: flag }))
  }

  /** 全部保存（按 key 合并覆盖） */
  const saveParsed = () => {
    if (parsed.length === 0) return
    void (async () => {
      const today = new Date().toISOString().slice(0, 10)
      const merged = [...metrics]
      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i]
        const flag = parsedFlags[i] ?? p.flag
        merged.splice(
          merged.findIndex(x => x.key === p.key) >= 0
            ? merged.findIndex(x => x.key === p.key)
            : merged.length,
          merged.findIndex(x => x.key === p.key) >= 0 ? 1 : 0,
          { key: p.key, label: p.label, value: p.value, unit: p.unit, flag, recordedAt: today },
        )
      }
      await saveHealthMetrics(merged)
      setMetrics(merged)
      setParsed([])
      setReportText('')
      Taro.showToast({ title: `已保存 ${parsed.length} 项（仅本机）`, icon: 'success' })
    })()
  }

  /** AI 对话：发送（上下文 = 体检指标 + 当前计划 + 体重/目标） */
  const send = (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || thinking) return
    void (async () => {
      const history: ChatMsg[] = [...chat, { role: 'user', content }]
      persistChat([...history])
      setInput('')
      setThinking(true)
      try {
        const plans = await listPlans()
        const plan = plans[plans.length - 1]
        const profile = await getProfile()
        const result = await supplementChat(
          history.map(m => ({ role: m.role, content: m.content })),
          {
            goal: plan?.type === 'fatloss' ? 'cut' : 'maintain',
            weightKg: profile.weightKg,
            planSummary: plan ? `${plan.name}（每周期 ${plan.trainDaysPerCycle} 练）` : '尚无计划',
            体检指标: metrics.map(m => `${m.label}=${m.value}${m.unit}(${m.flag})`).join('；') || '未录入',
          },
        )
        const reply = result.reply
        const planLines = reply.match(/\[PLAN\][^\n]+/g) ?? []
        const planItems = planLines
          .map(l => {
            const [name = '', dosage = '', timing = ''] = l.replace('[PLAN]', '').split('|').map(s => s.trim())
            return { name, dosage, timing }
          })
          .filter(x => x.name)
        persistChat([...history, { role: 'assistant', content: reply.replace(/\[PLAN\][^\n]+/g, '').trim(), planItems }])
      } catch (e) {
        persistChat([...history, { role: 'assistant', content: `⚠ ${e instanceof Error ? e.message : '对话失败'}` }])
      } finally {
        setThinking(false)
      }
    })()
  }

  /** 把某条 AI 回复里的 [PLAN] 方案采纳为补剂计划 */
  const adoptPlan = (msg: ChatMsg) => {
    if (!msg.planItems || msg.planItems.length === 0) return
    void (async () => {
      const plan: SupplementPlan = {
        id: genId('supp'),
        name: `AI 对话方案 · ${new Date().toISOString().slice(0, 10)}`,
        items: msg.planItems!.map(it => ({ ...it, timesPerDay: 1 })),
        startDate: new Date().toISOString().slice(0, 10),
        note: '来自补给页 AI 对话',
      }
      await saveSupplementPlan(plan)
      setPlans(await listSupplementPlans())
      Taro.showToast({ title: '已采纳，首页可打卡', icon: 'success' })
    })()
  }

  return (
    <View className='supplement-page'>
      <Text className='page-title'>补给</Text>
      <Text className='page-sub'>AI 营养师 · 体检指标仅存本机</Text>

      {/* 体检指标（本机） */}
      <View className='card'>
        <View className='sec-head'>
          <Text className='sec-label'>体检指标（仅存本机）</Text>
          <Text className='metric-count num'>{metrics.length} 项</Text>
        </View>
        {metrics.map(m => (
          <View key={m.key} className='metric-row'>
            <Text className='metric-name'>{m.label}</Text>
            <Text className={`metric-val num flag-${m.flag}`}>
              {m.value} {m.unit} · {FLAGS.find(f => f.key === m.flag)?.label}
            </Text>
            <Text className='metric-del' onClick={() => {
              const next = metrics.filter(x => x.key !== m.key)
              void saveHealthMetrics(next).then(() => setMetrics(next))
            }}>×</Text>
          </View>
        ))}
        {metrics.length === 0 && <Text className='empty-line'>录入后，AI 的建议会自动避开你的异常项</Text>}

        {/* 批量录入：粘贴文字 / 拍照 */}
        {!parsed.length && (
          <View className='parse-block'>
            <Textarea
              className='report-input'
              value={reportText}
              placeholder='把体检报告的文字粘贴到这里（app/公众号里可复制）；或拍照识别'
              maxlength={-1}
              onInput={e => setReportText(e.detail.value)}
            />
            <View className='parse-actions'>
              <View className='btn-secondary parse-btn' onClick={() => parseReport()}>
                <Text>{parsing ? '解析中…' : '解析文字'}</Text>
              </View>
              <View className='btn-secondary parse-btn' onClick={pickReportPhoto}>
                <Text>{parsing ? '识别中…' : '拍照识别'}</Text>
              </View>
            </View>
            {parseErr !== '' && <Text className='parse-error'>解析失败：{parseErr}</Text>}
          </View>
        )}

        {/* 解析结果确认（可改标记后一键保存） */}
        {parsed.length > 0 && (
          <View className='parsed-block'>
            <Text className='parsed-title'>识别到 {parsed.length} 项，确认标记后保存</Text>
            {parsed.map((m, i) => (
              <View key={`${m.key}_${i}`} className='metric-row'>
                <Text className='metric-name'>{m.label}</Text>
                <Text className='metric-val num'>{m.value} {m.unit}</Text>
                <Picker
                  mode='selector'
                  range={FLAGS.map(f => f.label)}
                  value={FLAGS.findIndex(f => f.key === (parsedFlags[i] ?? m.flag))}
                  onChange={e => setParsedFlag(i, FLAGS[Number(e.detail.value)].key)}
                >
                  <Text className={`metric-flag flag-${parsedFlags[i] ?? m.flag}`}>
                    {FLAGS.find(f => f.key === (parsedFlags[i] ?? m.flag))?.label} ▾
                  </Text>
                </Picker>
              </View>
            ))}
            <View className='btn-primary save-parsed' onClick={saveParsed}>
              <Text className='btn-primary-text'>全部保存（仅本机）</Text>
            </View>
          </View>
        )}
      </View>

      {/* AI 营养师对话 */}
      <View className='card chat-card'>
        <View className='sec-head'>
          <Text className='sec-label'>AI 营养师</Text>
          <Text
            className='sec-action'
            onClick={() => {
              Taro.showModal({
                title: '清空对话',
                content: '聊天记录只存在本机',
                success: r => { if (r.confirm) { persistChat([]) } },
              })
            }}
          >
            清空
          </Text>
        </View>

        {chat.length === 0 && (
          <Text className='chat-empty'>
            问问它：{metrics.length > 0 ? '结合我的体检指标' : '减脂期'}每天该吃哪些补剂、剂量和时间怎么安排
          </Text>
        )}
        {chat.map((m, i) => (
          <View key={i} className={`bubble ${m.role}`}>
            <Text className='bubble-text'>{m.content}</Text>
            {m.role === 'assistant' && m.planItems && m.planItems.length > 0 && (
              <View className='adopt-btn' onClick={() => adoptPlan(m)}>
                <Text className='adopt-text'>采纳为补剂计划（{m.planItems.length} 项）</Text>
              </View>
            )}
          </View>
        ))}
        {thinking && <View className='bubble assistant'><Text className='bubble-text'>思考中…</Text></View>}

        <View className='chat-input-row'>
          <Input
            className='chat-input'
            value={input}
            placeholder={metrics.length > 0 ? '结合我的体检指标问问它…' : '问问营养师…'}
            confirmType='send'
            onInput={e => setInput(e.detail.value)}
            onConfirm={() => send()}
          />
          <View className='chat-send' onClick={() => send()}>
            <Text className='chat-send-text'>发送</Text>
          </View>
        </View>
      </View>

      {/* 已定下来的补给 */}
      <View className='card'>
        <Text className='sec-label'>当前定下来的补给</Text>
        {plans.length === 0 && <Text className='empty-line'>还没有定下方案，和 AI 聊聊或直接采纳建议</Text>}
        {plans.map(p => (
          <View key={p.id} className='supp-plan'>
            <Text className='plan-name'>{p.name}</Text>
            {p.items.map((it, i) => (
              <View key={i} className='supp-row'>
                <Text className='supp-name'>{it.name}</Text>
                <Text className='supp-dose num'>{it.dosage} · {it.timing}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  )
}
