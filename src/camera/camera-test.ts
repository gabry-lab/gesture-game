/**
 * 相机实时测试屏：验证 PosePipeline 全链路
 * - 镜像视频 + 骨架叠加 + FPS + 状态
 * 画布用 CSS 像素坐标系 + DPR 缩放，与 object-fit:contain 的视频坐标精确对齐。
 */
import { PosePipeline } from './pipeline'
import { drawSkeleton } from './skeleton-draw'
import type { PoseFrame } from '../pose'

export function mountCameraTest(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="camwrap">
      <div class="cambox">
        <video id="cam" playsinline muted></video>
        <canvas id="skel"></canvas>
      </div>
      <div class="camhud">
        <span id="status">未开始</span>
        <span id="fps"></span>
        <span id="poseinfo"></span>
      </div>
    </div>`

  const video = root.querySelector('video') as HTMLVideoElement
  const canvas = root.querySelector('canvas') as HTMLCanvasElement
  const statusEl = root.querySelector('#status') as HTMLElement
  const fpsEl = root.querySelector('#fps') as HTMLElement
  const poseEl = root.querySelector('#poseinfo') as HTMLElement
  const box = root.querySelector('.cambox') as HTMLElement
  const ctx = canvas.getContext('2d')!

  const pipeline = new PosePipeline({
    onFrame: (frame) => {
      const n = frame ? Object.values(frame).filter((p) => p && p.score >= 0.4).length : 0
      poseEl.textContent = frame ? `关键点 ${n}` : '未检测到人体'
    },
    onStatus: (s, d) => {
      statusEl.textContent = `${s}${d ? ' · ' + d : ''}`
      fit()
    },
    onFps: (fps) => {
      fpsEl.textContent = `${fps} fps`
    },
  })

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(box.clientWidth * dpr)
    canvas.height = Math.round(box.clientHeight * dpr)
    canvas.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  window.addEventListener('resize', fit)

  let raf = 0
  const render = () => {
    raf = requestAnimationFrame(render)
    const w = box.clientWidth, h = box.clientHeight // CSS 像素
    if (w === 0 || h === 0) return
    ctx.clearRect(0, 0, w, h)
    const frame = pipeline.lastFrame
    if (!frame || video.videoWidth === 0) return
    // object-fit:contain 映射 + 镜像
    const vw = video.videoWidth, vh = video.videoHeight
    const sc = Math.min(w / vw, h / vh)
    const ox = (w - vw * sc) / 2
    const oy = (h - vh * sc) / 2
    const mirrored: PoseFrame = {}
    for (const [k, v] of Object.entries(frame)) {
      if (v) mirrored[k as keyof PoseFrame] = { x: (vw - v.x) * sc + ox, y: v.y * sc + oy, score: v.score }
    }
    drawSkeleton(ctx, mirrored, w, h, { score: 100 })
  }

  const start = async () => {
    try {
      await pipeline.loadModel()
      await pipeline.startCamera(video)
      fit()
      render()
    } catch (e) {
      statusEl.textContent = `错误: ${e instanceof Error ? e.message : String(e)}`
    }
  }
  void start()

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', fit)
    pipeline.destroy()
  }
}
