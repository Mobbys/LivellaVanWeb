/** Creazione e denominazione delle postazioni salvate. */

import type { Mat3 } from '../core/vec'
import { newId, type Station, type StationQuality } from './persist'

export function createStation(
  name: string,
  matrix: Mat3,
  quality: StationQuality = 'measured',
  derivedFrom: string | null = null,
): Station {
  return {
    id: newId(),
    name: name.trim() === '' ? 'Postazione' : name.trim(),
    matrix: [...matrix],
    createdAt: Date.now(),
    derivedFrom,
    quality,
  }
}

/**
 * Due postazioni con lo stesso nome sono indistinguibili nel selettore, ed è
 * proprio lì che si sbaglia postazione senza accorgersene.
 */
export function uniqueName(existing: readonly Station[], wanted: string): string {
  const base = wanted.trim() === '' ? 'Postazione' : wanted.trim()
  const taken = new Set(existing.map((station) => station.name))
  if (!taken.has(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`
    if (!taken.has(candidate)) return candidate
  }
}

export const stationMatrix = (station: Station): Mat3 => station.matrix as unknown as Mat3

export const findStation = (stations: readonly Station[], id: string | null): Station | null =>
  stations.find((station) => station.id === id) ?? null
