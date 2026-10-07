/**
 * 游戏路由参数解析（纯函数，无浏览器依赖，可测试）
 *
 * 路由：
 *   #/play?l=1-1                 闯关：完整关卡
 *   #/play?a=jump&m=beat         练习：节奏模式
 *   #/play?a=bothHandsUp&m=hold  练习：模仿模式
 */
import { ACTIONS } from '../pose'
import { levelById } from '../levels'
import type { Level } from '../levels'

export type ActionId = string

export interface PlayParams {
  level?: Level
  /** 练习模式 */
  practiceAction?: ActionId
  practiceMode?: 'hold' | 'beat'
}

export function parsePlayParams(hash: string): PlayParams | null {
  // 只认 #/play 开头的路由
  const m = hash.match(/^#\/play(?:\?(.*))?$/)
  if (!m) return null
  const q = new URLSearchParams(m[1] ?? '')
  const l = q.get('l')
  if (l) {
    const level = levelById(l)
    if (level) return { level }
    return null
  }
  const a = q.get('a')
  const mode = q.get('m')
  if (a && ACTIONS[a] && (mode === 'hold' || mode === 'beat')) {
    return { practiceAction: a, practiceMode: mode }
  }
  return null
}
