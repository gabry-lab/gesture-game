import { describe, it, expect } from 'vitest'
import { evaluateAction, ACTIONS, isUsable } from '../src/pose'
import {
  standing, bothUp, airplane, heart, crouch, jump,
  stepRight, leanLeft, lowConfidence, transform, STANDING_REF,
} from './helpers'
import type { StandingReference } from '../src/pose'

const REF = STANDING_REF

describe('isUsable', () => {
  it('完整站姿可用', () => {
    expect(isUsable(standing(), 0.4)).toBe(true)
  })
  it('全部低置信度不可用', () => {
    expect(isUsable(lowConfidence(standing(), 0.2), 0.4)).toBe(false)
  })
})

describe('角度类动作评估', () => {
  it('双手高举：得分高且 active', () => {
    const r = evaluateAction(bothUp(), REF, ACTIONS.bothHandsUp, 0.4)
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.active).toBe(true)
  })
  it('站立时做举双手：得分低且不 active', () => {
    const r = evaluateAction(standing(), REF, ACTIONS.bothHandsUp, 0.4)
    expect(r.score).toBeLessThan(40)
    expect(r.active).toBe(false)
  })
  it('小飞机：得分高', () => {
    const r = evaluateAction(airplane(), REF, ACTIONS.airplane, 0.4)
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.active).toBe(true)
  })
  it('比心：得分高', () => {
    const r = evaluateAction(heart(), REF, ACTIONS.heart, 0.4)
    expect(r.score).toBeGreaterThanOrEqual(75)
    expect(r.active).toBe(true)
  })
  it('比心 vs 站姿：低分', () => {
    const r = evaluateAction(standing(), REF, ACTIONS.heart, 0.4)
    expect(r.score).toBeLessThan(45)
  })
  it('角度类动作不依赖校准（ref=null 仍有分）', () => {
    const r = evaluateAction(bothUp(), null, ACTIONS.bothHandsUp, 0.4)
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.needsRef).toBe(false)
  })
})

describe('位移类动作评估', () => {
  it('下蹲：得分高', () => {
    const r = evaluateAction(crouch(), REF, ACTIONS.crouch, 0.4)
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.active).toBe(true)
  })
  it('站姿 vs 深蹲：低分', () => {
    const r = evaluateAction(standing(), REF, ACTIONS.crouch, 0.4)
    expect(r.score).toBeLessThan(35)
  })
  it('跳跃：双脚离地得分高', () => {
    const r = evaluateAction(jump(), REF, ACTIONS.jump, 0.4)
    expect(r.score).toBeGreaterThanOrEqual(80)
    expect(r.active).toBe(true)
  })
  it('站姿 vs 跳：0 分', () => {
    const r = evaluateAction(standing(), REF, ACTIONS.jump, 0.4)
    expect(r.score).toBe(0)
  })
  it('右跨步：得分高', () => {
    const r = evaluateAction(stepRight(standing(), 120), REF, ACTIONS.stepRight, 0.4)
    expect(r.score).toBeGreaterThanOrEqual(80)
  })
  it('左弯 vs 右弯腰：低分（方向错误）', () => {
    const r = evaluateAction(leanLeft(standing()), REF, ACTIONS.leanRight, 0.4)
    expect(r.score).toBeLessThan(30)
  })
  it('位移类动作无校准时 needsRef 且 0 分', () => {
    for (const id of ['jump', 'stepLeft', 'stepRight', 'crouch']) {
      const r = evaluateAction(standing(), null, ACTIONS[id], 0.4)
      expect(r.needsRef).toBe(true)
      expect(r.score).toBe(0)
    }
  })
  it('lean 动作相对躯干，不依赖校准', () => {
    const r = evaluateAction(leanLeft(standing()), null, ACTIONS.leanLeft, 0.4)
    expect(r.needsRef).toBe(false)
    expect(r.score).toBeGreaterThanOrEqual(60)
  })
})

describe('鲁棒性', () => {
  it('体型放大 1.8 倍 + 平移：角度动作得分不变', () => {
    const base = evaluateAction(bothUp(), REF, ACTIONS.bothHandsUp, 0.4)
    const moved = transform(bothUp(), 1.8, -150, 80)
    const ref2: StandingReference = {
      ...REF,
      midHipX: REF.midHipX * 1.8 - 150,
      midHipY: REF.midHipY * 1.8 + 80,
      torso: REF.torso * 1.8,
      shoulderY: REF.shoulderY * 1.8 + 80,
      ankleY: REF.ankleY * 1.8 + 80,
      hipAnkle: REF.hipAnkle * 1.8,
    }
    const r2 = evaluateAction(moved, ref2, ACTIONS.bothHandsUp, 0.4)
    expect(r2.score).toBeGreaterThanOrEqual(85)
    expect(Math.abs(r2.score - base.score)).toBeLessThanOrEqual(6)
  })
  it('关键点全部丢失 → usable=false, score=0', () => {
    const empty: Parameters<typeof evaluateAction>[0] = {}
    const r = evaluateAction(empty, REF, ACTIONS.bothHandsUp, 0.4)
    expect(r.usable).toBe(false)
    expect(r.score).toBe(0)
    expect(r.active).toBe(false)
  })
  it('部分关键点丢失（手腕低置信度）→ 该关节不参与', () => {
    const f = bothUp()
    f.leftWrist!.score = 0.1
    f.rightWrist!.score = 0.1
    const r = evaluateAction(f, REF, ACTIONS.bothHandsUp, 0.4)
    // 手腕不可信 → 动作结果不可用（invalid）
    expect(r.score).toBe(0)
  })
})

describe('动作库完整性', () => {
  it('至少 12 个动作', () => {
    expect(Object.keys(ACTIONS).length).toBeGreaterThanOrEqual(12)
  })
  it('每个动作都有中文提示与权重>0', () => {
    for (const a of Object.values(ACTIONS)) {
      expect(a.hint.length).toBeGreaterThan(0)
      expect(a.name.length).toBeGreaterThan(0)
      for (const c of a.checks) expect(c.w).toBeGreaterThan(0)
    }
  })
  it('beat 型动作数量足够，纯位移类依赖校准', () => {
    const beats = Object.values(ACTIONS).filter((a) => a.kind === 'beat')
    expect(beats.length).toBeGreaterThanOrEqual(5)
    for (const id of ['jump', 'stepLeft', 'stepRight']) {
      expect(evaluateAction(standing(), null, ACTIONS[id], 0.4).needsRef).toBe(true)
    }
  })
})
