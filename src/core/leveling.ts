/**
 * Angoli e rialzi a partire dal verticale in coordinate camper.
 * Assi camper: X verso destra, Y verso il muso, Z verso l'alto.
 * Unità SI: metri e radianti. La conversione a cm e gradi è compito della UI.
 */

import { normalize, type Vec3 } from './vec'

export type Vehicle = {
  /** Carreggiata, in metri. */
  trackWidth: number
  /** Passo, in metri. Con doppio asse è la distanza fino al centro del tandem. */
  wheelbase: number
  rearAxles: 1 | 2
}

export type WheelId = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight'

export type Wheels<T> = Record<WheelId, T>

export type Attitude = {
  /** Rollio, radianti. Positivo quando il lato destro è più alto. */
  roll: number
  /** Beccheggio, radianti. Positivo quando il muso è più alto. */
  pitch: number
}

export const WHEEL_IDS: readonly WheelId[] = ['frontLeft', 'frontRight', 'rearLeft', 'rearRight']

export function attitude(up: Vec3): Attitude {
  const [ux, uy, uz] = normalize(up)
  return { roll: Math.atan2(ux, uz), pitch: Math.atan2(uy, uz) }
}

/** Posizione delle ruote nel piano di appoggio, in metri. */
export function wheelPositions(vehicle: Vehicle): Wheels<readonly [number, number]> {
  const halfTrack = vehicle.trackWidth / 2
  const halfBase = vehicle.wheelbase / 2
  return {
    frontLeft: [-halfTrack, halfBase],
    frontRight: [halfTrack, halfBase],
    rearLeft: [-halfTrack, -halfBase],
    rearRight: [halfTrack, -halfBase],
  }
}

/**
 * Altezza di ciascun punto di appoggio rispetto a un piano orizzontale:
 * h = x·ux + y·uy, cioè il prodotto scalare con il versore verticale.
 */
export function wheelHeights(up: Vec3, vehicle: Vehicle): Wheels<number> {
  const [ux, uy] = normalize(up)
  const positions = wheelPositions(vehicle)
  const height = ([x, y]: readonly [number, number]): number => x * ux + y * uy
  return {
    frontLeft: height(positions.frontLeft),
    frontRight: height(positions.frontRight),
    rearLeft: height(positions.rearLeft),
    rearRight: height(positions.rearRight),
  }
}

/** Rialzo in metri per ogni ruota: con i cunei si può solo alzare. */
export function wheelLifts(up: Vec3, vehicle: Vehicle): Wheels<number> {
  const heights = wheelHeights(up, vehicle)
  const highest = Math.max(...WHEEL_IDS.map((id) => heights[id]))
  return {
    frontLeft: highest - heights.frontLeft,
    frontRight: highest - heights.frontRight,
    rearLeft: highest - heights.rearLeft,
    rearRight: highest - heights.rearRight,
  }
}

/** La ruota già più alta, quella da cui si misura tutto il resto. */
export function referenceWheel(lifts: Wheels<number>): WheelId {
  return WHEEL_IDS.reduce((best, id) => (lifts[id] < lifts[best] ? id : best), WHEEL_IDS[0])
}

/** Rialzo da mettere sotto entrambe le ruote del lato più basso: C · |ux|. */
export function sideLift(
  up: Vec3,
  vehicle: Vehicle,
): { side: 'left' | 'right' | 'none'; lift: number } {
  const [ux] = normalize(up)
  const lift = vehicle.trackWidth * Math.abs(ux)
  if (lift === 0) return { side: 'none', lift: 0 }
  return { side: ux > 0 ? 'left' : 'right', lift }
}

/** Rialzo da mettere sotto entrambe le ruote dell'asse più basso: P · |uy|. */
export function axleLift(
  up: Vec3,
  vehicle: Vehicle,
): { axle: 'front' | 'rear' | 'none'; lift: number } {
  const [, uy] = normalize(up)
  const lift = vehicle.wheelbase * Math.abs(uy)
  if (lift === 0) return { axle: 'none', lift: 0 }
  return { axle: uy > 0 ? 'rear' : 'front', lift }
}
