import { describe, it, expect } from 'vitest'
import { parsePlayParams } from '../src/ui/play-params'

describe('parsePlayParams', () => {
  it('解析闯关参数', () => {
    const p = parsePlayParams('#/play?l=2-3')
    expect(p).not.toBeNull()
    expect(p!.level!.id).toBe('2-3')
  })
  it('解析练习参数（hold）', () => {
    const p = parsePlayParams('#/play?a=bothHandsUp&m=hold')
    expect(p!.practiceAction).toBe('bothHandsUp')
    expect(p!.practiceMode).toBe('hold')
  })
  it('解析练习参数（beat）', () => {
    const p = parsePlayParams('#/play?a=jump&m=beat')
    expect(p!.practiceAction).toBe('jump')
    expect(p!.practiceMode).toBe('beat')
  })
  it('未知关卡 → null', () => {
    expect(parsePlayParams('#/play?l=9-9')).toBeNull()
  })
  it('未知动作 → null', () => {
    expect(parsePlayParams('#/play?a=nope&m=hold')).toBeNull()
  })
  it('缺少 mode → null', () => {
    expect(parsePlayParams('#/play?a=jump')).toBeNull()
  })
  it('非法路径 → null', () => {
    expect(parsePlayParams('#/play/xyz')).toBeNull()
    expect(parsePlayParams('#/play?')).toBeNull()
  })
})
