/**
 * 卡通教练「动动」— Canvas 2D 小机器人
 *
 * 用“身体归一化空间”的位置关键帧驱动（单位 = 躯干长度，原点在髋中点，y 向上为负）。
 * 动作示范 = 在 POSES 之间平滑插值；表情 = idle/demo/happy/encourage。
 * 教练动画独立于儿童侧的关节角度评分（评分在 pose/ 引擎）。
 */
import type { ActionTemplate } from '../pose/actions'

export interface CoachPoints {
  headX: number; headY: number
  shL: [number, number]; shR: [number, number]
  elL: [number, number]; elR: [number, number]
  wrL: [number, number]; wrR: [number, number]
  kpL: [number, number]; kpR: [number, number]
  knL: [number, number]; knR: [number, number]
  anL: [number, number]; anR: [number, number]
  /** 身体整体垂直位移（跳跃等） */
  bounce: number
}

const TORSO = 1.0
const HEAD_R = 0.42

function base(bounce = 0): CoachPoints {
  return {
    headX: 0, headY: -TORSO - 0.52 + bounce,
    shL: [-0.30, -TORSO + bounce], shR: [0.30, -TORSO + bounce],
    elL: [-0.42, -0.55 + bounce], elR: [0.42, -0.55 + bounce],
    wrL: [-0.46, -0.15 + bounce], wrR: [0.46, -0.15 + bounce],
    kpL: [-0.16, 0 + bounce], kpR: [0.16, 0 + bounce],
    knL: [-0.17, 0.52 + bounce], knR: [0.17, 0.52 + bounce],
    anL: [-0.18, 1.0 + bounce], anR: [0.18, 1.0 + bounce],
    bounce,
  }
}

function override(b: CoachPoints, o: Partial<Record<keyof CoachPoints, number | [number, number]>>): CoachPoints {
  return { ...b, ...o } as CoachPoints
}

/** 每个动作的示范姿态（相对站姿的覆盖） */
const POSES: Record<string, Partial<Record<keyof CoachPoints, number | [number, number]>>> = {
  stand: {},
  bothHandsUp: {
    elL: [-0.52, -1.30], elR: [0.52, -1.30],
    wrL: [-0.62, -1.85], wrR: [0.62, -1.85],
    headY: -1.62,
  },
  leftUp: {
    elL: [-0.55, -1.35], wrL: [-0.68, -1.95],
    elR: [0.40, -0.50], wrR: [0.44, -0.10],
  },
  rightUp: {
    elR: [0.55, -1.35], wrR: [0.68, -1.95],
    elL: [-0.40, -0.50], wrL: [-0.44, -0.10],
  },
  airplane: {
    elL: [-0.85, -1.02], wrL: [-1.5, -1.05],
    elR: [0.85, -1.02], wrR: [1.5, -1.05],
  },
  crouch: {
    headY: -0.95,
    shL: [-0.30, -0.52], shR: [0.30, -0.52],
    elL: [-0.5, -0.42], elR: [0.5, -0.42],
    wrL: [-0.72, -0.7], wrR: [0.72, -0.7],
    kpL: [-0.16, 0], kpR: [0.16, 0],
    knL: [-0.62, 0.42], knR: [0.62, 0.42],
    anL: [-0.2, 0.92], anR: [0.2, 0.92],
  },
  heart: {
    elL: [-0.34, -0.62], elR: [0.34, -0.62],
    wrL: [-0.06, -0.92], wrR: [0.06, -0.92],
  },
  jump: {
    bounce: -0.42,
    elL: [-0.5, -1.3], elR: [0.5, -1.3],
    wrL: [-0.58, -1.7], wrR: [0.58, -1.7],
    knL: [-0.4, 0.5], knR: [0.4, 0.5],
    anL: [-0.34, 0.95], anR: [0.34, 0.95],
  },
  stepLeft: {
    anL: [-0.85, 1.02], anR: [0.1, 1.0],
    knL: [-0.62, 0.55],
    elL: [-0.55, -0.7], elR: [0.55, -0.7],
  },
  stepRight: {
    anR: [0.85, 1.02], anL: [-0.1, 1.0],
    knR: [0.62, 0.55],
    elL: [-0.55, -0.7], elR: [0.55, -0.7],
  },
  leanLeft: {
    headX: -0.5, headY: -1.5,
    shL: [-0.52, -0.95], shR: [-0.12, -0.92],
    elL: [-0.62, -0.5], elR: [0.12, -0.5],
    wrL: [-0.7, -0.12], wrR: [0.16, -0.12],
  },
  leanRight: {
    headX: 0.5, headY: -1.5,
    shL: [0.12, -0.92], shR: [0.52, -0.95],
    elL: [-0.12, -0.5], elR: [0.62, -0.5],
    wrL: [-0.16, -0.12], wrR: [0.7, -0.12],
  },
}

