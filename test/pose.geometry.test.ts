import { describe, it, expect } from 'vitest'
import { angleDeg, elevationDeg, torsoLength, midShoulder, midHip, isOk } from '../src/pose'
import { standing, bothUp, lowConfidence, transform } from './helpers'
import type { Vec } from '../src/pose'

const v = (x: number, y: number): Vec => ({ x, y })

describe('angleDeg', () => {
  it('直线 = 180°', () => {
    expect(angleDeg(v(0, 0), v(0, 10), v(0, 20))).toBeCloseTo(180, 6)
  })
  it('直角 = 90°', () => {
    expect(angleDeg(v(0, 0), v(10, 0), v(10, 10))).toBeCloseTo(90, 6)
  })
  it('锐角 = 45°', () => {
    expect(angleDeg(v(1, 1), v(0, 0), v(1, 0))).toBeCloseTo(45, 6)
  })
  it('退化（重合点）返回 180', () => {
    expect(angleDeg(v(5, 5), v(5, 5), v(9, 9))).toBe(180)
  })
})

describe('elevationDeg', () => {
  it('竖直向上 = 0°', () => {
    expect(elevationDeg(v(100, 200), v(100, 100))).toBeCloseTo(0, 6)
  })
  it('竖直向下 = 180°', () => {
    expect(elevationDeg(v(100, 100), v(100, 200))).toBeCloseTo(180, 6)
  })
  it('水平 = 90°', () => {
    expect(elevationDeg(v(0, 100), v(100, 100))).toBeCloseTo(90, 6)
  })
  it('斜上方 = 45°', () => {
    expect(elevationDeg(v(0, 0), v(10, -10))).toBeCloseTo(45, 6)
  })
})

describe('torsoLength / mid / isOk', () => {
  it('站姿躯干 ≈ 200', () => {
    expect(torsoLength(standing())!).toBeCloseTo(200, 0)
  })
  it('低置信度髋 → null', () => {
    const f = lowConfidence(standing(), 0.9)
    f.leftHip!.score = 0.1
    expect(torsoLength(f)).toBeNull()
  })
  it('midShoulder / midHip 正确', () => {
    expect(midShoulder(standing())!).toEqual({ x: 400, y: 100 })
    expect(midHip(standing())!).toEqual({ x: 400, y: 300 })
  })
  it('isOk 判断置信度', () => {
    const f = lowConfidence(standing(), 0.3)
    expect(isOk(f, 'leftShoulder', 0.4)).toBe(false)
    expect(isOk(f, 'leftShoulder', 0.2)).toBe(true)
  })
})

describe('姿态对角度动作的不变性', () => {
  it('双手高举在不同体型（scale=2）下角度不变', () => {
    const big = bothUp()
    const scaled = transform(bothUp(), 2)
    const el1 = elevationDeg(big.leftShoulder!, big.leftWrist!)
    const el2 = elevationDeg(scaled.leftShoulder!, scaled.leftWrist!)
    expect(el1).toBeCloseTo(el2, 6)
    expect(el1).toBeCloseTo(0, 0)
  })
})
