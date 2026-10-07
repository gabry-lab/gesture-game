import { describe, it, expect } from 'vitest'
import { SessionManager } from '../src/session'
import { ACTIONS } from '../src/pose'

function makeSession(steps: import('../src/levels').LevelStep[], opts: { bpm?: number } = {}) {
  let t = 0
  const ticks: boolean[] = []
  const sm = new SessionManager({
    steps,
    bpm: opts.bpm ?? 120,
    now: () => t,
    tick: (s) => ticks.push(s),
  })
  const uiLog: import('../src/session').SessionUI[] = []
  sm.onUI = (ui) => uiLog.push(ui)
  return {
    sm,
    ticks,
    uiLog,
    /** 推进虚拟时钟并驱动状态机 */
    step: (ms: number, dt = 16) => {
      let rem = ms
      while (rem > 0) {
        const d = Math.min(dt, rem)
        t += d
        rem -= d
        sm.update()
      }
    },
  }
}

const holdStep = (actionId: string, repeats = 1): import('../src/levels').LevelStep =>
  ({ action: ACTIONS[actionId], repeats })
const beatStep = (actionId: string, repeats = 1): import('../src/levels').LevelStep =>
  ({ action: ACTIONS[actionId], repeats })

describe('SessionManager — hold（模仿动作）', () => {
  it('demo → hold → done，分数足够时完成', () => {
    const { sm, step } = makeSession([holdStep('bothHandsUp')])
    let done: import('../src/session').SessionResult | null = null
    sm.onDone = (r) => { done = r }
    const demoChanges: boolean[] = []
    sm.onDemoChange = (d) => demoChanges.push(d)

    sm.start()
    step(1900) // 刚好过 demo 阶段（demoMs=1900）
    sm.setScore(90)
    step(2200, 16) // 充满 holdMs=2000（留余量）
    expect(done).not.toBeNull()
    expect(done!.completedSteps).toBe(1)
    expect(done!.totalSteps).toBe(1)
    expect(demoChanges[0]).toBe(true) // 开始示范
    expect(demoChanges[demoChanges.length - 1]).toBe(false) // 停止示范
  })

  it('分数不足时保持条不前进，不会完成', () => {
    const { sm, step } = makeSession([holdStep('bothHandsUp')])
    let done: import('../src/session').SessionResult | null = null
    sm.onDone = (r) => { done = r }
    sm.start()
    step(2500) // 过 demo
    sm.setScore(10) // 远低于 passScore
    step(6000) // 远超 holdMs
    expect(done).toBeNull()
  })

  it('低分会流失已充的保持条', () => {
    const { sm, step } = makeSession([holdStep('bothHandsUp')])
    sm.start()
    step(1900)
    sm.setScore(90)
    step(1000)
    const mid = sm.getResult()
    sm.setScore(5)
    step(1000)
    expect(mid).toBeNull() // 未完成
  })
})

describe('SessionManager — beat（节奏运动）', () => {
  it('countin 3 拍后逐拍评分，PERFECT 计分', () => {
    const { sm, step, ticks } = makeSession([beatStep('jump', 3)], { bpm: 120 })
    let done: import('../src/session').SessionResult | null = null
    sm.onDone = (r) => { done = r }
    sm.start()
    const bi = 60000 / 120 // 500ms
    step(bi * 3) // countin 3 拍
    expect(ticks.length).toBe(3)
    expect(ticks[0]).toBe(true) // 第一拍强
    sm.setScore(95)
    step(bi) // 第 1 拍
    sm.setScore(95)
    step(bi) // 第 2 拍
    sm.setScore(95)
    step(bi * 2) // 第 3 拍 + 余量
    expect(done).not.toBeNull()
    expect(done!.perfect).toBe(3)
    expect(done!.miss).toBe(0)
    expect(done!.maxCombo).toBe(3)
    expect(done!.points).toBeGreaterThan(0)
    expect(ticks.length).toBe(6) // 3 countin + 3 beat
  })

  it('分数不足拍 → MISS，combo 归零', () => {
    const { sm, step } = makeSession([beatStep('jump', 2)], { bpm: 120 })
    let done: import('../src/session').SessionResult | null = null
    sm.onDone = (r) => { done = r }
    sm.start()
    const bi = 500
    step(bi * 3)
    sm.setScore(95)
    step(bi) // PERFECT
    sm.setScore(5)
    step(bi * 2) // MISS
    expect(done).not.toBeNull()
    expect(done!.perfect).toBe(1)
    expect(done!.miss).toBe(1)
    expect(done!.maxCombo).toBe(1)
  })

  it('GOOD 介于两者之间', () => {
    const { sm, step } = makeSession([beatStep('jump', 1)], { bpm: 120 })
    let done: import('../src/session').SessionResult | null = null
    sm.onDone = (r) => { done = r }
    sm.start()
    step(1500) // countin
    sm.setScore(60) // passScore=55，< 55+20
    step(600)
    expect(done).not.toBeNull()
    expect(done!.good).toBe(1)
  })

  it('节拍分窗口内取最高（抖动容忍）', () => {
    const { sm, step } = makeSession([beatStep('jump', 1)], { bpm: 120 })
    let done: import('../src/session').SessionResult | null = null
    sm.onDone = (r) => { done = r }
    sm.start()
    step(1500)
    sm.setScore(95) // 窗口内先高分
    step(300)
    sm.setScore(20) // 拍前瞬间掉分，不影响
    step(300) // 拍点到来
    expect(done).not.toBeNull()
    expect(done!.perfect).toBe(1)
  })
})

describe('SessionManager — 混合关卡结算', () => {
  it('hold + beat 混合：levelScore 综合计算', () => {
    const { sm, step } = makeSession(
      [holdStep('bothHandsUp'), beatStep('jump', 2)],
      { bpm: 120 },
    )
    let done: import('../src/session').SessionResult | null = null
    sm.onDone = (r) => { done = r }
    sm.start()
    // hold 步
    step(2000)
    sm.setScore(95)
    step(2100)
    // beat 步 countin
    step(1500)
    sm.setScore(95)
    step(500)
    sm.setScore(95)
    step(600)
    expect(done).not.toBeNull()
    expect(done!.completedSteps).toBe(2)
    expect(done!.levelScore).toBe(100)
  })
})

describe('starsFromScore', () => {
  it('星级阈值', async () => {
    const { starsFromScore } = await import('../src/levels')
    expect(starsFromScore(90)).toBe(3)
    expect(starsFromScore(70)).toBe(2)
    expect(starsFromScore(50)).toBe(1)
    expect(starsFromScore(30)).toBe(0)
    expect(starsFromScore(100)).toBe(3)
    expect(starsFromScore(40)).toBe(1)
  })
})

describe('进度系统', () => {
  it('localStorage 不可用时（Node 测试环境）不抛错', async () => {
    const { loadProgress, saveProgress, completeLevel, LEVELS } = await import('../src/levels')
    const p = loadProgress()
    expect(p.unlocked.length).toBeGreaterThanOrEqual(1)
    const next = completeLevel(p, LEVELS[0], 2)
    expect(next.stars['1-1']).toBe(2)
    expect(next.unlocked).toContain('1-2')
    saveProgress(next) // 无 localStorage 时静默
  })
})
