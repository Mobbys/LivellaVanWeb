/**
 * Sensibilità alla posa del telefono sul supporto. Non è matematica nuova: è
 * la risposta, misurata, a «funziona anche se il cruscotto è inclinato?».
 */

import { describe, expect, it } from 'vitest'
import { CalibrationError, calibrateStation, upInVehicle } from '../src/core/calibration'
import { attitude } from '../src/core/leveling'
import { rotationFromAxisAngle } from '../src/core/orientation'
import { degToRad, matMul, matMulVec, radToDeg, transpose, type Mat3, type Vec3 } from '../src/core/vec'

/** P mappa telefono→camper: inclinazione del supporto e rotazione sul piano. */
const mount = (tiltDeg: number, azimuthDeg = 0): Mat3 =>
  matMul(
    rotationFromAxisAngle([0, 0, 1], degToRad(azimuthDeg)),
    rotationFromAxisAngle([1, 0, 0], degToRad(tiltDeg)),
  )

/** Verticale letto dal telefono quando il camper ha il verticale u_c. */
const phoneReads = (p: Mat3, uc: Vec3): Vec3 => matMulVec(transpose(p), uc)

/** Camper inclinato, nella stessa convenzione di attitude(). */
const camper = (rollDeg: number, pitchDeg: number): Vec3 => {
  const v: Vec3 = [Math.tan(degToRad(rollDeg)), Math.tan(degToRad(pitchDeg)), 1]
  const n = Math.hypot(...v)
  return [v[0] / n, v[1] / n, v[2] / n]
}

const accepts = (tiltDeg: number, azimuthDeg = 0): boolean => {
  try {
    calibrateStation(phoneReads(mount(tiltDeg, azimuthDeg), [0, 0, 1]), 'top')
    return true
  } catch (error) {
    expect(error).toBeInstanceOf(CalibrationError)
    return false
  }
}

describe('inclinazione del supporto', () => {
  it('un cruscotto inclinato fino a 78° è accettato', () => {
    for (const tilt of [0, 30, 45, 60, 70, 75, 78]) expect(accepts(tilt)).toBe(true)
  })

  it('oltre i 78° la direzione del muso è troppo verticale e viene rifiutata', () => {
    for (const tilt of [79, 85, 90]) expect(accepts(tilt)).toBe(false)
  })

  it('un’inclinazione laterale non degenera mai: non tocca la direzione del muso', () => {
    for (const tilt of [45, 60, 85]) {
      const p = rotationFromAxisAngle([0, 1, 0], degToRad(tilt))
      expect(() => calibrateStation(phoneReads(p, [0, 0, 1]), 'top')).not.toThrow()
    }
  })

  it('a 60° di inclinazione la misura resta esatta: la posa è assorbita da M', () => {
    const p = mount(60)
    const m = calibrateStation(phoneReads(p, [0, 0, 1]), 'top')
    for (const [roll, pitch] of [
      [3, 0],
      [0, 2],
      [-4, 1.5],
    ]) {
      const letto = attitude(upInVehicle(m, phoneReads(p, camper(roll, pitch))))
      expect(radToDeg(letto.roll)).toBeCloseTo(roll, 9)
      expect(radToDeg(letto.pitch)).toBeCloseTo(pitch, 9)
    }
  })
})

describe('rimettere il telefono in una posa diversa da quella calibrata', () => {
  const m = calibrateStation(phoneReads(mount(45), [0, 0, 1]), 'top')
  const inBolla: Vec3 = [0, 0, 1]

  it('un errore di inclinazione entra nella misura uno a uno', () => {
    for (const delta of [1, 2, 5]) {
      const letto = attitude(upInVehicle(m, phoneReads(mount(45 + delta), inBolla)))
      expect(radToDeg(letto.pitch)).toBeCloseTo(delta, 9)
    }
  })

  it('una rotazione sul piano non sposta nulla, a camper in bolla', () => {
    for (const delta of [5, 10, 20]) {
      const letto = attitude(upInVehicle(m, phoneReads(mount(45, delta), inBolla)))
      expect(radToDeg(letto.roll)).toBeCloseTo(0, 9)
      expect(radToDeg(letto.pitch)).toBeCloseTo(0, 9)
    }
  })

  it('a camper storto una rotazione sul piano mescola rollio e beccheggio', () => {
    // 3° di rollio visti da un telefono ruotato di 20°: parte diventa beccheggio.
    const p = mount(45, 20)
    const askew = calibrateStation(phoneReads(p, [0, 0, 1]), 'top')
    const letto = attitude(upInVehicle(askew, phoneReads(p, camper(3, 0))))
    expect(radToDeg(letto.roll)).toBeCloseTo(3 * Math.cos(degToRad(20)), 1)
    expect(Math.abs(radToDeg(letto.pitch))).toBeGreaterThan(0.9)
  })
})
