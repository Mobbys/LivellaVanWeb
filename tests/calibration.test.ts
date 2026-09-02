import { describe, expect, it } from 'vitest'
import {
  angleBetween,
  cross,
  degToRad,
  determinant,
  identity,
  isOrthonormal,
  matMul,
  matMulVec,
  norm,
  normalize,
  orthonormalizeRows,
  radToDeg,
  type Mat3,
  type Vec3,
} from '../src/core/vec'
import {
  quaternionToMatrix,
  rotationFromAxisAngle,
  upFromDeviceOrientation,
  upFromMatrix,
  upFromQuaternion,
  quaternionFromDeviceOrientation,
} from '../src/core/orientation'
import {
  CalibrationError,
  TRANSFER_TIMEOUT_MS,
  calibrateStation,
  matrixDifferenceAngle,
  transferAgrees,
  transferStation,
  upInVehicle,
} from '../src/core/calibration'

function expectMatrixCloseTo(actual: Mat3, expected: Mat3, digits = 12): void {
  for (let i = 0; i < 9; i++) expect(actual[i]).toBeCloseTo(expected[i], digits)
}

// Generatore pseudo-casuale deterministico: i test devono essere ripetibili.
function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function randomRotation(rnd: () => number): Mat3 {
  const axis: Vec3 = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]
  const n = norm(axis)
  const unit: Vec3 = n > 1e-6 ? [axis[0] / n, axis[1] / n, axis[2] / n] : [0, 0, 1]
  return rotationFromAxisAngle(unit, rnd() * 2 * Math.PI)
}

describe('costruzione della matrice di postazione', () => {
  it('telefono in piano con il bordo superiore verso il muso dà l’identità', () => {
    expectMatrixCloseTo(calibrateStation([0, 0, 1], 'top'), identity())
  })

  it('telefono in piano con il bordo superiore verso destra', () => {
    // Righe attese dalla specifica 3.6.
    expectMatrixCloseTo(calibrateStation([0, 0, 1], 'right'), [0, 1, 0, -1, 0, 0, 0, 0, 1])
  })

  it('con il bordo superiore verso destra, (0,1,0) del telefono è (1,0,0) del camper', () => {
    const m = calibrateStation([0, 0, 1], 'right')
    const mapped = matMulVec(m, [0, 1, 0])
    expect(mapped[0]).toBeCloseTo(1, 12)
    expect(mapped[1]).toBeCloseTo(0, 12)
    expect(mapped[2]).toBeCloseTo(0, 12)
  })

  it('le quattro orientazioni del muso sono rotazioni successive di 90°', () => {
    const orientations = ['top', 'left', 'bottom', 'right'] as const
    for (let i = 0; i < 4; i++) {
      const m = calibrateStation([0, 0, 1], orientations[i])
      const expected = rotationFromAxisAngle([0, 0, 1], (i * Math.PI) / 2)
      expectMatrixCloseTo(m, expected, 12)
    }
  })

  it('produce una matrice ortonormale destrorsa per qualunque appoggio valido', () => {
    const rnd = makeRandom(7)
    for (let i = 0; i < 200; i++) {
      const r = randomRotation(rnd)
      const up = upFromMatrix(r)
      for (const nose of ['top', 'bottom', 'left', 'right'] as const) {
        let m: Mat3
        try {
          m = calibrateStation(up, nose)
        } catch (error) {
          expect(error).toBeInstanceOf(CalibrationError)
          continue
        }
        expect(isOrthonormal(m)).toBe(true)
        // Il verticale letto in quell’istante deve risultare Z del camper.
        const uc = matMulVec(m, up)
        expect(uc[0]).toBeCloseTo(0, 12)
        expect(uc[1]).toBeCloseTo(0, 12)
        expect(uc[2]).toBeCloseTo(1, 12)
      }
    }
  })

  it('rifiuta l’appoggio degenere con il telefono in piedi', () => {
    // Bordo superiore quasi allineato al verticale: la proiezione collassa.
    expect(() => calibrateStation([0, 1, 0], 'top')).toThrow(CalibrationError)
    expect(() => calibrateStation([0, 0.995, 0.0999], 'top')).toThrow(CalibrationError)
  })

  it('accetta un appoggio appena sotto la soglia di degenerazione', () => {
    const tilt = degToRad(78) // |f_p · z| ≈ 0,978, sotto 0,98
    const up: Vec3 = [0, Math.sin(tilt), Math.cos(tilt)]
    expect(isOrthonormal(calibrateStation(up, 'top'))).toBe(true)
  })

  it('rifiuta un versore verticale nullo', () => {
    expect(() => calibrateStation([0, 0, 0], 'top')).toThrow(CalibrationError)
  })
})

