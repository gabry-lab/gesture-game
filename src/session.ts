/**
 * 游戏会话状态机：驱动 模仿(hold) / 节奏(beat) / 关卡 三种玩法。
 *
 * 由外部（游戏画面）每帧调用：
 *   session.setScore(liveScore)   // 当前动作的实时匹配分 0..100
 *   session.update()              // 推进状态机（内部用注入的时钟）
 *
 * 依赖全部注入，便于无头单元测试：
 *   now()  时钟（ms）
 *   tick() 节拍器发声（strong=强拍）
 *
 * 状态流（每个 step）：
 *   hold 动作:  demo(教练示范) → hold(保持条填满) → 完成
 *   beat 动作:  countin(3 拍预备) → beat(repeats 拍逐拍评分) → 完成
 * 最后一步完成 → done，产出 SessionResult。
 */
import type { ActionTemplate } from './pose/actions'
import type { LevelStep } from './levels'

export type SessionPhase = 'demo' | 'countin' | 'hold' | 'beat' | 'done'
export type Grade = 'PERFECT' | 'GOOD' | 'MISS'

export interface SessionUI {
  phase: SessionPhase
  currentStepIndex: number
  totalSteps: number
  action: ActionTemplate
  /** 实时匹配分 0..100 */
  score: number
  /** 保持条 0..100（hold 阶段） */
  holdFill: number
  /** 节拍进度 */
  beatDone: number
  beatTotal: number
  countinLeft: number
  lastGrade: Grade | null
  combo: number
  maxCombo: number
  points: number
  /** 累计评分 */
  perfect: number
  good: number
  miss: number
  done: boolean
}

export interface SessionResult {
  levelScore: number // 0..100
  perfect: number
  good: number
  miss: number
  maxCombo: number
  points: number
  completedSteps: number
  totalSteps: number
}

export interface SessionDeps {
  steps: LevelStep[]
  bpm: number
  now: () => number
  tick: (strong: boolean) => void
  /** 单步示范时长（ms） */
  demoMs?: number
  /** 预备拍数量 */
  countInBeats?: number
  /** PERFECT 阈值（≥ passScore+ 该值） */
  perfectMargin?: number
}

const DEMO_MS = 1900
const COUNT_IN_BEATS = 3
const PERFECT_MARGIN = 20

export class SessionManager {
  private deps: SessionDeps
  private phase: SessionPhase = 'demo'
  private stepIndex = 0
  private phaseStart = 0
  private nextBeatTime = 0
  private countinLeft = 0
  private beatLeft = 0
  private holdFill = 0
  private liveScore = 0
  private windowMax = 0
  private lastGrade: Grade | null = null
  private combo = 0
  private maxCombo = 0
  private points = 0
  private perfect = 0
  private good = 0
  private miss = 0
  private completedSteps = 0
  private result: SessionResult | null = null
  private emittedDone = false

  onUI?: (ui: SessionUI) => void
  onDone?: (result: SessionResult) => void
  /** 教练示范/停止示范回调（demo/countin 阶段示范，hold/beat 阶段停止） */
  onDemoChange?: (demoing: boolean) => void

  constructor(deps: SessionDeps) {
    this.deps = deps
  }

  get currentAction(): ActionTemplate {
    return this.deps.steps[this.stepIndex].action
  }

  private get beatInterval(): number {
    return 60000 / this.deps.bpm
  }

  private get demoMs(): number {
    return this.deps.demoMs ?? DEMO_MS
  }

  start(): void {
    const t = this.deps.now()
    this.phaseStart = t
    this.enterStep(t)
  }

  setScore(score: number): void {
    this.liveScore = Math.max(0, Math.min(100, score))
  }

  stop(): void {
    this.phase = 'done'
  }

  private enterStep(t: number): void {
    const step = this.deps.steps[this.stepIndex]
    this.holdFill = 0
    this.lastGrade = null
    this.windowMax = 0
    this.phaseStart = t
    if (step.action.kind === 'hold') {
      this.phase = 'demo'
      this.onDemoChange?.(true)
    } else {
      this.phase = 'countin'
      this.countinLeft = COUNT_IN_BEATS
      this.nextBeatTime = t + this.beatInterval
      this.onDemoChange?.(true)
    }
  }

