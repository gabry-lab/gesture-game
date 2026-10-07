import type { PoseFrame, StandingReference } from './types'
import { midShoulder, midHip, midAnkle, torsoLength } from './geometry'
import { isUsable } from './actions'

export interface Calibration {
  samples: number
  ref: StandingReference
}

function median(vals: number[]): number {
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function stdev(vals: number[]): number {
  if (vals.length < 2) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length)
}

/**
 * 姿态校准：请孩子站直不动，采样躯干/髋/肩/踝位置，
 * 得到站立参考（位移类动作的基准）。
 * 返回 null 表示样本不足或不够稳定（调用方自行决定如何处理 stable=false）。
 */
export function finishCalibration(frames: PoseFrame[], minSamples = 30): Calibration | null {
  const usable = frames.filter((f) => isUsable(f, 0.4))
  if (usable.length < minSamples) return null

  const torsos: number[] = []
  const hipX: number[] = []; const hipY: number[] = []
  const shoulderY: number[] = []
  const ankleY: number[] = []
  for (const f of usable) {
    const t = torsoLength(f, 0.4)
    const mh = midHip(f); const ms = midShoulder(f); const ma = midAnkle(f)
    if (t) torsos.push(t)
    if (mh) { hipX.push(mh.x); hipY.push(mh.y) }
    if (ms) shoulderY.push(ms.y)
    if (ma) ankleY.push(ma.y)
  }
  if (torsos.length < minSamples || hipX.length < minSamples || shoulderY.length < minSamples || ankleY.length < minSamples) return null

  // 稳定性：孩子需要站着不动
  const T = median(torsos)
  const stable =
    stdev(hipX) < 0.05 * T &&
    stdev(shoulderY) < 0.06 * T &&
    stdev(ankleY) < 0.06 * T

  const midHipY = median(hipY)
  const ref: StandingReference = {
    midHipX: median(hipX),
    midHipY,
    torso: T,
    shoulderY: median(shoulderY),
    ankleY: median(ankleY),
    hipAnkle: median(ankleY) - midHipY,
    stable,
  }
  return { samples: usable.length, ref }
}
