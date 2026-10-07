import { describe, it, expect } from 'vitest'
import { finishCalibration } from '../src/pose'
import { standing, transform, jump, lowConfidence } from './helpers'

function jitter(f: ReturnType<typeof standing>, i: number): ReturnType<typeof standing> {
  const j = (k: number) => Math.sin(i * 0.7 + k) * 2
  return transform(f, 1, j(1), j(2))
}

describe('finishCalibration', () => {
  it('稳定站姿 → 校准成功', () => {
    const frames = Array.from({ length: 60 }, (_, i) => jitter(standing(), i))
    const c = finishCalibration(frames)
    expect(c).not.toBeNull()
    expect(c!.ref.torso).toBeCloseTo(200, 0)
    expect(c!.ref.midHipX).toBeCloseTo(400, 0)
    expect(c!.ref.ankleY).toBeCloseTo(460, 0)
    expect(c!.ref.hipAnkle).toBeGreaterThan(100)
    expect(c!.ref.stable).toBe(true)
  })
  it('样本不足 → null', () => {
    expect(finishCalibration([standing()])).toBeNull()
  })
  it('样本不可用（低置信度）→ null', () => {
    const frames = Array.from({ length: 60 }, () => lowConfidence(standing(), 0.2))
    expect(finishCalibration(frames)).toBeNull()
  })
  it('抖动太大 → stable=false（但仍返回）', () => {
    const frames = Array.from({ length: 60 }, (_, i) => {
      const f = standing()
      // 大幅度左右晃动
      const dx = (i % 2 === 0 ? 1 : -1) * 60
      return transform(f, 1, dx, 0)
    })
    const c = finishCalibration(frames)
    expect(c).not.toBeNull()
    expect(c!.ref.stable).toBe(false)
  })
  it('校准期间有跳跃 → 仍用中位数，参考点大致正确', () => {
    const frames: ReturnType<typeof standing>[] = []
    for (let i = 0; i < 40; i++) frames.push(jitter(standing(), i))
    for (let i = 0; i < 20; i++) frames.push(jitter(jump(standing()), i))
    const c = finishCalibration(frames)
    expect(c).not.toBeNull()
    expect(c!.ref.torso).toBeCloseTo(200, 0)
    expect(Math.abs(c!.ref.ankleY - 460)).toBeLessThan(15)
  })
})
