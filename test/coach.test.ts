import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Coach } from '../src/coach/coach'
import { ACTIONS } from '../src/pose'

// ---- 环境桩：canvas / ctx / rAF ----
let now = 0
let rafSeq = 0
const pending = new Map<number, FrameRequestCallback>()

function makeCtx(): CanvasRenderingContext2D {
  const handler: ProxyHandler<object> = {
    get: (_t, prop) => {
      if (prop === 'measureText') return () => ({ width: 10 })
      return () => {}
    },
    set: () => true,
    apply: () => {},
  }
  return new Proxy({}, handler) as unknown as CanvasRenderingContext2D
}

function makeCanvas(): HTMLCanvasElement {
  return {
    width: 400,
    height: 400,
    getContext: () => makeCtx(),
  } as unknown as HTMLCanvasElement
}

beforeEach(() => {
  now = 0
  rafSeq = 0
  pending.clear()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = ++rafSeq
    pending.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function pump(ms: number, step = 16): void {
  let t = 0
  while (t < ms) {
    const dt = Math.min(step, ms - t)
    now += dt
    t += dt
    for (const [id, cb] of [...pending]) {
      pending.delete(id)
      cb(now)
    }
  }
}

describe('Coach 示范状态机', () => {
  it('go → hold → back → go 循环（举双手）', () => {
    const coach = new Coach(makeCanvas())
    coach.mount()
    coach.startDemo(ACTIONS.bothHandsUp)
    pump(400)
    expect(coach.isDemoActive).toBe(true) // 已 hold
    pump(2500)
    expect(coach.isDemoActive).toBe(false) // hold 结束回站姿
    pump(1200)
    expect(coach.isDemoActive).toBe(true) // 再次示范
    coach.unmount()
    pump(200)
    expect(pending.size).toBe(0) // 停止调度
  })

  it('跳跃示范：进入 hold（onDemoActive 触发）', () => {
    const coach = new Coach(makeCanvas())
    coach.mount()
    let active = false
    coach.onDemoActive = (a) => { active = a }
    coach.startDemo(ACTIONS.jump)
    pump(500)
    expect(active).toBe(true)
    coach.unmount()
  })

  it('stopDemo 回到站姿', () => {
    const coach = new Coach(makeCanvas())
    coach.mount()
    coach.startDemo(ACTIONS.airplane)
    pump(600)
    coach.stopDemo()
    pump(1500)
    expect(coach.isDemoActive).toBe(false)
    coach.unmount()
  })

  it('5 个不同动作都能完成示范循环', () => {
    for (const id of ['bothHandsUp', 'airplane', 'heart', 'crouch', 'leanLeft']) {
      const coach = new Coach(makeCanvas())
      coach.mount()
      coach.startDemo(ACTIONS[id])
      pump(1500)
      expect(coach.isDemoActive, `${id} 应进入 hold`).toBe(true)
      coach.unmount()
    }
  })

  it('表情切换不报错（happy/encourage/idle）', () => {
    const coach = new Coach(makeCanvas())
    coach.mount()
    coach.setExpression('happy')
    pump(200)
    coach.setExpression('encourage')
    pump(200)
    coach.setExpression('idle')
    pump(200)
    coach.unmount()
  })
})
