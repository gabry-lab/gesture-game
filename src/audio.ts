/**
 * WebAudio 程序化音效与节拍（无外部音频文件，无版权问题）
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  muted = false

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** 用户手势后调用以解锁（浏览器自动播放策略） */
  unlock(): void {
    this.ensure()
  }

  private beep(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.15, when = 0): void {
    if (this.muted) return
    const ctx = this.ensure()
    const t0 = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    osc.connect(g).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  /** UI 点击 */
  click(): void { this.beep(660, 0.08, 'triangle', 0.12) }
  /** 成功（上滑音阶） */
  success(): void {
    this.beep(523, 0.12, 'triangle', 0.18)
    this.beep(659, 0.12, 'triangle', 0.18, 0.1)
    this.beep(784, 0.22, 'triangle', 0.2, 0.2)
  }
  /** 完美（更亮的琶音） */
  perfect(): void {
    this.beep(784, 0.1, 'square', 0.08)
    this.beep(1046, 0.1, 'square', 0.08, 0.08)
    this.beep(1318, 0.18, 'square', 0.1, 0.16)
  }
  /** 失误（低沉短音，不刺耳） */
  miss(): void { this.beep(180, 0.18, 'sine', 0.12) }
  /** 鼓励（两音） */
  encourage(): void {
    this.beep(440, 0.1, 'triangle', 0.14)
    this.beep(554, 0.14, 'triangle', 0.14, 0.1)
  }
  /** 星级结算 */
  star(n: number): void {
    for (let i = 0; i < n; i++) this.beep(660 + i * 110, 0.2, 'triangle', 0.16, i * 0.18)
  }
  /** 关卡解锁/胜利 */
  victory(): void {
    const notes = [523, 659, 784, 1046]
    notes.forEach((f, i) => this.beep(f, 0.25, 'triangle', 0.18, i * 0.14))
  }

  /** 节拍声：tick=弱拍，strong=强拍 */
  tick(strong: boolean): void {
    if (this.muted) return
    this.ensure()
    const ctx = this.ctx!
    const t0 = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = strong ? 880 : 440
    g.gain.setValueAtTime(strong ? 0.3 : 0.15, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07)
    osc.connect(g).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + 0.09)
  }
}

export const audio = new AudioEngine()
