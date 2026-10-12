import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import './knowledge.scss'
import { listKnowledge } from '../../services/storage'
import type { KnowledgeEntry } from '../../types/models'

/** 知识库：已导入的规则与知识条目（txt 上传 → LLM 解析 M2 接入） */
export default function Knowledge() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])

  useDidShow(() => {
    void (async () => {
      setEntries(await listKnowledge())
    })()
  })

  return (
    <View className='knowledge-page'>
      <Text className='page-title'>知识库</Text>
      <Text className='page-sub'>上传资料 → AI 总结进计划 · M2 接入</Text>

      {entries.length === 0 ? (
        <View className='card empty-card'>
          <Text className='empty-title'>还没有知识条目</Text>
          <Text className='empty-sub'>
            导入 Claw 计划后这里会有你的进阶规则与营养法则；之后可上传 txt 让 AI 消化进计划
          </Text>
        </View>
      ) : (
        entries.map(e => (
          <View key={e.id} className='card kb-entry'>
            <View className='kb-head'>
              <Text className='kb-title'>{e.title}</Text>
              <Text className='kb-cat'>{e.category}</Text>
            </View>
            {e.content.split('\n').filter(Boolean).map((line, i) => (
              <Text key={i} className='kb-line'>· {line}</Text>
            ))}
          </View>
        ))
      )}
    </View>
  )
}
