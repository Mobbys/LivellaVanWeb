/**
 * Algebra minima per vettori e matrici 3×3. TypeScript puro, nessuna API del
 * browser. Le matrici sono row-major: [m00, m01, m02, m10, m11, m12, ...].
 */

export type Vec3 = readonly [number, number, number]

export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export const degToRad = (deg: number): number => (deg * Math.PI) / 180

export const radToDeg = (rad: number): number => (rad * 180) / Math.PI

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export const norm = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k]

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** Restituisce null se il vettore è troppo corto per avere una direzione. */
export function tryNormalize(v: Vec3, epsilon = 1e-9): Vec3 | null {
  const n = norm(v)
  return n < epsilon ? null : [v[0] / n, v[1] / n, v[2] / n]
}

export function normalize(v: Vec3, epsilon = 1e-9): Vec3 {
  const unit = tryNormalize(v, epsilon)
  if (unit === null) throw new Error('normalize: vettore di lunghezza nulla')
  return unit
}

/** Angolo fra due direzioni, in radianti. Robusto anche per angoli piccoli. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const ua = normalize(a)
  const ub = normalize(b)
  return Math.atan2(norm(cross(ua, ub)), dot(ua, ub))
}

export const identity = (): Mat3 => [1, 0, 0, 0, 1, 0, 0, 0, 1]

export const row = (m: Mat3, i: 0 | 1 | 2): Vec3 => [m[i * 3], m[i * 3 + 1], m[i * 3 + 2]]

export const matFromRows = (x: Vec3, y: Vec3, z: Vec3): Mat3 => [
  x[0],
  x[1],
  x[2],
  y[0],
  y[1],
  y[2],
  z[0],
  z[1],
  z[2],
]

export const matMulVec = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

export function matMul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]
    }
  }
  return out as unknown as Mat3
}

export const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]

export const trace = (m: Mat3): number => m[0] + m[4] + m[8]

export const determinant = (m: Mat3): number =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6])

export function isOrthonormal(m: Mat3, tolerance = 1e-9): boolean {
  if (Math.abs(determinant(m) - 1) > tolerance) return false
  const product = matMul(m, transpose(m))
  const expected = identity()
  for (let i = 0; i < 9; i++) {
    if (Math.abs(product[i] - expected[i]) > tolerance) return false
  }
  return true
}

/**
 * Gram-Schmidt sulle righe. Serve dopo ogni prodotto di matrici per impedire
 * che l'errore numerico si accumuli fino a rendere la matrice non ortonormale.
 */
export function orthonormalizeRows(m: Mat3): Mat3 {
  const x = normalize(row(m, 0))
  const yRaw = row(m, 1)
  const y = normalize(sub(yRaw, scale(x, dot(yRaw, x))))
  return matFromRows(x, y, cross(x, y))
}
