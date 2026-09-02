/**
 * Dimensioni del camper. Internamente in metri; i moduli in cm stanno solo
 * al confine con la UI.
 */

export type Vehicle = {
  /** Carreggiata, metri. */
  trackWidth: number
  /** Passo, metri. Con doppio asse è la distanza fino al centro del tandem. */
  wheelbase: number
  rearAxles: 1 | 2
  name: string
}

export const DEFAULT_VEHICLE: Vehicle = {
  trackWidth: 2.2,
  wheelbase: 4.0,
  rearAxles: 1,
  name: 'Camper',
}

/** Limiti larghi ma non assurdi: servono a scartare gli errori di battitura. */
export const MIN_DIMENSION = 0.5
export const MAX_DIMENSION = 12

const clamp = (value: number, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, value))
}

export function sanitizeVehicle(raw: unknown): Vehicle {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_VEHICLE }
  const record = raw as Record<string, unknown>
  return {
    trackWidth: clamp(record.trackWidth as number, DEFAULT_VEHICLE.trackWidth),
    wheelbase: clamp(record.wheelbase as number, DEFAULT_VEHICLE.wheelbase),
    rearAxles: record.rearAxles === 2 ? 2 : 1,
    name:
      typeof record.name === 'string' && record.name.trim() !== ''
        ? record.name.trim()
        : DEFAULT_VEHICLE.name,
  }
}

export const metersToCm = (meters: number): number => meters * 100

export const cmToMeters = (cm: number): number => cm / 100
