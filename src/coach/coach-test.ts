/** 教练自测屏：循环示范所有动作 + 表情切换 */
import { Coach } from './coach'
import { ACTION_LIST } from '../pose'

export function mountCoachTest(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="coachwrap">
      <canvas id="coach"></canvas>
      <div class="coachhud">
        <button class="btn sm" id="btnHappy">开心</button>
        <button class="btn sm" id="btnEnc">鼓励</button>
        <span id="actName"></span>
      </div>
    </div>`

  const canvas = root.querySelector('canvas') as HTMLCanvasElement
  const nameEl = root.querySelector('#actName') as HTMLElement
  const coach = new Coach(canvas)

  const fit = () => {
    const box = root.querySelector('.coachwrap') as HTMLElement
    canvas.width = box.clientWidth
    canvas.height = box.clientHeight
    coach.setLayout({
      scale: Math.min(canvas.width, canvas.height) / 5.2,
      cx: canvas.width * 0.5,
      cy: canvas.height * 0.62,
    })
  }
  fit()
  window.addEventListener('resize', fit)

  coach.mount()
  let idx = 0
  const next = () => {
    const a = ACTION_LIST[idx % ACTION_LIST.length]
    idx++
    nameEl.textContent = `${a.emoji} ${a.name}`
    coach.startDemo(a)
  }
  next()
  const timer = window.setInterval(next, 3500)

  root.querySelector('#btnHappy')!.addEventListener('click', () => coach.setExpression('happy'))
  root.querySelector('#btnEnc')!.addEventListener('click', () => coach.setExpression('encourage'))

  return () => {
    window.clearInterval(timer)
    window.removeEventListener('resize', fit)
    coach.unmount()
  }
}