describe('trasferimento fra postazioni', () => {
  it('round-trip: con R₀ = R₁ = I la matrice non cambia', () => {
    const mOld = calibrateStation([0.02, -0.01, 0.9997], 'left')
    expectMatrixCloseTo(transferStation(mOld, identity(), identity()), mOld)
  })

  it('la nuova postazione legge lo stesso verticale della vecchia', () => {
    const rnd = makeRandom(42)
    for (let i = 0; i < 100; i++) {
      const mOld = calibrateStation([0.05, 0.03, 0.9982985], 'top')
      const r0 = randomRotation(rnd)
      const r1 = randomRotation(rnd)
      const mNew = transferStation(mOld, r0, r1)

      // Verticale del mondo visto dalle due pose del telefono.
      const upAt0 = upFromMatrix(r0)
      const upAt1 = upFromMatrix(r1)
      const before = upInVehicle(mOld, upAt0)
      const after = upInVehicle(mNew, upAt1)
      for (let k = 0; k < 3; k++) expect(after[k]).toBeCloseTo(before[k], 12)
    }
  })

  it('resta ortonormale dopo cento trasferimenti concatenati', () => {
    const rnd = makeRandom(99)
    let m = calibrateStation([0, 0, 1], 'top')
    for (let i = 0; i < 100; i++) m = transferStation(m, randomRotation(rnd), randomRotation(rnd))
    expect(isOrthonormal(m, 1e-12)).toBe(true)
  })

  it('è invertibile: trasferire avanti e indietro riporta alla matrice iniziale', () => {
    const rnd = makeRandom(5)
    const m = calibrateStation([0, 0, 1], 'bottom')
    const r0 = randomRotation(rnd)
    const r1 = randomRotation(rnd)
    expectMatrixCloseTo(transferStation(transferStation(m, r0, r1), r1, r0), m, 11)
  })
})

describe('confronto di qualità fra due trasferimenti', () => {
  it('due matrici identiche differiscono di zero gradi', () => {
    const m = calibrateStation([0, 0, 1], 'top')
    expect(matrixDifferenceAngle(m, m)).toBeCloseTo(0, 12)
  })

  it('misura l’angolo di rotazione fra due matrici', () => {
    const m = calibrateStation([0, 0, 1], 'top')
    for (const deg of [0.1, 0.5, 3, 45, 179]) {
      const rotated = transferStation(m, identity(), rotationFromAxisAngle([1, 2, 3], degToRad(deg)))
      expect(radToDeg(matrixDifferenceAngle(m, rotated))).toBeCloseTo(deg, 9)
    }
  })
})

describe('proprietà della matrice di postazione', () => {
  it('conserva la norma: |M · u_p| = 1 entro 1e-12', () => {
    const rnd = makeRandom(2024)
    for (let i = 0; i < 500; i++) {
      const m = randomRotation(rnd)
      const v: Vec3 = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]
      const n = norm(v)
      if (n < 1e-6) continue
      const unit: Vec3 = [v[0] / n, v[1] / n, v[2] / n]
      expect(Math.abs(norm(matMulVec(m, unit)) - 1)).toBeLessThan(1e-12)
    }
  })

  it('ogni matrice di postazione ha determinante +1 e righe ortogonali', () => {
    const rnd = makeRandom(11)
    for (let i = 0; i < 100; i++) {
      let m: Mat3
      try {
        m = calibrateStation(upFromMatrix(randomRotation(rnd)), 'top')
      } catch (error) {
        expect(error).toBeInstanceOf(CalibrationError)
        continue
      }
      expect(isOrthonormal(m)).toBe(true)
      const x: Vec3 = [m[0], m[1], m[2]]
      const y: Vec3 = [m[3], m[4], m[5]]
      const z: Vec3 = [m[6], m[7], m[8]]
      const c = cross(x, y)
      for (let k = 0; k < 3; k++) expect(c[k]).toBeCloseTo(z[k], 12)
    }
  })
})

describe('accordo fra due trasferimenti ripetuti', () => {
  const base = calibrateStation([0, 0, 1], 'top')

  it('accetta uno scarto entro mezzo grado', () => {
    const repeated = transferStation(base, identity(), rotationFromAxisAngle([1, 0, 0], degToRad(0.4)))
    expect(transferAgrees(base, repeated)).toBe(true)
  })

  it('rifiuta uno scarto superiore a mezzo grado', () => {
    const repeated = transferStation(base, identity(), rotationFromAxisAngle([1, 0, 0], degToRad(0.6)))
    expect(transferAgrees(base, repeated)).toBe(false)
  })

  it('il timeout del trasferimento è di 90 secondi', () => {
    expect(TRANSFER_TIMEOUT_MS).toBe(90_000)
  })
})

