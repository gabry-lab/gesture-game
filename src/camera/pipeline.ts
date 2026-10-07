/**
 * 摄像头 + @vladmandic/human MoveNet 姿态管线
 *
 * 流程：load 模型 → getUserMedia → 每帧 detect(video) → human.result.body[0]
 * → 转换为内部 PoseFrame（像素坐标 + score）→ 回调给游戏层。
 *
 * 隐私：所有处理在本地浏览器内完成，视频帧绝不离开设备。
 */
import { Human } from '@vladmandic/human'
import type { BodyResult } from '@vladmandic/human'
import type { PoseFrame } from '../pose'

export type PipelineStatus =
  | 'idle'        // 未初始化
  | 'loading'     // 模型加载中
  | 'requesting'  // 请求摄像头权限
  | 'running'     // 正常运行
  | 'error'

export interface PipelineCallbacks {
  onFrame: (frame: PoseFrame | null, source: BodyResult | null) => void
  onStatus: (status: PipelineStatus, detail?: string) => void
  /** 检测 FPS */
  onFps?: (fps: number) => void
}

export class PosePipeline {
  private human: Human | null = null
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private raf = 0
  private running = false
  private lastDetect = 0
  private detectTimes: number[] = []
  private cb: PipelineCallbacks
  /** 最近一帧姿态（供渲染层读取） */
  lastFrame: PoseFrame | null = null
  /** 检测目标宽度（像素）。越小越快，但精度下降。416 是 MoveNet 的推荐输入尺寸。 */
  targetWidth = 416

  constructor(cb: PipelineCallbacks) {
    this.cb = cb
  }

  get status(): PipelineStatus {
    if (!this.human) return 'idle'
    if (this.running) return 'running'
    return 'idle'
  }

  /** 加载模型（本地 public/models，之后 IndexedDB 缓存；只启用 body，其余模块全部关闭） */
  async loadModel(): Promise<void> {
    this.cb.onStatus('loading', '正在加载 AI 模型…')
    const human = new Human({
      debug: false,
      backend: 'webgl',
      modelBasePath: '/models/', // 绝对路径：dev/build 都从 public/models 提供
      cacheModels: typeof indexedDB !== 'undefined',
      filter: { enabled: false, equalization: false, flip: false },
      face: { enabled: false }, // 默认 true！会拉取 blazeface/facemesh，加载失败后触发 model.inputs 崩溃
      body: {
        enabled: true,
        maxDetected: 1,
        modelPath: 'movenet-lightning.json',
      },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
      gesture: { enabled: false },
    })
    this.human = human
    await human.load()
    this.cb.onStatus('idle', '模型加载完成')
  }

  /** 请求摄像头并开始检测循环 */
  async startCamera(videoEl: HTMLVideoElement): Promise<void> {
    if (!this.human) throw new Error('请先加载模型')
    this.cb.onStatus('requesting', '请求摄像头权限…')
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: false,
    })
    this.stream = stream
    this.video = videoEl
    videoEl.srcObject = stream
    await videoEl.play()
    this.running = true
    this.cb.onStatus('running')
    const loop = () => {
      if (!this.running) return
      this.raf = requestAnimationFrame(loop)
      void this.tick()
    }
    loop()
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    if (this.video) this.video.srcObject = null
    this.cb.onStatus('idle', '摄像头已停止')
  }

  destroy(): void {
    this.stop()
    this.human = null
  }

  private async tick(): Promise<void> {
    const video = this.video
    const human = this.human
    if (!video || !human) return
    if (video.readyState < 2 || video.paused) return

    const now = human.now()
    // 限制检测频率到 ~30fps，给渲染留余量
    if (now - this.lastDetect < 33) return
    this.lastDetect = now

    try {
      await human.detect(video)
    } catch {
      return // 单帧失败忽略
    }

    this.detectTimes.push(now)
    while (this.detectTimes.length > 0 && now - this.detectTimes[0] > 2000) this.detectTimes.shift()
    if (this.detectTimes.length > 2) {
      const fps = Math.round((this.detectTimes.length - 1) * 1000 / (now - this.detectTimes[0]))
      this.cb.onFps?.(fps)
    }

    const bodies = human.result?.body ?? []
    const b = bodies.length > 0 ? bodies[0] : null
    const frame = b ? this.toPoseFrame(b) : null
    this.lastFrame = frame
    this.cb.onFrame(frame, b)
  }

  /** 将 BodyResult 关键点转为内部 PoseFrame（像素坐标，未镜像） */
  private toPoseFrame(body: BodyResult): PoseFrame {
    const frame: PoseFrame = {}
    for (const kp of body.keypoints) {
      // human 库的 Point 是 [x, y, z?] 元组
      frame[kp.part as keyof PoseFrame] = {
        x: kp.position[0],
        y: kp.position[1],
        score: kp.score,
      }
    }
    return frame
  }

  /** 镜像绘制辅助：video 元素自身用 CSS transform 翻转时，
   *  坐标需同步 x → width - x。返回“绘制坐标系”的宽度。 */
  static mirrorX(x: number, width: number): number {
    return width - x
  }
}
