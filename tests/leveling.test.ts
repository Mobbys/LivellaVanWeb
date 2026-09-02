import { describe, expect, it } from 'vitest'
import { radToDeg } from '../src/core/vec'
import {
  attitude,
  axleLift,
  metersToCm,
  referenceWheel,
  roundToStep,
  sideLift,
  wheelHeights,
  wheelLifts,
  type Vehicle,
} from '../src/core/leveling'

// Tolleranze della specifica 3.6: 0,1 mm sui rialzi, 0,001° sugli angoli.
const MM = 1e-4
const DEG = 1e-3

const van: Vehicle = { trackWidth: 2.2, wheelbase: 4.0, rearAxles: 1 }

describe('vettori di test della specifica 3.6', () => {
  it('in bolla: nessun rialzo, angoli nulli', () => {
    const up = [0, 0, 1] as const
    const { roll, pitch } = attitude(up)
    expect(radToDeg(roll)).toBeCloseTo(0, 6)
    expect(radToDeg(pitch)).toBeCloseTo(0, 6)

    const lifts = wheelLifts(up, van)
    expect(lifts.frontLeft).toBeCloseTo(0, 9)
    expect(lifts.frontRight).toBeCloseTo(0, 9)
    expect(lifts.rearLeft).toBeCloseTo(0, 9)
    expect(lifts.rearRight).toBeCloseTo(0, 9)
  })

  it('solo rollio 3°: lato sinistro da alzare di 11,5 cm', () => {
    const up = [0.052336, 0, 0.9986295] as const
    const { roll, pitch } = attitude(up)
    expect(Math.abs(radToDeg(roll) - 3)).toBeLessThan(DEG)
    expect(Math.abs(radToDeg(pitch))).toBeLessThan(DEG)

    const lifts = wheelLifts(up, van)
    expect(lifts.frontRight).toBeCloseTo(0, 9)
    expect(lifts.rearRight).toBeCloseTo(0, 9)
    expect(Math.abs(lifts.frontLeft - 0.1151392)).toBeLessThan(MM)
    expect(Math.abs(lifts.rearLeft - 0.1151392)).toBeLessThan(MM)
  })

  it('solo beccheggio 2°: asse posteriore da alzare di 14,0 cm', () => {
    const up = [0, 0.0348995, 0.9993908] as const
    const { roll, pitch } = attitude(up)
    expect(Math.abs(radToDeg(roll))).toBeLessThan(DEG)
    expect(Math.abs(radToDeg(pitch) - 2)).toBeLessThan(DEG)

    const lifts = wheelLifts(up, van)
    expect(lifts.frontLeft).toBeCloseTo(0, 9)
    expect(lifts.frontRight).toBeCloseTo(0, 9)
    expect(Math.abs(lifts.rearLeft - 0.1395980)).toBeLessThan(MM)
    expect(Math.abs(lifts.rearRight - 0.1395980)).toBeLessThan(MM)
  })

  it('combinato: AD = 0, AS = 11,0 cm, PS = 23,0 cm, PD = 12,0 cm', () => {
    // La tabella della specifica riporta PD = 1,0 cm: è un refuso.
    // h_PD = 1,1·0,05 − 2,0·0,03 = −0,005 e max(h) = h_AD = 0,115,
    // quindi rialzo_PD = 0,115 − (−0,005) = 0,120 m.
    const up = [0.05, 0.03, 0.9982985] as const

    const lifts = wheelLifts(up, van)
    expect(lifts.frontRight).toBeCloseTo(0, 9)
    expect(Math.abs(lifts.frontLeft - 0.11)).toBeLessThan(MM)
    expect(Math.abs(lifts.rearLeft - 0.23)).toBeLessThan(MM)
    expect(Math.abs(lifts.rearRight - 0.12)).toBeLessThan(MM)
  })
})

describe('attitude', () => {
  it('rollio positivo quando il lato destro è più alto', () => {
    expect(attitude([0.1, 0, 0.99]).roll).toBeGreaterThan(0)
  })

  it('beccheggio positivo quando il muso è più alto', () => {
    expect(attitude([0, 0.1, 0.99]).pitch).toBeGreaterThan(0)
  })

  it('gestisce angoli oltre 45°', () => {
    const s = Math.sin(Math.PI / 3)
    const c = Math.cos(Math.PI / 3)
    expect(Math.abs(radToDeg(attitude([s, 0, c]).roll) - 60)).toBeLessThan(DEG)
    expect(Math.abs(radToDeg(attitude([0, s, c]).pitch) - 60)).toBeLessThan(DEG)
  })

  it('normalizza il versore in ingresso', () => {
    const a = attitude([0.052336, 0, 0.9986295])
    const b = attitude([0.52336, 0, 9.986295])
    expect(Math.abs(radToDeg(a.roll) - radToDeg(b.roll))).toBeLessThan(DEG)
  })
})

