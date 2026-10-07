import type { PoseFrame, Point, StandingReference } from '../src/pose'

const p = (x: number, y: number, score = 0.9): Point => ({ x, y, score })

/** 标准站姿：躯干 200px，髋 y=300，踝 y=460，中心 x=400 */
export function standing(overrides: Partial<PoseFrame> = {}): PoseFrame {
  return {
    nose: p(400, 40),
    leftEye: p(385, 55), rightEye: p(415, 55),
    leftEar: p(370, 60), rightEar: p(430, 60),
    leftShoulder: p(365, 100), rightShoulder: p(435, 100),
    leftElbow: p(352, 200), rightElbow: p(448, 200),
    leftWrist: p(352, 290), rightWrist: p(448, 290),
    leftHip: p(370, 300), rightHip: p(430, 300),
    leftKnee: p(368, 380), rightKnee: p(432, 380),
    leftAnkle: p(366, 460), rightAnkle: p(434, 460),
    ...overrides,
  }
}

export const STANDING_REF: StandingReference = {
  midHipX: 400, midHipY: 300, torso: 200,
  shoulderY: 100, ankleY: 460, hipAnkle: 160, stable: true,
}

/** 双手高举 */
export function bothUp(f: PoseFrame = standing()): PoseFrame {
  return {
    ...f,
    leftElbow: p(f.leftShoulder!.x, 40), rightElbow: p(f.rightShoulder!.x, 40),
    leftWrist: p(f.leftShoulder!.x, -40), rightWrist: p(f.rightShoulder!.x, -40),
  }
}

/** 双臂平展（小飞机） */
export function airplane(f: PoseFrame = standing()): PoseFrame {
  const ls = f.leftShoulder!, rs = f.rightShoulder!
  return {
    ...f,
    leftElbow: p(ls.x - 60, ls.y), rightElbow: p(rs.x + 60, rs.y),
    leftWrist: p(ls.x - 130, ls.y), rightWrist: p(rs.x + 130, rs.y),
  }
}

/** 比心（双手合于胸前） */
export function heart(f: PoseFrame = standing()): PoseFrame {
  const ls = f.leftShoulder!, rs = f.rightShoulder!
  const cx = (ls.x + rs.x) / 2
  return {
    ...f,
    leftElbow: p(ls.x - 10, ls.y + 60), rightElbow: p(rs.x + 10, rs.y + 60),
    leftWrist: p(cx - 2, ls.y + 50), rightWrist: p(cx + 2, ls.y + 50),
  }
}

/** 下蹲 */
export function crouch(f: PoseFrame = standing()): PoseFrame {
  const ls = f.leftShoulder!, rs = f.rightShoulder!
  const sy = ls.y + 110
  return {
    ...f,
    leftShoulder: p(ls.x, sy), rightShoulder: p(rs.x, sy),
    leftElbow: p(ls.x - 10, sy + 90), rightElbow: p(rs.x + 10, sy + 90),
    leftWrist: p(ls.x - 15, sy + 170), rightWrist: p(rs.x + 15, sy + 170),
    leftHip: p(ls.x + 5, 380), rightHip: p(rs.x - 5, 380),
    leftKnee: p(f.leftKnee!.x - 6, 420), rightKnee: p(f.rightKnee!.x + 6, 420),
    leftAnkle: p(f.leftAnkle!.x - 8, f.leftAnkle!.y), rightAnkle: p(f.rightAnkle!.x + 8, f.rightAnkle!.y),
  }
}

/** 跳跃（双脚离地） */
export function jump(f: PoseFrame = standing()): PoseFrame {
  return {
    ...f,
    leftKnee: p(f.leftKnee!.x - 8, 350), rightKnee: p(f.rightKnee!.x + 8, 350),
    leftAnkle: p(f.leftAnkle!.x - 10, 380), rightAnkle: p(f.rightAnkle!.x + 10, 380),
  }
}

/** 向屏幕右跨一步 */
export function stepRight(f: PoseFrame = standing(), dx = 120): PoseFrame {
  return {
    ...f,
    leftHip: p(f.leftHip!.x + dx, f.leftHip!.y), rightHip: p(f.rightHip!.x + dx, f.rightHip!.y),
    leftKnee: p(f.leftKnee!.x + dx, f.leftKnee!.y), rightKnee: p(f.rightKnee!.x + dx, f.rightKnee!.y),
    leftAnkle: p(f.leftAnkle!.x + dx, f.leftAnkle!.y), rightAnkle: p(f.rightAnkle!.x + dx, f.rightAnkle!.y),
  }
}

/** 向屏幕左弯腰 */
export function leanLeft(f: PoseFrame = standing(), dx = 100): PoseFrame {
  const ls = f.leftShoulder!, rs = f.rightShoulder!
  return {
    ...f,
    leftShoulder: p(ls.x - dx, ls.y), rightShoulder: p(rs.x - dx, rs.y),
    leftElbow: p(f.leftElbow!.x - dx + 10, f.leftElbow!.y), rightElbow: p(f.rightElbow!.x - dx + 10, f.rightElbow!.y),
    leftWrist: p(f.leftWrist!.x - dx + 15, f.leftWrist!.y), rightWrist: p(f.rightWrist!.x - dx + 15, f.rightWrist!.y),
  }
}

/** 缩放（体型）/平移（位置）变换 */
export function transform(f: PoseFrame, scale: number, tx = 0, ty = 0): PoseFrame {
  const out: PoseFrame = {}
  for (const [k, v] of Object.entries(f)) {
    if (v) out[k as keyof PoseFrame] = p(v.x * scale + tx, v.y * scale + ty, v.score)
  }
  return out
}

export function lowConfidence(f: PoseFrame, score = 0.2): PoseFrame {
  const out: PoseFrame = {}
  for (const [k, v] of Object.entries(f)) if (v) out[k as keyof PoseFrame] = p(v.x, v.y, score)
  return out
}
