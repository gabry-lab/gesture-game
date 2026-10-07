/**
 * 全屏撒花（Canvas 粒子，纯装饰，自动清理）
 */
const COLORS = ['#ffce3a', '#ff5c8a', '#50e296', '#5aa9ff', '#b06bff', '#ffffff']

export function confetti(container: HTMLElement, duration = 2600): void {
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  const w = (canvas.width = container.clientWidth)
  const h = (canvas.height = container.clientHeight)

  interface P { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; color: string; shape: number }
  const parts: P[] = Array.from({ length: 140 }, () => ({
    x: Math.random() * w,
    y: -20 - Math.random() * h * 0.4,
    vx: (Math.random() - 0.5) * 2.4,
    vy: 2 + Math.random() * 3.4,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.25,
    size: 6 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: Math.random() < 0.5 ? 0 : 1,
  }))

  const start = performance.now()
  let raf = 0
  const tick = (now: number) => {
    const el = now - start
    if (el >= duration) {
      cancelAnimationFrame(raf)
      canvas.remove()
      return
    }
    raf = requestAnimationFrame(tick)
    ctx.clearRect(0, 0, w, h)
    const fade = el > duration - 500 ? (duration - el) / 500 : 1
    ctx.globalAlpha = fade
    for (const p of parts) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.04
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }
  raf = requestAnimationFrame(tick)
}
