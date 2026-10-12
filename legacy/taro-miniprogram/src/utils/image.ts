import Taro from '@tarojs/taro'

/** 小程序/H5 双端把图片文件读成 data URL（供视觉 LLM 解析） */
export async function fileToDataUrl(path: string): Promise<string> {
  // 微信小程序：FileSystemManager 直接读 base64
  if (process.env.TARO_ENV === 'weapp') {
    const fsm = Taro.getFileSystemManager()
    const data = fsm.readFileSync(path, 'base64')
    return `data:image/jpeg;base64,${data}`
  }
  // H5：tempFilePath 是 blob URL，fetch + FileReader
  const blob = await (await fetch(path)).blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

/** 把临时图片持久化（仅小程序有 saveFile；H5 保留临时 URL，本会话内有效） */
export async function persistPhoto(tempPath: string): Promise<string> {
  if (process.env.TARO_ENV === 'weapp') {
    try {
      const res = (await Taro.getFileSystemManager().saveFile({
        tempFilePath: tempPath,
      })) as unknown as { savedFilePath?: string }
      return res?.savedFilePath ?? tempPath
    } catch {
      return tempPath
    }
  }
  return tempPath
}

declare const process: { env: { TARO_ENV?: string } }