  update(): void {
    const t = this.deps.now()
    const step = this.deps.steps[this.stepIndex]
    if (!step) return
    // 节拍前窗口最高分（hold/beat 均适用，容忍抖动）
    this.windowMax = Math.max(this.windowMax, this.liveScore)

    switch (this.phase) {
      case 'demo': {
        if (t - this.phaseStart >= this.demoMs) {
          this.phase = 'hold'
          this.phaseStart = t
          this.onDemoChange?.(false)
        }
        break
      }
      case 'hold': {
        // 填满保持条：active 时充能，否则慢速流失
        const holdMs = step.action.holdMs
        if (this.liveScore >= step.action.passScore) {
          this.holdFill += (100 / holdMs) * (this.beatInterval === 0 ? 16 : this.frameDt(t))
        } else {
          this.holdFill -= (60 / holdMs) * this.frameDt(t)
        }
        this.holdFill = Math.max(0, Math.min(100, this.holdFill))
        if (this.holdFill >= 100) this.completeStep()
        break
      }
      case 'countin': {
        while (t >= this.nextBeatTime && this.countinLeft > 0) {
          this.deps.tick(this.countinLeft === COUNT_IN_BEATS)
          this.countinLeft--
          this.windowMax = 0
          this.nextBeatTime += this.beatInterval
        }
        if (this.countinLeft <= 0) {
          this.phase = 'beat'
          this.beatLeft = step.repeats
          this.nextBeatTime = t + this.beatInterval
        }
        break
      }
      case 'beat': {
        while (t >= this.nextBeatTime && this.beatLeft > 0) {
          const strong = this.beatLeft === step.repeats
          this.deps.tick(strong)
          this.gradeBeat(this.windowMax, step)
          this.beatLeft--
          this.windowMax = 0
          this.nextBeatTime += this.beatInterval
        }
        if (this.beatLeft <= 0) this.completeStep()
        break
      }
      case 'done':
        break
    }
    this.emitUI()
  }

  /** 上一帧到本帧的间隔（ms），钳制到合理范围 */
  private lastT = 0
  private frameDt(t: number): number {
    const dt = t - this.lastT
    this.lastT = t
    return Math.max(1, Math.min(50, dt))
  }

  private gradeBeat(bestScore: number, step: LevelStep): void {
    const pass = step.action.passScore
    const perfect = pass + (this.deps.perfectMargin ?? PERFECT_MARGIN)
    // 只在该窗口内有足够时间时评分，否则视为没跟上
    if (bestScore >= perfect) {
      this.lastGrade = 'PERFECT'
      this.perfect++
      this.combo++
      this.points += 100 + Math.min(this.combo, 10) * 10
    } else if (bestScore >= pass) {
      this.lastGrade = 'GOOD'
      this.good++
      this.combo++
      this.points += 60 + Math.min(this.combo, 10) * 5
    } else {
      this.lastGrade = 'MISS'
      this.miss++
      this.combo = 0
    }
    this.maxCombo = Math.max(this.maxCombo, this.combo)
  }

  private completeStep(): void {
    this.completedSteps++
    this.stepIndex++
    if (this.stepIndex >= this.deps.steps.length) {
      this.phase = 'done'
      this.onDemoChange?.(false)
      this.finish()
    } else {
      this.enterStep(this.deps.now())
    }
  }

  private finish(): void {
    const totalBeats = this.perfect + this.good + this.miss
    const holdSteps = this.deps.steps.filter((s) => s.action.kind === 'hold').length
    const beatStepsTotal = this.deps.steps.filter((s) => s.action.kind === 'beat').reduce((n, s) => n + s.repeats, 0)
    const totalUnits = holdSteps + beatStepsTotal
    let levelScore: number
    if (totalUnits === 0) levelScore = 100
    else {
      // 每个 hold 步贡献 1 单位（完成即满），节拍单位按命中率加权
      const beatHit = totalBeats === 0 ? 1 : (this.perfect * 1 + this.good * 0.6) / totalBeats
      const gained = holdSteps + beatStepsTotal * beatHit
      levelScore = Math.round((gained / totalUnits) * 100)

    }
    this.result = {
      levelScore,
      perfect: this.perfect,
      good: this.good,
      miss: this.miss,
      maxCombo: this.maxCombo,
      points: this.points,
      completedSteps: this.completedSteps,
      totalSteps: this.deps.steps.length,
    }
    if (!this.emittedDone) {
      this.emittedDone = true
      this.onDone?.(this.result)
    }
  }

  getResult(): SessionResult | null {
    return this.result
  }

  private emitUI(): void {
    const step = this.deps.steps[Math.min(this.stepIndex, this.deps.steps.length - 1)]
    if (!step) return
    const ui: SessionUI = {
      phase: this.phase,
      currentStepIndex: this.stepIndex,
      totalSteps: this.deps.steps.length,
      action: step.action,
      score: this.liveScore,
      holdFill: this.holdFill,
      beatDone: step.repeats - this.beatLeft,
      beatTotal: step.repeats,
      countinLeft: this.countinLeft,
      lastGrade: this.lastGrade,
      combo: this.combo,
      maxCombo: this.maxCombo,
      points: this.points,
      perfect: this.perfect,
      good: this.good,
      miss: this.miss,
      done: this.phase === 'done',
    }
    this.onUI?.(ui)
  }
}
