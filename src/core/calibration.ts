/**
 * Matrice di postazione `M`: u_c = M · u_p, cioè la rotazione costante che
 * porta il verticale letto in coordinate telefono a coordinate camper.
 * Dipende solo da come il telefono è appoggiato sul telaio.
 */

import {
  cross,
  degToRad,
  dot,
  matFromRows,
  matMul,
  matMulVec,
  normalize,
  orthonormalizeRows,
  scale,
  sub,
  trace,
  transpose,
  tryNormalize,
  type Mat3,
  type Vec3,
} from './vec'

/** Dove punta il muso del camper, visto dal telefono appoggiato. */
export type NoseDirection = 'top' | 'bottom' | 'right' | 'left'

/** Direzione del muso in coordinate telefono, per ciascuna scelta dell'utente. */
export const NOSE_VECTORS: Readonly<Record<NoseDirection, Vec3>> = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  right: [-1, 0, 0],
  left: [1, 0, 0],
}

/**
 * Oltre questo valore la direzione del muso è quasi parallela al verticale e
 * la proiezione di Gram-Schmidt degenera: il telefono è appoggiato in piedi.
 */
export const DEGENERACY_LIMIT = 0.98

/** Oltre questo tempo la deriva del giroscopio invalida il trasferimento. */
export const TRANSFER_TIMEOUT_MS = 90_000

/** Scarto massimo fra due trasferimenti ripetuti perché siano attendibili. */
export const TRANSFER_AGREEMENT_LIMIT = degToRad(0.5)

export class CalibrationError extends Error {
  constructor(
    message: string,
    readonly code: 'degenerate' | 'no-direction',
  ) {
    super(message)
    this.name = 'CalibrationError'
  }
}

/**
 * Prima calibrazione, con il camper effettivamente in bolla.
 * Le righe di `M` sono gli assi del camper espressi in coordinate telefono.
 */
export function calibrateStation(upPhone: Vec3, nose: NoseDirection): Mat3 {
  const z = tryNormalize(upPhone)
  if (z === null) {
    throw new CalibrationError('Lettura del verticale non valida.', 'no-direction')
  }

  const f = NOSE_VECTORS[nose]
  if (Math.abs(dot(f, z)) > DEGENERACY_LIMIT) {
    throw new CalibrationError(
      'Il telefono è troppo verticale: appoggialo più in piano.',
      'degenerate',
    )
  }

  // Sotto la soglia di degenerazione la proiezione è lunga almeno 0,19: non collassa.
  const y = normalize(sub(f, scale(z, dot(f, z))))
  return matFromRows(cross(y, z), y, z)
}

/** Sposta la calibrazione su una nuova postazione: M_new = M_old · R₀ᵀ · R₁. */
export function transferStation(mOld: Mat3, r0: Mat3, r1: Mat3): Mat3 {
  return orthonormalizeRows(matMul(mOld, matMul(transpose(r0), r1)))
}

/** Verticale in coordinate camper. */
export const upInVehicle = (m: Mat3, upPhone: Vec3): Vec3 => matMulVec(m, upPhone)

/** Angolo della rotazione che separa due matrici di postazione, in radianti. */
export function matrixDifferenceAngle(a: Mat3, b: Mat3): number {
  const cos = (trace(matMul(a, transpose(b))) - 1) / 2
  return Math.acos(Math.min(1, Math.max(-1, cos)))
}

/** Due trasferimenti ripetuti concordano abbastanza da fidarsi del risultato. */
export const transferAgrees = (a: Mat3, b: Mat3): boolean =>
  matrixDifferenceAngle(a, b) <= TRANSFER_AGREEMENT_LIMIT

/**
 * Correzione che porta una vecchia calibrazione sulla nuova: C = M_new · M_oldᵀ.
 * Serve a rifare una postazione senza perdere quelle che ne discendono.
 */
export const calibrationCorrection = (mOld: Mat3, mNew: Mat3): Mat3 =>
  orthonormalizeRows(matMul(mNew, transpose(mOld)))

/**
 * Applica la correzione a una postazione. Su una postazione trasferita
 * M = M_origine · T, dove T è il fatto fisico dei due appoggi: moltiplicando a
 * sinistra, T resta intatto e la discendente segue l'origine corretta.
 */
export const applyCorrection = (correction: Mat3, m: Mat3): Mat3 =>
  orthonormalizeRows(matMul(correction, m))