describe('algebra di base', () => {
  it('normalize rifiuta un vettore nullo', () => {
    expect(() => normalize([0, 0, 0])).toThrow()
  })

  it('isOrthonormal riconosce una matrice non ortonormale', () => {
    expect(isOrthonormal([2, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(false)
    expect(isOrthonormal([1, 0, 0, 1, 1, 0, 0, 0, 1])).toBe(false)
    // Determinante −1: terna sinistrorsa, non è una rotazione.
    expect(isOrthonormal([1, 0, 0, 0, 1, 0, 0, 0, -1])).toBe(false)
  })

  it('il determinante di una rotazione è +1', () => {
    expect(determinant(rotationFromAxisAngle([1, 2, 3], degToRad(40)))).toBeCloseTo(1, 12)
  })

  it('matMul compone le rotazioni', () => {
    const a = rotationFromAxisAngle([0, 0, 1], degToRad(30))
    const b = rotationFromAxisAngle([0, 0, 1], degToRad(15))
    expectMatrixCloseTo(matMul(a, b), rotationFromAxisAngle([0, 0, 1], degToRad(45)))
  })

  it('orthonormalizeRows raddrizza una matrice sporcata dall’errore numerico', () => {
    const dirty: Mat3 = [1.000001, 0.000002, 0, -0.000001, 0.999998, 0, 0, 0, 1.000003]
    const clean = orthonormalizeRows(dirty)
    expect(isOrthonormal(clean, 1e-12)).toBe(true)
    expectMatrixCloseTo(clean, identity(), 5)
  })

  it('angleBetween misura l’angolo fra due direzioni', () => {
    expect(radToDeg(angleBetween([0, 0, 1], [1, 0, 0]))).toBeCloseTo(90, 12)
    expect(radToDeg(angleBetween([0, 0, 5], [0, 0, 2]))).toBeCloseTo(0, 12)
  })
})

describe('orientation', () => {
  it('rifiuta un quaternione nullo', () => {
    expect(() => quaternionToMatrix([0, 0, 0, 0])).toThrow()
  })

  it('upFromQuaternion coincide con la terza riga della matrice', () => {
    const q = quaternionFromDeviceOrientation(20, 15, -30)
    const viaMatrix = upFromMatrix(quaternionToMatrix(q))
    const direct = upFromQuaternion(q)
    for (let k = 0; k < 3; k++) expect(direct[k]).toBeCloseTo(viaMatrix[k], 12)
  })

  it('il quaternione identità dà la matrice identità', () => {
    expectMatrixCloseTo(quaternionToMatrix([0, 0, 0, 1]), identity())
  })

  it('quaternione e asse-angolo coincidono', () => {
    const angle = degToRad(37)
    const axis: Vec3 = [0, 0, 1]
    const s = Math.sin(angle / 2)
    const q: [number, number, number, number] = [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)]
    expectMatrixCloseTo(quaternionToMatrix(q), rotationFromAxisAngle(axis, angle))
  })

  it('up è la terza riga della matrice telefono→mondo', () => {
    const r = rotationFromAxisAngle([1, 1, 0], degToRad(20))
    const up = upFromMatrix(r)
    // R mappa telefono→mondo, quindi il verticale letto torna a essere Z del mondo.
    const worldUp = matMulVec(r, up)
    expect(worldUp[0]).toBeCloseTo(0, 12)
    expect(worldUp[1]).toBeCloseTo(0, 12)
    expect(worldUp[2]).toBeCloseTo(1, 12)
  })

  it('DeviceOrientationEvent: telefono in piano dà up = (0,0,1)', () => {
    const up = upFromDeviceOrientation(0, 0, 0)
    expect(up[0]).toBeCloseTo(0, 12)
    expect(up[1]).toBeCloseTo(0, 12)
    expect(up[2]).toBeCloseTo(1, 12)
  })

  it('DeviceOrientationEvent: beta inclina lungo Y, gamma lungo X', () => {
    const beta = upFromDeviceOrientation(0, 10, 0)
    expect(beta[1]).toBeCloseTo(Math.sin(degToRad(10)), 12)
    const gamma = upFromDeviceOrientation(0, 0, 10)
    expect(gamma[0]).toBeCloseTo(-Math.sin(degToRad(10)), 12)
  })

  it('la ricostruzione via quaternione coincide con la matrice di Eulero Z-X’-Y’’', () => {
    for (const [a, b, g] of [
      [0, 0, 0],
      [30, 10, -20],
      [200, -45, 80],
      [359, 89, -179],
    ]) {
      const viaQuaternion = upFromMatrix(quaternionToMatrix(quaternionFromDeviceOrientation(a, b, g)))
      const direct = upFromDeviceOrientation(a, b, g)
      for (let k = 0; k < 3; k++) expect(viaQuaternion[k]).toBeCloseTo(direct[k], 12)
    }
  })

  it('l’alpha non cambia il verticale letto dal telefono', () => {
    const a = upFromDeviceOrientation(0, 12, -7)
    const b = upFromDeviceOrientation(137, 12, -7)
    for (let k = 0; k < 3; k++) expect(a[k]).toBeCloseTo(b[k], 12)
  })
})
