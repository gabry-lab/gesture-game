import type { Point, PoseFrame, Part } from './types'

/** 向量 */
export interface Vec { x: number; y: number }

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function len(v: Vec): number {
  return Math.hypot(v.x, v.y)
}

/** b 点处的夹角（deg），取值 0..180 */
export function angleDeg(a: Vec, b: Vec, c: Vec): number {
  const v1 = sub(a, b)
  const v2 = sub(c, b)
  const l1 = len(v1)
  const l2 = len(v2)
  if (l1 < 1e-6 || l2 < 1e-6) return 180
  let cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2)
  cos = Math.max(-1, Math.min(1, cos))
  return (Math.acos(cos) * 180) / Math.PI
}

/** 向量相对“正上方”的仰角（deg）：0=竖直向上，90=水平，180=竖直向下 */
export function elevationDeg(from: Vec, to: Vec): number {
  const v = sub(to, from)
  const l = len(v)
  if (l < 1e-6) return 180
  // y 向下坐标系，正上方 = (0, -1)
  const cos = (v.y * -1) / l
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

/** 关键点是否可信（存在且置信度足够） */
export function isOk(frame: PoseFrame, part: Part, threshold = 0.4): boolean {
  const p = frame[part]
  return !!p && p.score >= threshold
}

export function mid(a: Point, b: Point): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** 躯干长度（像素）；不可信时返回 null */
export function torsoLength(frame: PoseFrame, threshold = 0.4): number | null {
  if (!isOk(frame, 'leftShoulder', threshold) || !isOk(frame, 'rightShoulder', threshold)) return null
  if (!isOk(frame, 'leftHip', threshold) || !isOk(frame, 'rightHip', threshold)) return null
  const ms = mid(frame.leftShoulder!, frame.rightShoulder!)
  const mh = mid(frame.leftHip!, frame.rightHip!)
  const t = len(sub(ms, mh))
  return t >= 10 ? t : null
}

export function midShoulder(frame: PoseFrame): Vec | null {
  if (!isOk(frame, 'leftShoulder') || !isOk(frame, 'rightShoulder')) return null
  return mid(frame.leftShoulder!, frame.rightShoulder!)
}

export function midHip(frame: PoseFrame): Vec | null {
  if (!isOk(frame, 'leftHip') || !isOk(frame, 'rightHip')) return null
  return mid(frame.leftHip!, frame.rightHip!)
}

export function midAnkle(frame: PoseFrame): Vec | null {
  if (!isOk(frame, 'leftAnkle') || !isOk(frame, 'rightAnkle')) return null
  return mid(frame.leftAnkle!, frame.rightAnkle!)
}