describe('altezze e rialzi', () => {
  it('la ruota di riferimento è quella già più alta e ha rialzo nullo', () => {
    const up = [0.05, 0.03, 0.9982985] as const
    const heights = wheelHeights(up, van)
    const lifts = wheelLifts(up, van)
    expect(referenceWheel(lifts)).toBe('frontRight')
    expect(heights.frontRight).toBeGreaterThan(heights.frontLeft)
    expect(lifts[referenceWheel(lifts)]).toBeCloseTo(0, 12)
  })

  it('nessun rialzo è mai negativo', () => {
    const lifts = wheelLifts([-0.2, -0.15, 0.9682458], van)
    for (const lift of Object.values(lifts)) expect(lift).toBeGreaterThanOrEqual(0)
  })

  it('carreggiata zero annulla la differenza fra i lati', () => {
    const degenerate: Vehicle = { trackWidth: 0, wheelbase: 4.0, rearAxles: 1 }
    const lifts = wheelLifts([0.052336, 0, 0.9986295], degenerate)
    expect(lifts.frontLeft).toBeCloseTo(0, 12)
    expect(lifts.frontRight).toBeCloseTo(0, 12)
    expect(lifts.rearLeft).toBeCloseTo(0, 12)
    expect(lifts.rearRight).toBeCloseTo(0, 12)
  })

  it('il doppio asse posteriore non cambia il calcolo, il passo è già al centro del tandem', () => {
    const tandem: Vehicle = { ...van, rearAxles: 2 }
    expect(wheelLifts([0.05, 0.03, 0.9982985], tandem)).toEqual(
      wheelLifts([0.05, 0.03, 0.9982985], van),
    )
  })
})

describe('rialzo per lato e per asse', () => {
  it('rialzo_lato = C · |ux| sul lato più basso', () => {
    const { side, lift } = sideLift([0.052336, 0, 0.9986295], van)
    expect(side).toBe('left')
    expect(Math.abs(lift - 2.2 * 0.052336)).toBeLessThan(MM)
  })

  it('il lato destro è il più basso con rollio negativo', () => {
    const { side, lift } = sideLift([-0.052336, 0, 0.9986295], van)
    expect(side).toBe('right')
    expect(Math.abs(lift - 2.2 * 0.052336)).toBeLessThan(MM)
  })

  it('rialzo_asse = P · |uy| sull’asse più basso', () => {
    const { axle, lift } = axleLift([0, 0.0348995, 0.9993908], van)
    expect(axle).toBe('rear')
    expect(Math.abs(lift - 4.0 * 0.0348995)).toBeLessThan(MM)
  })

  it('l’asse anteriore è il più basso con beccheggio negativo', () => {
    const { axle, lift } = axleLift([0, -0.0348995, 0.9993908], van)
    expect(axle).toBe('front')
    expect(Math.abs(lift - 4.0 * 0.0348995)).toBeLessThan(MM)
  })

  it('nessun lato e nessun asse da alzare quando il camper è in bolla', () => {
    expect(sideLift([0, 0, 1], van).side).toBe('none')
    expect(axleLift([0, 0, 1], van).axle).toBe('none')
  })
})

describe('conversione al confine con la UI', () => {
  it('converte i metri in centimetri', () => {
    expect(metersToCm(0.1151392)).toBeCloseTo(11.51392, 9)
    expect(metersToCm(0)).toBe(0)
  })

  it('arrotonda al mezzo centimetro', () => {
    expect(roundToStep(11.51392, 0.5)).toBe(11.5)
    expect(roundToStep(11.74, 0.5)).toBe(11.5)
    expect(roundToStep(11.76, 0.5)).toBe(12)
    expect(roundToStep(0.2, 0.5)).toBe(0)
    expect(roundToStep(-11.6, 0.5)).toBe(-11.5)
  })

  it('arrotonda al mezzo millimetro con un passo diverso', () => {
    expect(roundToStep(115.139, 5)).toBe(115)
    expect(roundToStep(117.6, 5)).toBe(120)
  })

  it('un passo non positivo lascia il valore intatto', () => {
    expect(roundToStep(11.51392, 0)).toBe(11.51392)
    expect(roundToStep(11.51392, -1)).toBe(11.51392)
  })

  it('non produce mai più di una cifra decimale utile in cm', () => {
    const lifts = wheelLifts([0.05, 0.03, 0.9982985], van)
    for (const lift of Object.values(lifts)) {
      const cm = roundToStep(metersToCm(lift), 0.5)
      expect(Number.isInteger(cm * 2)).toBe(true)
    }
  })
})
