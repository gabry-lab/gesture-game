// MoveNet 17 关键点（与 @vladmandic/human 的 body keypoint part 名称一致）
export type Part =
  | 'nose'
  | 'leftEye' | 'rightEye'
  | 'leftEar' | 'rightEar'
  | 'leftShoulder' | 'rightShoulder'
  | 'leftElbow' | 'rightElbow'
  | 'leftWrist' | 'rightWrist'
  | 'leftHip' | 'rightHip'
  | 'leftKnee' | 'rightKnee'
  | 'leftAnkle' | 'rightAnkle'

export interface Point {
  x: number
  y: number
  /** 0..1 检测置信度 */
  score: number
}

/** 一帧姿态：像素坐标（y 向下）。面部关键点可缺失。 */
export type PoseFrame = Partial<Record<Part, Point>>

/** 校准得到的站立参考（像素空间，用于跳跃/侧步/下蹲等位移类动作） */
export interface StandingReference {
  /** 站立时双髋中点 X */
  midHipX: number
  /** 站立时双髋中点 Y（像素，y 向下） */
  midHipY: number
  /** 躯干长度（肩中点→髋中点）像素 */
  torso: number
  /** 站立时双肩中点 Y */
  shoulderY: number
  /** 站立时双脚中点 Y */
  ankleY: number
  /** 站立时 髋中点→脚中点 的垂直距离 */
  hipAnkle: number
  /** 校准是否稳定可信 */
  stable: boolean
}

export const DEFAULT_SCORE_THRESHOLD = 0.4

/** 身体骨架关键点（不含面部），用于归一化目标姿态 */
export const BODY_PARTS: Part[] = [
  'leftShoulder', 'rightShoulder',
  'leftElbow', 'rightElbow',
  'leftWrist', 'rightWrist',
  'leftHip', 'rightHip',
  'leftKnee', 'rightKnee',
  'leftAnkle', 'rightAnkle',
]

/** 骨骼连接（用于绘制骨架） */
export const SKELETON_BONES: [Part, Part][] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
]
