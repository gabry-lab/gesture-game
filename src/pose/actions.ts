import type { Point, PoseFrame, Part, StandingReference } from './types'
import { angleDeg, elevationDeg, isOk, len, sub, torsoLength, midShoulder, midHip, midAnkle } from './geometry'

/**
 * 单项检查：对一帧姿态计算“达成度” hit ∈ [0,1]
 * 全部检查加权平均 → 动作得分 0..100
 */
export type Check =
  | { kind: 'angle'; a: Part; b: Part; c: Part; target: number; tol: number; w: number }
  | { kind: 'elev'; a: Part; b: Part; target: number; tol: number; w: number }
  | { kind: 'dist'; a: Part; b: Part; maxT: number; w: number }
  /** 垂直抬升（脚离地），相对校准的站立姿态；minT..fullT 单位为躯干倍数 */
  | { kind: 'lift'; minT: number; fullT: number; w: number }
  /** 髋部横向位移（侧步），side: -1=屏幕左, 1=屏幕右 */
  | { kind: 'lateral'; side: 1 | -1; minT: number; fullT: number; w: number }
  /** 肩部相对髋部的横向倾斜（弯腰/侧倾） */
  | { kind: 'lean'; side: 1 | -1; minT: number; fullT: number; w: number }
  /** 身体整体下沉（下蹲等），肩中点低于校准值 */
  | { kind: 'drop'; minT: number; fullT: number; w: number }
  /** 髋-踝距离压缩（正面视角的下蹲信号） */
  | { kind: 'hipLow'; startR: number; fullR: number; w: number }
  /** 躯干竖直度（hip→shoulder 仰角≈0） */
  | { kind: 'upright'; target: number; tol: number; w: number }

export interface ActionTemplate {
  id: string
  /** 中文名（UI 显示） */
  name: string
  emoji: string
  /** hold=保持型（模仿动作）；beat=节拍型（节奏运动） */
  kind: 'hold' | 'beat'
  /** hold 型需要保持的毫秒数 */
  holdMs: number
  /** 得分 ≥ 该值视为“做对了” */
  passScore: number
  checks: Check[]
  /** 给孩子的提示语 */
  hint: string
}

