import Taro from '@tarojs/taro'

/**
 * 后端服务基础地址
 * 开发期填局域网/服务器地址（开发者工具勾选「不校验合法域名」即可联调）；
 * 域名备案通过后换成 HTTPS 正式域名。
 */
export const BASE_URL = 'http://YOUR_SERVER:3300/api'

/** 单用户鉴权 token（与服务器 .env 的 API_TOKEN 一致；仅本人自用） */
export const API_TOKEN = 'change-me'

/** 默认请求超时时间（毫秒） */
const DEFAULT_TIMEOUT = 10000

/** 后端统一响应包裹结构（草案，待与后端对齐） */
export interface ApiResponse<T = unknown> {
  /** 业务状态码，约定 0 表示成功 */
  code: number
  /** 提示信息 */
  message: string
  /** 业务数据 */
  data: T
}

/** 支持的 HTTP 方法 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

/** 请求参数 */
export interface RequestOptions {
  /** 接口路径，如 /training/plans（自动拼接 BASE_URL） */
  url: string
  /** 请求方法，默认 GET */
  method?: HttpMethod
  /** 请求参数：GET 时拼接 query string，其余作为 body */
  data?: Record<string, unknown>
  /** 自定义请求头 */
  header?: Record<string, string>
  /** 超时时间（毫秒），默认 10s */
  timeout?: number
}

/** 业务错误（服务端返回非 0 业务码时抛出） */
export class ApiError extends Error {
  /** 业务状态码 */
  code: number

  constructor (code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/**
 * 统一错误处理骨架：
 * 1. 网络层错误 —— Toast 提示并抛出原始 Error；
 * 2. HTTP 状态码非 2xx —— Toast 提示并抛出 ApiError；
 * 3. 业务码非 0（暂按 code !== 0 判定，待后端对齐）—— 不弹 Toast，抛出 ApiError 由调用方处理。
 *
 * 注意：登录态 token、重试、埋点等横切逻辑在此处预留位置，后续补充。
 */
export async function request<T = unknown> (options: RequestOptions): Promise<T> {
  const {
    url,
    method = 'GET',
    data,
    header,
    timeout = DEFAULT_TIMEOUT
  } = options

  try {
    const res = await Taro.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        Authorization: `Bearer ${API_TOKEN}`,
        ...header,
      },
      timeout
    })

    // HTTP 层错误
    if (res.statusCode < 200 || res.statusCode >= 300) {
      const msg = `请求失败（HTTP ${res.statusCode}）`
      Taro.showToast({ title: msg, icon: 'none' })
      throw new ApiError(res.statusCode, msg)
    }

    // 业务层错误（响应结构待后端对齐后调整）
    const body = res.data as ApiResponse<T>
    if (body && typeof body.code === 'number' && body.code !== 0) {
      throw new ApiError(body.code, body.message || '业务处理失败')
    }

    // 兼容后端未包裹统一结构的场景，直接透传 data
    return (body && typeof body.code === 'number' ? body.data : (res.data as T))
  } catch (error) {
    // 网络层错误（Taro.request 失败、超时等）
    if (!(error instanceof ApiError)) {
      Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
      console.error('[request] 网络错误：', options.url, error)
    }
    throw error
  }
}

/** GET 快捷方法 */
export function get<T = unknown> (url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'GET', data })
}

/** POST 快捷方法 */
export function post<T = unknown> (url: string, data?: Record<string, unknown>): Promise<T> {
  return request<T>({ url, method: 'POST', data })
}
