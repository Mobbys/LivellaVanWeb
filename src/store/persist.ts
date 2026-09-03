/**
 * Modello dati e persistenza. Tutto in una sola chiave di localStorage, con
 * versione di schema e migrazione. L'export JSON è l'unico backup possibile.
 */

import { isOrthonormal, orthonormalizeRows, type Mat3 } from '../core/vec'
import { DEFAULT_VEHICLE, sanitizeVehicle, type Vehicle } from './vehicle'

export type StationQuality = 'measured' | 'transferred'

export type Station = {
  id: string
  name: string
  /** 9 elementi, row-major. */
  matrix: number[]
  createdAt: number
  /** Postazione di origine, se ottenuta per trasferimento. */
  derivedFrom: string | null
  quality: StationQuality
}

export type Units = 'cm' | 'mm'

/** Dal più chiaro al più scuro; gli ultimi due sono per la visione notturna. */
export const THEMES = ['day', 'sand', 'dusk', 'night', 'amber', 'red'] as const

export type ThemeId = (typeof THEMES)[number]

/** Chiaro all'apertura: si legge in pieno sole, che è dove si parcheggia. */
export const DEFAULT_THEME: ThemeId = 'day'

/** Il vecchio interruttore notte accendeva il rosso: si migra su quello. */
const LEGACY_NIGHT_THEME: ThemeId = 'red'

export type AppState = {
  schemaVersion: 1
  vehicle: Vehicle
  stations: Station[]
  activeStationId: string | null
  units: Units
  /** Sotto questo angolo la bolla è verde. */
  toleranceDeg: number
  /** Sotto questo angolo il beep diventa un tono continuo. */
  beepToleranceDeg: number
  theme: ThemeId
  beep: boolean
}

export const STORAGE_KEY = 'livella-camper'
export const SCHEMA_VERSION = 1
export const DEFAULT_TOLERANCE_DEG = 1

export const defaultState = (): AppState => ({
  schemaVersion: SCHEMA_VERSION,
  vehicle: { ...DEFAULT_VEHICLE },
  stations: [],
  activeStationId: null,
  units: 'cm',
  toleranceDeg: DEFAULT_TOLERANCE_DEG,
  beepToleranceDeg: DEFAULT_TOLERANCE_DEG,
  theme: DEFAULT_THEME,
  beep: false,
})

export const clampTolerance = (deg: number): number => Math.min(5, Math.max(0.1, deg))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * Una matrice corrotta non si nota a occhio ma falsa ogni misura, quindi si
 * accetta solo se è già quasi una rotazione; l'errore di arrotondamento del
 * JSON si corregge con Gram-Schmidt.
 */
function sanitizeMatrix(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== 9) return null
  if (!raw.every((value) => typeof value === 'number' && Number.isFinite(value))) return null
  const matrix = raw as unknown as Mat3
  if (!isOrthonormal(matrix, 1e-3)) return null
  return [...orthonormalizeRows(matrix)]
}

function sanitizeStation(raw: unknown): Station | null {
  if (!isRecord(raw)) return null
  const matrix = sanitizeMatrix(raw.matrix)
  if (matrix === null) return null
  const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : newId()
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : 'Postazione',
    matrix,
    createdAt: finiteOr(raw.createdAt, Date.now()),
    derivedFrom: typeof raw.derivedFrom === 'string' ? raw.derivedFrom : null,
    quality: raw.quality === 'transferred' ? 'transferred' : 'measured',
  }
}

/**
 * Porta qualunque contenuto salvato allo schema corrente. Quello che non si
 * capisce si scarta: meglio una postazione persa che una misura sbagliata.
 */
export function migrate(raw: unknown): AppState {
  const defaults = defaultState()
  if (!isRecord(raw)) return defaults

  const stations = Array.isArray(raw.stations)
    ? raw.stations.map(sanitizeStation).filter((station): station is Station => station !== null)
    : []

  const activeStationId =
    typeof raw.activeStationId === 'string' &&
    stations.some((station) => station.id === raw.activeStationId)
      ? raw.activeStationId
      : (stations[0]?.id ?? null)

  const tolerance = finiteOr(raw.toleranceDeg, DEFAULT_TOLERANCE_DEG)
  // Chi aggiorna da una versione senza questa voce si ritrova il beep come
  // l'ha sempre sentito: agganciato alla tolleranza della bolla.
  const beepTolerance = finiteOr(raw.beepToleranceDeg, tolerance)

  return {
    schemaVersion: SCHEMA_VERSION,
    vehicle: sanitizeVehicle(raw.vehicle),
    stations,
    activeStationId,
    units: raw.units === 'mm' ? 'mm' : 'cm',
    toleranceDeg: clampTolerance(tolerance),
    beepToleranceDeg: clampTolerance(beepTolerance),
    theme: sanitizeTheme(raw),
    beep: raw.beep === true,
  }
}

/**
 * Accetta un tema noto; altrimenti recupera il vecchio interruttore notte, che
 * nei salvataggi precedenti significava rosso su nero.
 */
function sanitizeTheme(raw: Record<string, unknown>): ThemeId {
  if (typeof raw.theme === 'string' && (THEMES as readonly string[]).includes(raw.theme)) {
    return raw.theme as ThemeId
  }
  return raw.nightMode === true ? LEGACY_NIGHT_THEME : DEFAULT_THEME
}

export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const exportJson = (state: AppState): string => JSON.stringify(state, null, 2)

/** Accetta solo JSON valido; il resto lo raddrizza la migrazione. */
export function importJson(text: string): AppState {
  return migrate(JSON.parse(text) as unknown)
}

export function load(): AppState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (raw === null || raw === undefined) return defaultState()
    return migrate(JSON.parse(raw) as unknown)
  } catch {
    // Storage negato o contenuto illeggibile: si riparte dai valori di default
    // invece di lasciare la app senza schermata.
    return defaultState()
  }
}

export function save(state: AppState): boolean {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
