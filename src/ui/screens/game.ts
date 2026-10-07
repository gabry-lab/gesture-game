/**
 * 游戏画面：相机 + 骨架 + 卡通教练 + HUD + 会话状态机
 *
 * 路由：
 *   #/play?l=1-1                 闯关：完整关卡
 *   #/play?a=jump&m=beat         练习：节奏模式
 *   #/play?a=bothHandsUp&m=hold  练习：模仿模式
 */
import { PosePipeline } from '../../camera/pipeline'
import { drawSkeleton } from '../../camera/skeleton-draw'
import { Coach } from '../../coach/coach'
import { evaluateAction, finishCalibration } from '../../pose'
import type { PoseFrame, StandingReference } from '../../pose'
import { SessionManager } from '../../session'
import type { SessionResult } from '../../session'
import { ACTIONS } from '../../pose'
import { loadProgress, completeLevel, starsFromScore } from '../../levels'
import type { LevelStep } from '../../levels'
import { audio } from '../../audio'
import { confetti } from '../confetti'
import type { PlayParams } from '../play-params'

export { parsePlayParams } from '../play-params'

export function mountGame(root: HTMLElement, params: PlayParams): () => void {
  const level = params.level
  const title = level ? `${level.emoji} ${level.name}` : `练习 · ${ACTIONS[params.practiceAction!].name}`

  root.innerHTML = `
    <div class="game">
      <div class="game-stage">
        <video id="gvideo" playsinline muted></video>
        <canvas id="gcanvas"></canvas>
      </div>
      <div class="hud-top">
        <button class="hud-btn" id="btnExit">✕ 退出</button>
        <div class="hud-title" id="hudTitle">${title}</div>
        <div class="hud-progress" id="hudProgress"></div>
      </div>
      <div class="hud-bottom">
        <div class="coachbox">
          <canvas id="gcoach" width="220" height="260"></canvas>
          <div class="coach-name">动动</div>
        </div>
        <div class="hud-center">
          <div class="ringwrap">
            <svg class="ring" viewBox="0 0 120 120">
              <circle class="ring-bg" cx="60" cy="60" r="52" />
              <circle class="ring-fg" id="ringFg" cx="60" cy="60" r="52" />
            </svg>
            <div class="ring-label" id="ringLabel">--</div>
          </div>
          <div class="holdbar" id="holdbar" hidden>
            <div class="holdfill" id="holdfill"></div>
          </div>
          <div class="beats" id="beats"></div>
          <div class="action-hint" id="actionHint"></div>
        </div>
        <div class="hud-scorebox">
          <div class="hud-score" id="hudScore">0</div>
          <div class="hud-combo" id="hudCombo"></div>
          <div class="hud-grade" id="hudGrade"></div>
        </div>
      </div>
      <div class="overlay" id="overlay"></div>
    </div>`

  const video = root.querySelector('#gvideo') as HTMLVideoElement
  const canvas = root.querySelector('#gcanvas') as HTMLCanvasElement
  const coachCanvas = root.querySelector('#gcoach') as HTMLCanvasElement
  const overlayEl = root.querySelector('#overlay') as HTMLElement
  const ringFg = root.querySelector('#ringFg') as SVGCircleElement
  const ringLabel = root.querySelector('#ringLabel') as HTMLElement
  const holdbar = root.querySelector('#holdbar') as HTMLElement
  const holdfill = root.querySelector('#holdfill') as HTMLElement
  const beatsEl = root.querySelector('#beats') as HTMLElement
  const actionHint = root.querySelector('#actionHint') as HTMLElement
  const hudScore = root.querySelector('#hudScore') as HTMLElement
  const hudCombo = root.querySelector('#hudCombo') as HTMLElement
  const hudGrade = root.querySelector('#hudGrade') as HTMLElement
  const hudProgress = root.querySelector('#hudProgress') as HTMLElement
  const btnExit = root.querySelector('#btnExit') as HTMLButtonElement

  const stage = root.querySelector('.game-stage') as HTMLElement
  const stageRect = () => stage.getBoundingClientRect()

  function sizeCanvas() {
    const r = stageRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    // 用 CSS 像素作绘制坐标系，保证与 object-fit:cover 的视频坐标精确对齐
    canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  sizeCanvas()
  const onResize = () => sizeCanvas()
  window.addEventListener('resize', onResize)

  const RING_C = 2 * Math.PI * 52
  ringFg.style.strokeDasharray = String(RING_C)
  ringFg.style.strokeDashoffset = String(RING_C)

  // ---------------- 流程状态 ----------------
  type Phase = 'boot' | 'calibrate' | 'countdown' | 'playing' | 'finished'
  let phase: Phase = 'boot'
  let latestFrame: PoseFrame | null = null
  let ref: StandingReference | null = null
  let session: SessionManager | null = null
  let shownGrade: import('../../session').Grade | null = null
  let gradeHideTimer = 0
  let disposed = false

  const coach = new Coach(coachCanvas)
  coach.setLayout({ scale: 62, cx: 110, cy: 150 })

  function showOverlay(html: string) {
    overlayEl.innerHTML = html
    overlayEl.classList.remove('hidden')
  }
  function hideOverlay() {
    overlayEl.classList.add('hidden')
    overlayEl.innerHTML = ''
  }

  // ---------------- 管线 ----------------
  const pipeline = new PosePipeline({
    onFrame: (frame) => {
      latestFrame = frame
      if (phase === 'calibrate' && frame) {
        calibFrames.push(frame)
      }
      if (phase === 'playing' && session && frame) {
        const action = session.currentAction
        const r = evaluateAction(frame, ref, action, 0.4)
        session.setScore(r.score)
      }
    },
    onStatus: (s, d) => {
      if (disposed) return
      if (s === 'loading' || s === 'requesting') {
        showOverlay(`<div class="ov-card"><div class="ov-big">🤖</div><div class="ov-text">${d ?? s}</div>
          <div class="ov-bar"><div class="ov-barfill"></div></div></div>`)
      }
    },
    onFps: () => { /* fps 略 */ },
  })

  // ---------------- 校准 ----------------
  let calibFrames: PoseFrame[] = []
  let calibStart = 0
  let calibMsgShown = false
  function startCalibration() {
    phase = 'calibrate'
    calibFrames = []
    calibStart = performance.now()
    calibMsgShown = false
    calibDecided = false
    showOverlay(`<div class="ov-card">
      <div class="ov-big">📐</div>
      <div class="ov-title">请站到镜头前</div>
      <div class="ov-text">站直不动 3 秒，动动要记住你的身高～</div>
      <div class="calib-timer" id="calibTimer">3.0</div>
    </div>`)
  }

  // 校准计时（由渲染循环驱动）
  let calibDecided = false
  function pumpCalibration(now: number): void {
    if (phase !== 'calibrate') return
    const el = root.querySelector('#calibTimer') as HTMLElement | null
    if (el) {
      const left = Math.max(0, 3 - (now - calibStart) / 1000)
      el.textContent = left.toFixed(1)
    }
    if (!latestFrame && now - calibStart > 2000 && !calibMsgShown) {
      calibMsgShown = true
      const t = root.querySelector('#calibTimer') as HTMLElement | null
      if (t) t.textContent = '请走到镜头前 😊'
    }
    if (now - calibStart >= 3000 && !calibDecided) {
      calibDecided = true
      const calib = finishCalibration(calibFrames, 25)
      if (calib && calib.ref.stable) {
        ref = calib.ref
        startCountdown()
      } else if (calib) {
        // 不稳定但有点样本：用中位数继续，提示一下
        ref = calib.ref
        showOverlay(`<div class="ov-card"><div class="ov-big">😅</div>
          <div class="ov-text">有一点点晃动，没关系，开始吧！</div></div>`)
        setTimeout(() => { if (!disposed) startCountdown() }, 1200)
      } else {
        // 无样本：重试
        showOverlay(`<div class="ov-card"><div class="ov-big">🙈</div>
          <div class="ov-text">没有看到你！站到画面中间再来一次～</div></div>`)
        setTimeout(() => { if (!disposed) startCalibration() }, 1800)
      }
    }
  }

  // ---------------- 倒计时 ----------------
  function startCountdown() {
    phase = 'countdown'
    let n = 3
    hideOverlay()
    actionHint.textContent = ''
    const cd = setInterval(() => {
      if (disposed) { clearInterval(cd); return }
      if (n <= 0) {
        clearInterval(cd)
        startPlaying()
        return
      }
      showOverlay(`<div class="ov-card cd"><div class="ov-cdnum">${n}</div></div>`)
      audio.tick(true)
      n--
      setTimeout(() => { if (!disposed) hideOverlay() }, 450)
    }, 700)
  }

  // ---------------- 开始游戏 ----------------
  function startPlaying() {
    // 组装 steps
    let steps: LevelStep[]
    let bpm = 100
    if (level) {
      steps = level.steps
      bpm = level.bpm
    } else {
      const action = ACTIONS[params.practiceAction!]
      const mode = params.practiceMode!
      steps = mode === 'beat'
        ? [{ action, repeats: 4 }]
        : [{ action, repeats: 1 }, { action, repeats: 1 }, { action, repeats: 1 }]
    }
    session = new SessionManager({
      steps,
      bpm,
      now: () => performance.now(),
      tick: (strong) => audio.tick(strong),
    })
    session.onDemoChange = (demoing) => {
      if (demoing) {
        coach.startDemo(session!.currentAction)
      } else {
        coach.stopDemo()
        coach.setExpression('idle')
      }
    }
    session.onUI = (ui) => {
      // ring
      const frac = ui.score / 100
      ringFg.style.strokeDashoffset = String(RING_C * (1 - frac))
      ringLabel.textContent = `${ui.score}`
      ringFg.style.stroke = frac >= 0.62 ? '#50e296' : frac >= 0.35 ? '#ffce3a' : '#ff5c5c'
      // hint
      actionHint.textContent = ui.phase === 'demo' ? `跟着 ${ui.action.emoji} 做！`
        : ui.phase === 'countin' ? `${ui.action.emoji} 准备好…`
        : ui.phase === 'hold' ? ui.action.hint
        : ui.action.hint
      // hold bar
      const showHold = ui.phase === 'hold'
      holdbar.hidden = !showHold
      holdfill.style.width = `${ui.holdFill}%`
      // beats
      renderBeats(ui.beatTotal, ui.beatDone, ui.phase === 'beat')
      // score / combo / grade
      hudScore.textContent = String(ui.points)
      hudCombo.textContent = ui.combo >= 3 ? `${ui.combo} 连击!` : ''
      hudProgress.textContent = `第 ${ui.currentStepIndex + 1}/${ui.totalSteps} 组`
      if (ui.lastGrade && ui.lastGrade !== shownGrade) {
        shownGrade = ui.lastGrade
        hudGrade.textContent = ui.lastGrade === 'PERFECT' ? '太棒了!!' : ui.lastGrade === 'GOOD' ? '不错哦!' : '再来一次'
        hudGrade.className = `hud-grade show ${ui.lastGrade}`
        if (ui.lastGrade === 'MISS') {
          coach.setExpression('encourage')
          audio.encourage()
        } else {
          coach.setExpression('happy')
          if (ui.lastGrade === 'PERFECT') audio.perfect(); else audio.success()
        }
        clearTimeout(gradeHideTimer)
        gradeHideTimer = window.setTimeout(() => {
          hudGrade.className = 'hud-grade'
          shownGrade = null
        }, 900)
      }
    }
    session.onDone = (r) => {
      phase = 'finished'
      finishGame(r)
    }
    coach.setExpression('idle')
    session.start()
    phase = 'playing'
  }

  function renderBeats(total: number, done: number, active: boolean) {
    if (!active && total === 0) { beatsEl.innerHTML = ''; return }
    beatsEl.innerHTML = Array.from({ length: total }, (_, i) =>
      `<span class="beat-dot${i < done ? ' hit' : ''}">${i < done ? '✓' : ''}</span>`).join('')
  }

  // ---------------- 结算 ----------------
  function finishGame(r: SessionResult) {
    const stars = starsFromScore(r.levelScore)
    coach.setExpression(stars > 0 ? 'happy' : 'encourage')
    audio.victory()
    audio.star(stars)
    if (stars >= 1) confetti(root.querySelector('.game') as HTMLElement, 3000)
    if (level && stars >= 1) {
      const p = loadProgress()
      completeLevel(p, level, stars)
    }
    showOverlay(`
      <div class="ov-card result">
        <div class="ov-big">${stars >= 2 ? '🎉' : stars === 1 ? '👍' : '💪'}</div>
        <div class="ov-title">${level ? '过关！' : '练习完成！'}</div>
        <div class="stars">
          ${[0, 1, 2].map((i) => `<span class="star${i < stars ? ' on' : ''}">⭐</span>`).join('')}
        </div>
        <div class="result-grid">
          <div><b>${r.levelScore}</b> 得分</div>
          <div><b>${r.points}</b> 积分</div>
          <div><b>${r.maxCombo}</b> 最高连击</div>
          <div><b>${r.perfect}/${r.perfect + r.good + r.miss}</b> 完美</div>
        </div>
        ${stars >= 1 && level && level.index === 2 ? `<div class="ov-sub">🎊 章节完成！</div>` : ''}
        <div class="result-btns">
          <button class="btn" id="btnAgain">再来一次</button>
          <a class="btn alt" href="#/map">返回地图</a>
        </div>
      </div>`)
    root.querySelector('#btnAgain')!.addEventListener('click', () => {
      audio.click()
      restart()
    })
  }

  function restart() {
    hideOverlay()
    ref = null
    session?.stop()
    calibFrames = []
    startCalibration()
  }

  // ---------------- 渲染循环 ----------------
  let raf = 0
  function render() {
    if (disposed) return
    raf = requestAnimationFrame(render)
    const nowMs = performance.now()
    if (phase === 'calibrate') pumpCalibration(nowMs)
    if (phase === 'playing' && session) session.update()

    const ctx = canvas.getContext('2d')!
    const r = stageRect()
    const w = r.width, h = r.height // CSS 像素
    ctx.clearRect(0, 0, w, h)
    const frame = latestFrame
    if (!frame || video.videoWidth === 0) return
    // object-fit: cover 映射 + 镜像
    const vw = video.videoWidth, vh = video.videoHeight
    const sc = Math.max(w / vw, h / vh)
    const ox = (w - vw * sc) / 2
    const oy = (h - vh * sc) / 2
    const mx = (x: number, y: number): [number, number] => [
      (vw - x) * sc + ox,
      y * sc + oy,
    ]
    const mirrored: PoseFrame = {}
    for (const [k, v] of Object.entries(frame)) {
      if (v) {
        const [x, y] = mx(v.x, v.y)
        mirrored[k as keyof PoseFrame] = { x, y, score: v.score }
      }
    }
    drawSkeleton(ctx, mirrored, w, h, { score: 100 })
  }

  // ---------------- 启动 ----------------
  btnExit.addEventListener('click', () => {
    audio.click()
    if (level) location.hash = '#/map'
    else location.hash = '#/'
  })

  const boot = async () => {
    try {
      await pipeline.loadModel()
      if (disposed) return
      hideOverlay()
      await pipeline.startCamera(video)
      if (disposed) return
      coach.mount()
      render()
      startCalibration()
    } catch (e) {
      const msg = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
        ? '没有摄像头权限 😢\n请在浏览器设置中允许使用摄像头后重试。'
        : `启动失败：${e instanceof Error ? e.message : String(e)}`
      showOverlay(`<div class="ov-card"><div class="ov-big">😢</div><div class="ov-text">${msg}</div>
        <button class="btn" id="btnRetry">重试</button>
        <a class="btn alt" href="${level ? '#/map' : '#/'}">返回</a></div>`)
      root.querySelector('#btnRetry')?.addEventListener('click', () => { hideOverlay(); void boot() })
    }
  }
  void boot()
  // 解锁音频（首次交互）
  const unlock = () => audio.unlock()
  window.addEventListener('pointerdown', unlock, { once: true })

  return () => {
    disposed = true
    clearTimeout(gradeHideTimer)
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('pointerdown', unlock)
    pipeline.destroy()
    coach.unmount()
  }
}
