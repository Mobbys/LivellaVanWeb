import { describe, expect, it } from 'vitest'
import { beepInterval } from '../src/ui/beep'

describe('ritmo del beep', () => {
  it('accelera avvicinandosi allo zero', () => {
    const far = beepInterval(5, 1)
    const near = beepInterval(2, 1)
    const level = beepInterval(1, 1)
    expect(far).toBeGreaterThan(near)
    expect(near).toBeGreaterThan(level)
  })

  it('satura oltre i cinque gradi, senza rallentare all’infinito', () => {
    expect(beepInterval(5, 1)).toBe(beepInterval(45, 1))
  })

  it('dentro la tolleranza è al ritmo più fitto', () => {
    expect(beepInterval(0, 1)).toBe(beepInterval(1, 1))
  })

  it('non dipende dal segno dell’angolo', () => {
    expect(beepInterval(-3, 1)).toBe(beepInterval(3, 1))
  })

  it('regge una tolleranza larga senza dividere per zero', () => {
    expect(Number.isFinite(beepInterval(2, 5))).toBe(true)
    expect(Number.isFinite(beepInterval(20, 5))).toBe(true)
  })
})
