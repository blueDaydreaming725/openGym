import { useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import './diet.scss'
import {
  listDietRecords,
  saveDietRecord,
  deleteDietRecord,
  listFavoriteFoods,
  saveFavoriteFoods,
} from '../../services/storage'
import { parseMeal } from '../../services/agent'
import { fileToDataUrl, persistPhoto } from '../../utils/image'
import { genId } from '../../core/plan-templates'
import type { DietRecord, FoodItem, MealType } from '../../types/models'
import type { FavoriteFood } from '../../services/storage'

const MEALS: Array<{ key: MealType; label: string }> = [
  { key: 'breakfast', label: '早餐' },
  { key: 'lunch', label: '午餐' },
  { key: 'dinner', label: '晚餐' },
  { key: 'snack', label: '加餐' },
]

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

interface DraftFood {
  name: string
  portion: string
  calories: string
}

/** 饮食模块：拍照识别 → 确认修正 → 入库；手动录入兜底；常用食物沉淀 */
export default function Diet() {
  const [records, setRecords] = useState<DietRecord[]>([])
  const [favorites, setFavorites] = useState<FavoriteFood[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  /** 编辑中的识别/手动草稿 */
  const [draft, setDraft] = useState<{ foods: DraftFood[]; comment: string; photoPath: string }>()
  const [draftMeal, setDraftMeal] = useState<MealType>('lunch')

  useDidShow(() => {
    void (async () => {
      setRecords(await listDietRecords(todayStr()))
      setFavorites(await listFavoriteFoods())
    })()
  })

  const reload = async () => {
    setRecords(await listDietRecords(todayStr()))
    setFavorites(await listFavoriteFoods())
  }

  /** 拍照/选图 → 视觉解析 → 进入确认编辑 */
  const pickPhoto = () => {
    Taro.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: res => {
        const path = res.tempFiles[0]?.tempFilePath
        if (!path) return
        void (async () => {
          setParsing(true)
          setParseError('')
          try {
            const dataUrl = await fileToDataUrl(path)
            const result = await parseMeal(dataUrl)
            setDraft({
              foods: result.foods.map(f => ({
                name: f.name,
                portion: f.portion ?? '',
                calories: String(f.calories),
              })),
              comment: result.comment,
              photoPath: path,
            })
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setParseError(msg.slice(0, 60))
          } finally {
            setParsing(false)
          }
        })()
      },
    })
  }

  /** 手动添加一份食物进草稿 */
  const startManual = () => {
    setDraft({ foods: [{ name: '', portion: '', calories: '' }], comment: '', photoPath: '' })
    setParseError('')
  }

  const patchFood = (idx: number, p: Partial<DraftFood>) => {
    setDraft(prev =>
      prev ? { ...prev, foods: prev.foods.map((f, i) => (i === idx ? { ...f, ...p } : f)) } : prev,
    )
  }

  const addFoodFromFavorites = (fav: FavoriteFood) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            foods: [
              ...prev.foods,
              { name: fav.name, portion: fav.portion ?? '', calories: String(fav.calories) },
            ],
          }
        : prev,
    )
  }

  const draftTotal = () =>
    (draft?.foods ?? []).reduce((s, f) => s + (Number(f.calories) || 0), 0)

  /** 保存草稿为一餐，并询问是否存为常用 */
  const saveMeal = () => {
    if (!draft) return
    const foods: FoodItem[] = draft.foods
      .filter(f => f.name.trim() && Number(f.calories) > 0)
      .map(f => ({
        name: f.name.trim(),
        portion: f.portion.trim() || undefined,
        calories: Math.round(Number(f.calories)),
      }))
    if (foods.length === 0) {
      Taro.showToast({ title: '至少一条有效食物（名称+卡路里）', icon: 'none' })
      return
    }
    void (async () => {
      const photoPath = draft.photoPath ? await persistPhoto(draft.photoPath) : ''
      const record: DietRecord = {
        id: genId('diet'),
        date: todayStr(),
        mealType: draftMeal,
        foods,
        totalCalories: foods.reduce((s, f) => s + f.calories, 0),
        photoRefs: photoPath ? [photoPath] : [],
        comment: draft.comment || undefined,
      }
      await saveDietRecord(record)
      setDraft(undefined)
      await reload()
      Taro.showModal({
        title: '已记录这一餐',
        content: '把这几种食物存为常用？下次可快速添加',
        confirmText: '存为常用',
        cancelText: '不用',
        success: r => {
          if (!r.confirm) return
          void (async () => {
            const favs = await listFavoriteFoods()
            const merged = [...favs]
            for (const f of foods) {
              if (!merged.some(x => x.name === f.name)) {
                merged.push({ name: f.name, portion: f.portion, calories: f.calories })
              }
            }
            await saveFavoriteFoods(merged)
            Taro.showToast({ title: `已存 ${merged.length - favs.length} 个常用`, icon: 'success' })
          })()
        },
      })
    })()
  }

  const removeRecord = (id: string) => {
    Taro.showModal({
      title: '删除这一餐？',
      success: r => {
        if (!r.confirm) return
        void deleteDietRecord(id).then(reload)
      },
    })
  }

  const total = records.reduce((s, r) => s + r.totalCalories, 0)

  return (
    <View className='diet-page'>
      <Text className='page-title'>饮食</Text>
      <Text className='page-sub'>拍照自动算卡路里，保存前可逐项修正</Text>

      {/* 今日摄入 hero */}
      <View className='card card-hero diet-card'>
        <Text className='sec-label'>今日摄入</Text>
        <View className='diet-row'>
          <Text className='diet-num num'>{total}</Text>
          <Text className='diet-unit'>kcal</Text>
        </View>
        <Text className='diet-count num'>已记录 {records.length} 餐</Text>
      </View>

      {/* 操作 */}
      <View className='action-row'>
        <View className='btn-primary action-btn' onClick={pickPhoto}>
          <Text className='btn-primary-text'>{parsing ? '识别中…' : '拍照记录'}</Text>
        </View>
        <View className='btn-secondary action-btn' onClick={startManual}>
          <Text className='manual-text'>手动添加</Text>
        </View>
      </View>
      {parsing && <Text className='parse-hint'>视觉模型识别中，约 3-8 秒…</Text>}
      {parseError !== '' && <Text className='parse-error'>识别失败：{parseError}（可先手动添加）</Text>}

      {/* 确认修正草稿 */}
      {draft && (
        <View className='card draft-card'>
          <Text className='sec-label'>确认这一餐（可逐项修改）</Text>
          {draft.foods.map((f, idx) => (
            <View key={idx} className='food-row'>
              <Input
                className='food-name'
                value={f.name}
                placeholder='食物名'
                onInput={e => patchFood(idx, { name: e.detail.value })}
              />
              <Input
                className='food-portion'
                value={f.portion}
                placeholder='份量'
                onInput={e => patchFood(idx, { portion: e.detail.value })}
              />
              <Input
                className='food-cal num'
                type='number'
                value={f.calories}
                placeholder='kcal'
                onInput={e => patchFood(idx, { calories: e.detail.value })}
              />
              <Text
                className='food-del'
                onClick={() =>
                  setDraft(prev =>
                    prev ? { ...prev, foods: prev.foods.filter((_, i) => i !== idx) } : prev,
                  )
                }
              >
                ×
              </Text>
            </View>
          ))}
          {favorites.length > 0 && (
            <Picker
              mode='selector'
              range={favorites.map(f => `${f.name} ${f.calories}kcal`)}
              onChange={e => addFoodFromFavorites(favorites[Number(e.detail.value)])}
            >
              <Text className='fav-add'>从常用食物添加</Text>
            </Picker>
          )}
          <Text className='draft-total num'>合计 {draftTotal()} kcal</Text>
          {draft.comment !== '' && <Text className='draft-comment'>{draft.comment}</Text>}

          <View className='meal-pick'>
            <Picker
              mode='selector'
              range={MEALS.map(m => m.label)}
              value={MEALS.findIndex(m => m.key === draftMeal)}
              onChange={e => setDraftMeal(MEALS[Number(e.detail.value)].key)}
            >
              <Text className='meal-pick-btn'>
                餐次：{MEALS.find(m => m.key === draftMeal)?.label}
              </Text>
            </Picker>
          </View>

          <View className='btn-primary' onClick={saveMeal}>
            <Text className='btn-primary-text'>保存这一餐</Text>
          </View>
        </View>
      )}

      {/* 今日记录列表 */}
      <View className='card'>
        <Text className='sec-label'>今日记录</Text>
        {records.length === 0 && <Text className='rec-empty'>今天还没记录，拍一张开始</Text>}
        {records.map(r => (
          <View key={r.id} className='rec-row'>
            <View className='rec-main'>
              <Text className='rec-meal'>
                {MEALS.find(m => m.key === r.mealType)?.label} ·{' '}
                {r.foods.map(f => f.name).join('、')}
              </Text>
              <Text className='rec-cal num'>{r.totalCalories} kcal</Text>
            </View>
            {r.comment && <Text className='rec-comment'>{r.comment}</Text>}
            <Text className='rec-del' onClick={() => removeRecord(r.id)}>删除</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