export interface EvalResult {
  /** 0..100 */
  score: number
  /** score ≥ passScore */
  active: boolean
  /** 关键点足够多、结果可信 */
  usable: boolean
  /** 本动作依赖校准（位移类），当前无校准 */
  needsRef: boolean
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function point(frame: PoseFrame, part: Part, threshold: number): Point | null {
  const p = frame[part]
  return p && p.score >= threshold ? p : null
}

function checkHit(c: Check, frame: PoseFrame, ref: StandingReference | null, T: number, thr: number): { hit: number; needsRef: boolean; invalid: boolean } {
  switch (c.kind) {
    case 'angle': {
      const p1 = point(frame, c.a, thr); const p2 = point(frame, c.b, thr); const p3 = point(frame, c.c, thr)
      if (!p1 || !p2 || !p3) return { hit: 0, needsRef: false, invalid: true }
      const dev = Math.abs(angleDeg(p1, p2, p3) - c.target)
      return { hit: clamp01(1 - dev / c.tol), needsRef: false, invalid: false }
    }
    case 'elev': {
      const p1 = point(frame, c.a, thr); const p2 = point(frame, c.b, thr)
      if (!p1 || !p2) return { hit: 0, needsRef: false, invalid: true }
      const dev = Math.abs(elevationDeg(p1, p2) - c.target)
      return { hit: clamp01(1 - dev / c.tol), needsRef: false, invalid: false }
    }
    case 'dist': {
      const p1 = point(frame, c.a, thr); const p2 = point(frame, c.b, thr)
      if (!p1 || !p2 || T <= 0) return { hit: 0, needsRef: false, invalid: true }
      const d = len(sub(p1, p2)) / T
      const hit = d <= c.maxT ? 1 : clamp01(1 - (d - c.maxT) / 0.3)
      return { hit, needsRef: false, invalid: false }
    }
    case 'lift': {
      if (!ref) return { hit: 0, needsRef: true, invalid: false }
      const mh = midHip(frame); const ma = midAnkle(frame)
      if (!mh || !ma) return { hit: 0, needsRef: true, invalid: true }
      const cur = ref.ankleY - ma.y // 正值 = 抬得比站立高
      const min = c.minT * ref.torso, full = c.fullT * ref.torso
      if (cur < min) return { hit: 0, needsRef: false, invalid: false }
      const hit = full > min ? clamp01((cur - min) / (full - min)) : 1
      return { hit, needsRef: false, invalid: false }
    }
    case 'lateral': {
      if (!ref) return { hit: 0, needsRef: true, invalid: false }
      const mh = midHip(frame)
      if (!mh) return { hit: 0, needsRef: true, invalid: true }
      const cur = (mh.x - ref.midHipX) * c.side // 正值 = 朝目标方向
      const min = c.minT * ref.torso, full = c.fullT * ref.torso
      if (cur < min) return { hit: 0, needsRef: false, invalid: false }
      const hit = full > min ? clamp01((cur - min) / (full - min)) : 1
      return { hit, needsRef: false, invalid: false }
    }
    case 'lean': {
      const ms = midShoulder(frame); const mh = midHip(frame)
      if (!ms || !mh || T <= 0) return { hit: 0, needsRef: false, invalid: true }
      const cur = ((ms.x - mh.x) * c.side) / T
      const min = c.minT, full = c.fullT
      if (cur < min) return { hit: 0, needsRef: false, invalid: false }
      const hit = full > min ? clamp01((cur - min) / (full - min)) : 1
      return { hit, needsRef: false, invalid: false }
    }
    case 'drop': {
      if (!ref) return { hit: 0, needsRef: true, invalid: false }
      const ms = midShoulder(frame)
      if (!ms) return { hit: 0, needsRef: true, invalid: true }
      const cur = ms.y - ref.shoulderY // 正值 = 比站立低
      const min = c.minT * ref.torso, full = c.fullT * ref.torso
      if (cur < min) return { hit: 0, needsRef: false, invalid: false }
      const hit = full > min ? clamp01((cur - min) / (full - min)) : 1
      return { hit, needsRef: false, invalid: false }
    }
    case 'hipLow': {
      if (!ref || ref.hipAnkle <= 0) return { hit: 0, needsRef: true, invalid: false }
      const mh = midHip(frame); const ma = midAnkle(frame)
      if (!mh || !ma) return { hit: 0, needsRef: true, invalid: true }
      const r = (ref.ankleY - mh.y) / ref.hipAnkle // 站立≈1，下蹲≈0.5
      if (r >= c.startR) return { hit: 0, needsRef: false, invalid: false }
      const hit = c.startR > c.fullR ? clamp01((c.startR - r) / (c.startR - c.fullR)) : 1
      return { hit, needsRef: false, invalid: false }
    }
    case 'upright': {
      const ms = midShoulder(frame); const mh = midHip(frame)
      if (!ms || !mh) return { hit: 0, needsRef: false, invalid: true }
      const dev = Math.abs(elevationDeg(mh, ms) - c.target)
      return { hit: clamp01(1 - dev / c.tol), needsRef: false, invalid: false }
    }
  }
}

/** 身体骨架关键点是否足够可信（≥7/10） */
export function isUsable(frame: PoseFrame, thr: number): boolean {
  const parts: Part[] = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'leftHip', 'rightHip', 'leftKnee', 'rightKnee']
  let n = 0
  for (const p of parts) if (isOk(frame, p, thr)) n++
  return n >= 7
}

/** 评估一帧姿态与动作模板的匹配度（纯函数，无副作用） */
export function evaluateAction(frame: PoseFrame, ref: StandingReference | null, action: ActionTemplate, thr: number): EvalResult {
  const T = torsoLength(frame, thr) ?? 0
  const usable = isUsable(frame, thr)
  let sumW = 0
  let sumHit = 0
  let needsRef = false
  let invalidAny = false
  for (const c of action.checks) {
    const r = checkHit(c, frame, ref, T, thr)
    if (r.needsRef) needsRef = true
    if (r.invalid) invalidAny = true
    sumW += c.w
    sumHit += c.w * r.hit
  }
  // 无校准时位移类动作无法评分（参考相关检查全部失效）→ 0 分
  const score = usable && sumW > 0 && !invalidAny && !needsRef ? Math.round((sumHit / sumW) * 100) : 0
  return { score, active: score >= action.passScore, usable, needsRef }
}

// ---------------------------------------------------------------------------
// 动作库
// ---------------------------------------------------------------------------

const armUp = (side: 'left' | 'right') =>
  [
    { kind: 'elev' as const, a: `${side}Shoulder` as Part, b: `${side}Wrist` as Part, target: 0, tol: 55, w: 1 },
    { kind: 'angle' as const, a: `${side}Shoulder` as Part, b: `${side}Elbow` as Part, c: `${side}Wrist` as Part, target: 180, tol: 55, w: 0.4 },
  ]

const armDown = (side: 'left' | 'right') => [
  { kind: 'elev' as const, a: `${side}Shoulder` as Part, b: `${side}Wrist` as Part, target: 180, tol: 55, w: 1 },
]

