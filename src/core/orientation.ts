/**
 * Conversioni fra le rappresentazioni dell'orientamento del telefono.
 *
 * Convenzione: `R` mappa un vettore da coordinate telefono a coordinate mondo
 * (v_mondo = R · v_telefono). Di conseguenza il verticale in coordinate
 * telefono è Rᵀ · (0,0,1), cioè la terza riga di `R`.
 */

import { matFromRows, normalize, row, type Mat3, type Vec3, degToRad } from './vec'

/** Quaternione [x, y, z, w], come lo espone la Generic Sensor API. */
export type Quat = readonly [number, number, number, number]

export function quaternionToMatrix(q: Quat): Mat3 {
  const n = Math.hypot(q[0], q[1], q[2], q[3])
  if (n < 1e-9) throw new Error('quaternionToMatrix: quaternione nullo')
  const x = q[0] / n
  const y = q[1] / n
  const z = q[2] / n
  const w = q[3] / n

  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ]
}

export function rotationFromAxisAngle(axis: Vec3, angle: number): Mat3 {
  const [x, y, z] = normalize(axis)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const t = 1 - c
  return [
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  ]
}

/** Verticale in coordinate telefono: terza riga della matrice telefono→mondo. */
export const upFromMatrix = (r: Mat3): Vec3 => row(r, 2)

export const upFromQuaternion = (q: Quat): Vec3 => upFromMatrix(quaternionToMatrix(q))

/**
 * Sequenza intrinseca Z-X'-Y'' del DeviceOrientationEvent: R = Rz(α)·Rx(β)·Ry(γ).
 * Angoli in gradi, come li consegna l'evento.
 */
export function matrixFromDeviceOrientation(alpha: number, beta: number, gamma: number): Mat3 {
  const a = degToRad(alpha)
  const b = degToRad(beta)
  const g = degToRad(gamma)
  const cA = Math.cos(a)
  const sA = Math.sin(a)
  const cB = Math.cos(b)
  const sB = Math.sin(b)
  const cG = Math.cos(g)
  const sG = Math.sin(g)

  return matFromRows(
    [cA * cG - sA * sB * sG, -cB * sA, cA * sG + cG * sA * sB],
    [cG * sA + cA * sB * sG, cA * cB, sA * sG - cA * cG * sB],
    [-cB * sG, sB, cB * cG],
  )
}

export function quaternionFromDeviceOrientation(
  alpha: number,
  beta: number,
  gamma: number,
): Quat {
  const a = degToRad(alpha) / 2
  const b = degToRad(beta) / 2
  const g = degToRad(gamma) / 2
  const cA = Math.cos(a)
  const sA = Math.sin(a)
  const cB = Math.cos(b)
  const sB = Math.sin(b)
  const cG = Math.cos(g)
  const sG = Math.sin(g)

  return [
    sB * cG * cA - cB * sG * sA,
    cB * sG * cA + sB * cG * sA,
    cB * cG * sA + sB * sG * cA,
    cB * cG * cA - sB * sG * sA,
  ]
}

export const upFromDeviceOrientation = (alpha: number, beta: number, gamma: number): Vec3 =>
  upFromMatrix(matrixFromDeviceOrientation(alpha, beta, gamma))