export type CoachExpression = 'idle' | 'demo' | 'happy' | 'encourage'

export interface CoachOptions {
  /** 1 单位 = 多少像素 */
  scale: number
  /** 髋中点在画布上的像素位置 */
  cx: number
  cy: number
}

function resolvePose(id: string): CoachPoints {
  const b = base()
  const o = POSES[id] ?? {}
  return override(b, o)
}

function lerpPts(from: CoachPoints, to: CoachPoints, t: number): CoachPoints {
  const L = (a: [number, number], b: [number, number]): [number, number] =>
    [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  return {
    headX: from.headX + (to.headX - from.headX) * t,
    headY: from.headY + (to.headY - from.headY) * t,
    shL: L(from.shL, to.shL), shR: L(from.shR, to.shR),
    elL: L(from.elL, to.elL), elR: L(from.elR, to.elR),
    wrL: L(from.wrL, to.wrL), wrR: L(from.wrR, to.wrR),
    kpL: L(from.kpL, to.kpL), kpR: L(from.kpR, to.kpR),
    knL: L(from.knL, to.knL), knR: L(from.knR, to.knR),
    anL: L(from.anL, to.anL), anR: L(from.anR, to.anR),
    bounce: from.bounce + (to.bounce - from.bounce) * t,
  }
}

export class Coach {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cur: CoachPoints = resolvePose('stand')
  private target: CoachPoints = resolvePose('stand')
  private opts: CoachOptions = { scale: 90, cx: 0, cy: 0 }
  private expression: CoachExpression = 'idle'
  private demoAction: ActionTemplate | null = null
  private holdStart = 0
  private demoPhase: 'go' | 'hold' | 'back' | 'idle' = 'idle'
  private raf = 0
  private lastNow = 0
  /** 示范完成回调（hold 阶段持续中） */
  onDemoActive?: (active: boolean) => void
  /** 眨眼计时 */
  private blinkUntil = 0
  private nextBlink = 2000

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.loop = this.loop.bind(this)
  }

  mount(): void {
    this.raf = requestAnimationFrame(this.loop)
  }

  unmount(): void {
    cancelAnimationFrame(this.raf)
  }

  setLayout(opts: CoachOptions): void {
    this.opts = opts
  }

  setExpression(e: CoachExpression): void {
    this.expression = e
  }

  /** 开始示范某动作（hold 型：go→hold→back 循环） */
  startDemo(action: ActionTemplate): void {
    this.demoAction = action
    this.demoPhase = 'go'
    this.target = resolvePose(action.id)
    this.holdStart = 0
    this.expression = 'demo'
  }

  stopDemo(): void {
    this.demoPhase = 'back'
    this.target = resolvePose('stand')
    this.demoAction = null
    if (this.expression === 'demo') this.expression = 'idle'
  }

  get isDemoActive(): boolean {
    return this.demoPhase === 'hold'
  }

  /** 姿态接近度（关键部位到目标点的平均距离） */
  private closeness(a: CoachPoints, b: CoachPoints): number {
    const pts: [number, number][][] = [
      [a.shL, b.shL], [a.shR, b.shR], [a.elL, b.elL], [a.elR, b.elR],
      [a.wrL, b.wrL], [a.wrR, b.wrR], [a.knL, b.knL], [a.knR, b.knR],
      [a.anL, b.anL], [a.anR, b.anR],
    ]
    let sum = 0
    for (const [p, q] of pts) sum += Math.hypot(p[0] - q[0], p[1] - q[1])
    return sum / pts.length
  }

  private loop(now: number): void {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(50, now - this.lastNow)
    this.lastNow = now

    // 姿态插值（时间常数 ~140ms）
    const t = 1 - Math.exp(-dt / 140)
    this.cur = lerpPts(this.cur, this.target, t)

    // 待机呼吸
    if (this.demoPhase === 'idle') {
      this.cur = { ...this.cur }
      this.cur.headY += Math.sin(now / 900) * 0.012
      for (const k of ['shL', 'shR'] as const) {
        this.cur[k] = [this.cur[k][0], this.cur[k][1] + Math.sin(now / 900) * 0.01]
      }
    }

    // 示范阶段推进
    if (this.demoAction) {
      if (this.demoPhase === 'go' && this.closeness(this.cur, this.target) < 0.035) {
        this.demoPhase = 'hold'
        this.holdStart = now
        this.onDemoActive?.(true)
      } else if (this.demoPhase === 'hold') {
        // 循环：hold 2.2s → 回站姿 0.8s → 再示范（提示节奏）
        if (now - this.holdStart > 2200) {
          this.demoPhase = 'back'
          this.target = resolvePose('stand')
          this.onDemoActive?.(false)
        }
      } else if (this.demoPhase === 'back' && this.closeness(this.cur, this.target) < 0.035) {
        this.demoPhase = 'go'
        this.target = resolvePose(this.demoAction.id)
      }
    }

    // 眨眼
    if (now > this.blinkUntil && now > this.nextBlink) {
      this.blinkUntil = now + 140
      this.nextBlink = now + 2200 + Math.random() * 2500
    }

    this.render(now)
  }

  private toPx(x: number, y: number): [number, number] {
    const { scale, cx, cy } = this.opts
    return [cx + x * scale, cy + y * scale]
  }

  private limb(a: [number, number], b: [number, number], c: [number, number], width: number, color: string): void {
    const [ax, ay] = this.toPx(a[0], a[1])
    const [bx, by] = this.toPx(b[0], b[1])
    const [cxx, cy2] = this.toPx(c[0], c[1])
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = width
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
    this.ctx.beginPath()
    this.ctx.moveTo(ax, ay)
    this.ctx.lineTo(bx, by)
    this.ctx.lineTo(cxx, cy2)
    this.ctx.stroke()
    // 手/脚
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(cxx, cy2, width * 0.55, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private render(now: number): void {
    const { ctx } = this
    const w = this.canvas.width, h = this.canvas.height
    ctx.clearRect(0, 0, w, h)
    if (w === 0 || h === 0) return

    const s = this.opts.scale
    const P = this.cur

    // 影子
    const [shX, shY] = this.toPx(0, 1.06)
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(shX, shY, s * 0.55 * (1 - Math.max(0, -P.bounce) * 0.3), s * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    const bodyColor = '#5aa9ff'
    const bodyDark = '#3d7fd4'

    // 腿
    this.limb(P.kpL, P.knL, P.anL, s * 0.16, bodyDark)
    this.limb(P.kpR, P.knR, P.anR, s * 0.16, bodyDark)

    // 躯干（圆角矩形）
    const [tl, tt] = this.toPx(-0.34, P.shL[1] - 0.06)
    const [br, bb] = this.toPx(0.34, P.kpL[1] + 0.14)
    ctx.fillStyle = bodyColor
    ctx.beginPath()
    ctx.roundRect(tl, tt, br - tl, bb - tt, s * 0.16)
    ctx.fill()
    // 胸口小屏幕
    const [cx0, cy0] = this.toPx(0, (P.shL[1] + 0.05))
    ctx.fillStyle = '#dff3ff'
    ctx.beginPath()
    ctx.arc(cx0, cy0, s * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = bodyDark
    ctx.font = `bold ${s * 0.14}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const heart = this.expression === 'happy' ? '♥' : this.demoPhase === 'hold' ? '✦' : '•'
    ctx.fillText(heart, cx0, cy0 + 1)

    // 手臂
    this.limb(P.shL, P.elL, P.wrL, s * 0.14, bodyDark)
    this.limb(P.shR, P.elR, P.wrR, s * 0.14, bodyDark)

    // 头
    const [hx, hy] = this.toPx(P.headX, P.headY)
    ctx.fillStyle = bodyColor
    ctx.beginPath()
    ctx.arc(hx, hy, s * HEAD_R, 0, Math.PI * 2)
    ctx.fill()
    // 天线
    ctx.strokeStyle = bodyDark
    ctx.lineWidth = s * 0.05
    ctx.beginPath()
    ctx.moveTo(hx, hy - s * HEAD_R)
    ctx.lineTo(hx, hy - s * HEAD_R - s * 0.22)
    ctx.stroke()
    ctx.fillStyle = '#ffce3a'
    ctx.beginPath()
    ctx.arc(hx, hy - s * HEAD_R - s * 0.28, s * 0.08, 0, Math.PI * 2)
    ctx.fill()

    this.drawFace(hx, hy, s * HEAD_R, now)
  }

  private drawFace(hx: number, hy: number, r: number, now: number): void {
    const { ctx } = this
    const eyeY = hy - r * 0.12
    const eyeDX = r * 0.42
    const blink = now < this.blinkUntil
    const eR = r * 0.16

    ctx.fillStyle = '#173049'
    // 眼睛
    for (const dx of [-eyeDX, eyeDX]) {
      if (blink || this.expression === 'happy') {
        // 眯眼笑
        ctx.strokeStyle = '#173049'
        ctx.lineWidth = r * 0.09
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.arc(hx + dx, eyeY + eR * 0.4, eR * 0.8, Math.PI * 1.15, Math.PI * 1.85)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(hx + dx, eyeY, eR, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(hx + dx + eR * 0.3, eyeY - eR * 0.3, eR * 0.32, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#173049'
      }
    }

    // 腮红
    ctx.fillStyle = 'rgba(255,140,150,0.55)'
    for (const dx of [-eyeDX * 1.25, eyeDX * 1.25]) {
      ctx.beginPath()
      ctx.arc(hx + dx, eyeY + r * 0.42, r * 0.13, 0, Math.PI * 2)
      ctx.fill()
    }

    // 嘴巴
    const my = hy + r * 0.38
    ctx.strokeStyle = '#173049'
    ctx.lineWidth = r * 0.08
    ctx.lineCap = 'round'
    if (this.expression === 'happy') {
      ctx.fillStyle = '#173049'
      ctx.beginPath()
      ctx.arc(hx, my, r * 0.22, 0, Math.PI)
      ctx.fill()
      ctx.fillStyle = '#ff8f9c'
      ctx.beginPath()
      ctx.arc(hx, my + r * 0.08, r * 0.1, 0, Math.PI)
      ctx.fill()
    } else if (this.expression === 'encourage') {
      // 张嘴“来~”
      ctx.fillStyle = '#173049'
      ctx.beginPath()
      ctx.ellipse(hx, my, r * 0.14, r * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (this.demoPhase === 'hold') {
      // 示范中：微笑 + 上下微动
      const o = Math.sin(now / 200) * r * 0.03
      ctx.beginPath()
      ctx.arc(hx, my - r * 0.12 + o, r * 0.18, Math.PI * 0.15, Math.PI * 0.85)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(hx, my - r * 0.1, r * 0.15, Math.PI * 0.2, Math.PI * 0.8)
      ctx.stroke()
    }
  }
}