export const ACTIONS: Record<string, ActionTemplate> = {
  stand: {
    id: 'stand', name: '站直', emoji: '🧍', kind: 'hold', holdMs: 1500, passScore: 60,
    hint: '身体站直，小手自然放下',
    checks: [
      { kind: 'upright', target: 0, tol: 35, w: 1 },
      ...armDown('left'), ...armDown('right'),
    ],
  },
  bothHandsUp: {
    id: 'bothHandsUp', name: '举双手', emoji: '🙌', kind: 'hold', holdMs: 2000, passScore: 62,
    hint: '双手高高举起，像小火箭发射！',
    checks: [...armUp('left'), ...armUp('right')],
  },
  leftUp: {
    id: 'leftUp', name: '举左手', emoji: '✋', kind: 'hold', holdMs: 2000, passScore: 62,
    hint: '把左手高高举起',
    checks: [...armUp('left'), ...armDown('right')],
  },
  rightUp: {
    id: 'rightUp', name: '举右手', emoji: '✋', kind: 'hold', holdMs: 2000, passScore: 62,
    hint: '把右手高高举起',
    checks: [...armUp('right'), ...armDown('left')],
  },
  airplane: {
    id: 'airplane', name: '小飞机', emoji: '✈️', kind: 'hold', holdMs: 2000, passScore: 62,
    hint: '双臂平展，像飞机一样飞！',
    checks: [
      { kind: 'elev', a: 'leftShoulder', b: 'leftWrist', target: 90, tol: 40, w: 1 },
      { kind: 'elev', a: 'rightShoulder', b: 'rightWrist', target: 90, tol: 40, w: 1 },
      { kind: 'angle', a: 'leftShoulder', b: 'leftElbow', c: 'leftWrist', target: 180, tol: 55, w: 0.4 },
      { kind: 'angle', a: 'rightShoulder', b: 'rightElbow', c: 'rightWrist', target: 180, tol: 55, w: 0.4 },
      { kind: 'upright', target: 0, tol: 45, w: 0.6 },
    ],
  },
  crouch: {
    id: 'crouch', name: '深蹲', emoji: '🐘', kind: 'hold', holdMs: 1800, passScore: 60,
    hint: '像小象一样慢慢蹲下去',
    checks: [
      { kind: 'drop', minT: 0.25, fullT: 0.55, w: 1 },
      { kind: 'hipLow', startR: 0.8, fullR: 0.5, w: 1 },
      { kind: 'upright', target: 0, tol: 45, w: 0.5 },
    ],
  },
  heart: {
    id: 'heart', name: '比心', emoji: '💖', kind: 'hold', holdMs: 2000, passScore: 65,
    hint: '双手在胸前合起来比个心',
    checks: [
      { kind: 'dist', a: 'leftWrist', b: 'rightWrist', maxT: 0.12, w: 1 },
      { kind: 'elev', a: 'leftShoulder', b: 'leftWrist', target: 135, tol: 50, w: 0.8 },
      { kind: 'elev', a: 'rightShoulder', b: 'rightWrist', target: 135, tol: 50, w: 0.8 },
    ],
  },
  // ---- 节拍类 ----
  jump: {
    id: 'jump', name: '原地跳', emoji: '🦘', kind: 'beat', holdMs: 1000, passScore: 55,
    hint: '跟着节奏跳起来！',
    checks: [{ kind: 'lift', minT: 0.12, fullT: 0.4, w: 2 }],
  },
  stepLeft: {
    id: 'stepLeft', name: '左脚开', emoji: '👣', kind: 'beat', holdMs: 1000, passScore: 55,
    hint: '向左边跨一步',
    checks: [{ kind: 'lateral', side: -1, minT: 0.3, fullT: 0.6, w: 2 }],
  },
  stepRight: {
    id: 'stepRight', name: '右脚开', emoji: '👣', kind: 'beat', holdMs: 1000, passScore: 55,
    hint: '向右边跨一步',
    checks: [{ kind: 'lateral', side: 1, minT: 0.3, fullT: 0.6, w: 2 }],
  },
  leanLeft: {
    id: 'leanLeft', name: '左弯腰', emoji: '🤸', kind: 'beat', holdMs: 1200, passScore: 55,
    hint: '身体向左边弯一弯',
    checks: [
      { kind: 'lean', side: -1, minT: 0.2, fullT: 0.5, w: 1.5 },
      { kind: 'upright', target: 0, tol: 90, w: 0.3 },
    ],
  },
  leanRight: {
    id: 'leanRight', name: '右弯腰', emoji: '🤸', kind: 'beat', holdMs: 1200, passScore: 55,
    hint: '身体向右边弯一弯',
    checks: [
      { kind: 'lean', side: 1, minT: 0.2, fullT: 0.5, w: 1.5 },
      { kind: 'upright', target: 0, tol: 90, w: 0.3 },
    ],
  },
}

export const ACTION_LIST: ActionTemplate[] = Object.values(ACTIONS)
