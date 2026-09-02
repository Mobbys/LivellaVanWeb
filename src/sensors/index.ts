/**
 * Scelta automatica della sorgente e gestione del permesso iOS.
 * Ordine: Generic Sensor API, poi DeviceOrientationEvent.
 */

import { GenericOrientationSource } from './generic'
import { LegacyOrientationSource, needsExplicitPermission, requestLegacyPermission } from './legacy'
import { SensorError, type OrientationSource } from './source'

export { GenericOrientationSource } from './generic'
export { LegacyOrientationSource, needsExplicitPermission } from './legacy'
export * from './source'

/**
 * Fuori da un contesto sicuro i sensori non partono. È la causa più probabile
 * di malfunzionamento durante lo sviluppo, quindi va detta per prima.
 */
export const isSecureContextAvailable = (): boolean => globalThis.isSecureContext === true

/** Da chiamare dentro un handler di click: su iOS il permesso lo richiede. */
export async function requestSensorPermission(): Promise<void> {
  await requestLegacyPermission()
}

export type SourceAttempt = {
  id: 'generic' | 'legacy'
  ok: boolean
  reason?: string
}

export type SourceSelection = {
  source: OrientationSource
  /** Cosa è stato provato e perché è stato scartato: serve al debug. */
  attempts: SourceAttempt[]
}

/**
 * Prova le sorgenti in ordine di preferenza. Il primo avvio riuscito vince,
 * gli errori degli altri tentativi restano a disposizione della UI.
 */
export async function createOrientationSource(): Promise<SourceSelection> {
  if (!isSecureContextAvailable()) {
    throw new SensorError(
      'La pagina non è in contesto sicuro: servono HTTPS o localhost.',
      'insecure-context',
    )
  }

  const candidates: OrientationSource[] = []
  if (GenericOrientationSource.isSupported()) candidates.push(new GenericOrientationSource())
  if (LegacyOrientationSource.isSupported()) candidates.push(new LegacyOrientationSource())

  if (candidates.length === 0) {
    throw new SensorError(
      'Questo browser non espone né la Generic Sensor API né DeviceOrientationEvent.',
      'unsupported',
    )
  }

  const attempts: SourceAttempt[] = []
  let lastError: SensorError | null = null

  for (const candidate of candidates) {
    try {
      await candidate.start()
      attempts.push({ id: candidate.id, ok: true })
      return { source: candidate, attempts }
    } catch (error) {
      const sensorError =
        error instanceof SensorError
          ? error
          : new SensorError(String((error as Error)?.message ?? error), 'unavailable')
      attempts.push({ id: candidate.id, ok: false, reason: sensorError.message })
      lastError = sensorError
    }
  }

  throw Object.assign(lastError ?? new SensorError('Sensori non disponibili.', 'unavailable'), {
    attempts,
  })
}

/** Messaggio da mostrare all'utente, senza scuse generiche. */
export function explainSensorError(error: unknown): string {
  if (!(error instanceof SensorError)) {
    return 'Errore inatteso nella lettura dei sensori.'
  }
  switch (error.reason) {
    case 'insecure-context':
      return 'La pagina è servita in HTTP: i sensori funzionano solo su HTTPS o localhost.'
    case 'unsupported':
      return 'Questo browser non espone i sensori di orientamento. Prova con Chrome su Android o Safari su iOS.'
    case 'permission-denied':
      return needsExplicitPermission()
        ? 'Permesso sui sensori negato. Ricarica la pagina e tocca "Attiva sensori".'
        : 'Il browser ha bloccato l’accesso ai sensori. Controlla i permessi del sito.'
    case 'unavailable':
      return `Il sensore non risponde: ${error.message}`
  }
}
