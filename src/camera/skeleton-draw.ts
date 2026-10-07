/**
 * 卡通风格骨架绘制（覆盖在相机画面上）
 * 圆头关节 + 粗线条，颜色按得分状态变化。
 */
import { SKELETON_BONES, isOk } from '../pose'
import type { PoseFrame } from '../pose'

export interface SkeletonStyle {
  /** 主色（默认按 active 自动取色） */
  color?: string
  lineWidth?: number
  jointRadius?: number
  /** 0..1 得分，用于颜色渐变（绿↔红） */
  score?: number
  /** 是否绘制躯干填充 */
  fillTorso?: boolean
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `rgb(${r},${g},${bl})`
}

const RED: [number, number, number] = [255, 92, 92]
const GREEN: [number, number, number] = [80, 226, 150]

export function drawSkeleton(ctx: CanvasRenderingContext2D, frame: PoseFrame, w: number, _h: number, style: SkeletonStyle = {}): void {
  if (!frame) return
  const score = style.score ?? 1
  const color = style.color ?? lerpColor(RED, GREEN, Math.max(0, Math.min(1, score / 100)))
  const lw = style.lineWidth ?? Math.max(6, w * 0.012)
  const jr = style.jointRadius ?? Math.max(9, w * 0.018)

  // 躯干填充
  if (style.fillTorso !== false && isOk(frame, 'leftShoulder') && isOk(frame, 'rightShoulder') && isOk(frame, 'leftHip') && isOk(frame, 'rightHip')) {
    const ls = frame.leftShoulder!, rs = frame.rightShoulder!, lh = frame.leftHip!, rh = frame.rightHip!
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(ls.x, ls.y)
    ctx.lineTo(rs.x, rs.y)
    ctx.lineTo(rh.x, rh.y)
    ctx.lineTo(lh.x, lh.y)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 骨骼
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const [a, b] of SKELETON_BONES) {
    if (!isOk(frame, a) || !isOk(frame, b)) continue
    const pa = frame[a]!, pb = frame[b]!
    // 外发光
    ctx.globalAlpha = 0.25
    ctx.strokeStyle = color
    ctx.lineWidth = lw * 2.2
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
    // 主线
    ctx.globalAlpha = 0.95
    ctx.lineWidth = lw
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
  }

  // 关节圆点
  for (const part of Object.keys(frame) as (keyof PoseFrame)[]) {
    const p = frame[part]
    if (!p || p.score < 0.4) continue
    ctx.globalAlpha = 0.95
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(p.x, p.y, jr, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, jr * 0.62, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}
