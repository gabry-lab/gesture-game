/**
 * 关卡数据结构：3 章节 × 3 关
 */
import type { ActionTemplate } from './pose/actions'
import { ACTIONS } from './pose/actions'

export interface LevelStep {
  action: ActionTemplate
  /** hold 型：完成该动作（保持 holdMs）；beat 型：在节拍窗口内做对 */
  repeats: number
}

export interface Level {
  id: string
  chapter: number // 0-based
  index: number   // 章节内 0-based
  name: string
  emoji: string
  /** 节奏模式的 BPM（hold 型动作穿插其中） */
  bpm: number
  steps: LevelStep[]
}

const a = (id: string, repeats = 1): LevelStep => ({ action: ACTIONS[id], repeats })

export const CHAPTERS = [
  { name: '热身跳跳', emoji: '🌟', desc: '认识动作，轻松开始' },
  { name: '大运动乐园', emoji: '💪', desc: '全身动起来！' },
  { name: '协调挑战', emoji: '🎯', desc: '跟着节奏秀操作' },
] as const

export const LEVELS: Level[] = [
  // 第一章：热身（模仿为主，节拍很轻）
  { id: '1-1', chapter: 0, index: 0, name: '举手敬礼', emoji: '🫡', bpm: 70,
    steps: [a('bothHandsUp', 2), a('leftUp', 1), a('rightUp', 1)] },
  { id: '1-2', chapter: 0, index: 1, name: '小飞机起飞', emoji: '✈️', bpm: 80,
    steps: [a('airplane', 2), a('bothHandsUp', 1)] },
  { id: '1-3', chapter: 0, index: 2, name: '比个心', emoji: '💖', bpm: 80,
    steps: [a('heart', 2), a('bothHandsUp', 1), a('stand', 1)] },

  // 第二章：大运动（开始加入节拍动作）
  { id: '2-1', chapter: 1, index: 0, name: '小象下蹲', emoji: '🐘', bpm: 90,
    steps: [a('crouch', 2), a('jump', 3)] },
  { id: '2-2', chapter: 1, index: 1, name: '青蛙跳', emoji: '🐸', bpm: 100,
    steps: [a('jump', 4), a('crouch', 1)] },
  { id: '2-3', chapter: 1, index: 2, name: '左右开弓', emoji: '🏹', bpm: 100,
    steps: [a('stepLeft', 3), a('stepRight', 3), a('jump', 2)] },

  // 第三章：协调挑战（节奏混合）
  { id: '3-1', chapter: 2, index: 0, name: '节奏小跳', emoji: '🎵', bpm: 110,
    steps: [a('jump', 4), a('bothHandsUp', 1), a('jump', 4)] },
  { id: '3-2', chapter: 2, index: 1, name: '弯腰舞', emoji: '💃', bpm: 110,
    steps: [a('leanLeft', 3), a('leanRight', 3), a('airplane', 1)] },
  { id: '3-3', chapter: 2, index: 2, name: '终极挑战', emoji: '🏆', bpm: 120,
    steps: [a('jump', 4), a('stepLeft', 2), a('stepRight', 2), a('heart', 1)] },
]

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function levelPosition(id: string): { chapter: number; indexInChapter: number } | null {
  const l = LEVELS.find((x) => x.id === id)
  return l ? { chapter: l.chapter, indexInChapter: l.index } : null
}

// ---------------------------------------------------------------------------
// 进度（localStorage）
// ---------------------------------------------------------------------------

export interface Progress {
  /** levelId → 最佳星级 */
  stars: Record<string, number>
  /** 已解锁 levelId 集合（第一关默认解锁） */
  unlocked: string[]
}

const KEY = 'kidz-move-progress-v1'

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw) as Progress
      if (p && typeof p === 'object' && p.stars && Array.isArray(p.unlocked)) return p
    }
  } catch { /* ignore */ }
  return { stars: {}, unlocked: [LEVELS[0].id] }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch { /* ignore */ }
}

export function completeLevel(p: Progress, level: Level, earnedStars: number): Progress {
  const prev = p.stars[level.id] ?? 0
  const stars = { ...p.stars, [level.id]: Math.max(prev, earnedStars) }
  const unlocked = new Set(p.unlocked)
  if (earnedStars >= 1) {
    // 解锁同章下一关 / 下一章第一关
    if (level.index < 2) {
      unlocked.add(LEVELS.find((l) => l.chapter === level.chapter && l.index === level.index + 1)!.id)
    } else {
      const nextCh = LEVELS.find((l) => l.chapter === level.chapter + 1 && l.index === 0)
      if (nextCh) unlocked.add(nextCh.id)
    }
  }
  const next = { stars, unlocked: [...unlocked] }
  saveProgress(next)
  return next
}

/** 平均星级 → 1..3 */
export function starsFromScore(avg: number): number {
  if (avg >= 80) return 3
  if (avg >= 60) return 2
  if (avg >= 40) return 1
  return 0
}
