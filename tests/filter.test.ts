import { describe, expect, it } from 'vitest'
import { angleBetween, degToRad, norm, radToDeg, type Vec3 } from '../src/core/vec'
import { StabilityDetector, UpFilter, averageDirection } from '../src/core/filter'

function tilted(deg: number, azimuth = 0): Vec3 {
  const a = degToRad(deg)
  return [Math.sin(a) * Math.cos(azimuth), Math.sin(a) * Math.sin(azimuth), Math.cos(a)]
}

describe('media esponenziale sul versore verticale', () => {
  it('il primo campione inizializza il filtro senza ritardo', () => {
    const filter = new UpFilter(0.8)
    const first = tilted(4)
    const out = filter.update(first, 0.02)
    for (let k = 0; k < 3; k++) expect(out[k]).toBeCloseTo(first[k], 12)
  })

  it('l’uscita è sempre un versore', () => {
    const filter = new UpFilter(0.8)
    filter.update([0, 0, 1], 0.02)
    for (let i = 0; i < 100; i++) {
      const out = filter.update([3 * Math.sin(i), 2 * Math.cos(i), 7], 0.02)
      expect(Math.abs(norm(out) - 1)).toBeLessThan(1e-12)
    }
  })

  it('dopo una costante di tempo ha coperto circa il 63% del gradino', () => {
    const filter = new UpFilter(0.8)
    const target = tilted(5)
    filter.update([0, 0, 1], 0.02)
    for (let t = 0; t < 0.8 - 1e-9; t += 0.02) filter.update(target, 0.02)
    const covered = radToDeg(angleBetween([0, 0, 1], filter.value!)) / 5
    expect(covered).toBeGreaterThan(0.6)
    expect(covered).toBeLessThan(0.68)
  })

  it('converge al valore stazionario entro cinque costanti di tempo', () => {
    const filter = new UpFilter(0.8)
    const target = tilted(5)
    filter.update([0, 0, 1], 0.02)
    for (let t = 0; t < 4.0; t += 0.02) filter.update(target, 0.02)
    expect(radToDeg(angleBetween(target, filter.value!))).toBeLessThan(0.05)
  })

  it('una costante di tempo maggiore rallenta la risposta', () => {
    const fast = new UpFilter(0.2)
    const slow = new UpFilter(2.0)
    const target = tilted(5)
    fast.update([0, 0, 1], 0.02)
    slow.update([0, 0, 1], 0.02)
    for (let t = 0; t < 0.5; t += 0.02) {
      fast.update(target, 0.02)
      slow.update(target, 0.02)
    }
    expect(angleBetween(target, fast.value!)).toBeLessThan(angleBetween(target, slow.value!))
  })

  it('attenua il rumore a media nulla', () => {
    const filter = new UpFilter(0.8)
    filter.update([0, 0, 1], 0.02)
    for (let i = 0; i < 500; i++) {
      const noise = i % 2 === 0 ? 1 : -1
      filter.update(tilted(noise, 0), 0.02)
    }
    expect(radToDeg(angleBetween([0, 0, 1], filter.value!))).toBeLessThan(0.05)
  })

  it('reset riporta il filtro allo stato iniziale', () => {
    const filter = new UpFilter(0.8)
    filter.update(tilted(10), 0.02)
    filter.reset()
    expect(filter.value).toBeNull()
  })

  it('un dt non positivo salta il filtraggio invece di dividere per zero', () => {
    const filter = new UpFilter(0.8)
    filter.update([0, 0, 1], 0.02)
    const jump = tilted(10)
    const out = filter.update(jump, 0)
    for (let k = 0; k < 3; k++) expect(out[k]).toBeCloseTo(jump[k], 12)
  })

  it('rifiuta una costante di tempo non positiva', () => {
    expect(() => new UpFilter(0)).toThrow()
    expect(() => new UpFilter(-1)).toThrow()
  })
})

describe('media di una finestra di campioni', () => {
  it('media e rinormalizza', () => {
    const mean = averageDirection([tilted(2), tilted(-2), tilted(2), tilted(-2)])
    expect(Math.abs(norm(mean) - 1)).toBeLessThan(1e-12)
    expect(radToDeg(angleBetween([0, 0, 1], mean))).toBeLessThan(1e-9)
  })

  it('rifiuta una finestra vuota', () => {
    expect(() => averageDirection([])).toThrow()
  })
})

describe('rilevatore di stabilità', () => {
  const constant = (detector: StabilityDetector, seconds: number, start = 0, deg = 0) => {
    let t = start
    for (; t < start + seconds - 1e-9; t += 0.02) detector.push(tilted(deg), t)
    return t
  }

  it('non si pronuncia finché la finestra non è piena', () => {
    const detector = new StabilityDetector()
    constant(detector, 0.3)
    expect(detector.ready).toBe(false)
    expect(detector.stable).toBe(false)
  })

  it('una lettura immobile è ferma', () => {
    const detector = new StabilityDetector()
    constant(detector, 1.2)
    expect(detector.ready).toBe(true)
    expect(detector.stable).toBe(true)
    expect(radToDeg(detector.spread)).toBeCloseTo(0, 12)
  })

  it('un rumore sotto la soglia resta fermo', () => {
    const detector = new StabilityDetector()
    for (let i = 0, t = 0; i < 60; i++, t += 0.02) {
      detector.push(tilted(i % 2 === 0 ? 0.02 : -0.02), t)
    }
    expect(radToDeg(detector.spread)).toBeLessThan(0.05)
    expect(detector.stable).toBe(true)
  })

  it('un movimento della mano non è fermo', () => {
    const detector = new StabilityDetector()
    for (let i = 0, t = 0; i < 60; i++, t += 0.02) {
      detector.push(tilted(Math.sin(i / 3) * 0.5), t)
    }
    expect(radToDeg(detector.spread)).toBeGreaterThan(0.05)
    expect(detector.stable).toBe(false)
  })

  it('dimentica i campioni fuori dalla finestra', () => {
    const detector = new StabilityDetector()
    let t = 0
    for (let i = 0; i < 50; i++, t += 0.02) detector.push(tilted(i % 2 === 0 ? 2 : -2), t)
    expect(detector.stable).toBe(false)
    constant(detector, 1.2, t)
    expect(detector.stable).toBe(true)
  })

  it('la soglia e la finestra sono configurabili', () => {
    const strict = new StabilityDetector({ window: 1, thresholdDeg: 0.001 })
    for (let i = 0, t = 0; i < 60; i++, t += 0.02) {
      strict.push(tilted(i % 2 === 0 ? 0.02 : -0.02), t)
    }
    expect(strict.stable).toBe(false)
  })

  it('reset svuota la finestra', () => {
    const detector = new StabilityDetector()
    constant(detector, 1.2)
    detector.reset()
    expect(detector.ready).toBe(false)
    expect(detector.stable).toBe(false)
  })

  it('la dispersione è indefinita con meno di due campioni', () => {
    const detector = new StabilityDetector()
    detector.push([0, 0, 1], 0)
    expect(detector.spread).toBe(Infinity)
  })

  it('la media della finestra è la lettura da salvare in calibrazione', () => {
    const detector = new StabilityDetector()
    for (let i = 0, t = 0; i < 60; i++, t += 0.02) {
      detector.push(tilted(i % 2 === 0 ? 0.02 : -0.02), t)
    }
    expect(radToDeg(angleBetween([0, 0, 1], detector.average()))).toBeLessThan(1e-9)
  })
})
