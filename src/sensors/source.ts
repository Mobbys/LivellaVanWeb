/**
 * Interfaccia unica per le sorgenti di orientamento. La UI legge le proprietà
 * quando le serve, non riceve eventi: a 50 Hz conviene disegnare al ritmo dello
 * schermo, non a quello del sensore.
 */

import type { Quat } from '../core/orientation'
import type { Vec3 } from '../core/vec'

/**
 * `full`: il quaternione è disponibile e il riferimento mondo è stabile,
 * quindi il trasferimento fra postazioni funziona.
 * `tilt-only`: si legge solo l'inclinazione, il trasferimento va disabilitato.
 */
export type SensorQuality = 'full' | 'tilt-only'

export interface OrientationSource {
  readonly id: 'generic' | 'legacy'
  /** Nome dell'API usata, per la pagina di debug. */
  readonly label: string
  start(): Promise<void>
  stop(): void
  /** Quaternione telefono→mondo, oppure null se non disponibile. */
  readonly quaternion: Quat | null
  /** Versore verticale in coordinate telefono, sempre disponibile. */
  readonly up: Vec3
  readonly quality: SensorQuality
  /** Letture ricevute dall'avvio, per capire se il flusso è vivo. */
  readonly samples: number
  /** Istante dell'ultima lettura, in millisecondi di performance.now(). */
  readonly lastReadingAt: number | null
}

export type SensorFailure =
  | 'insecure-context'
  | 'unsupported'
  | 'permission-denied'
  | 'unavailable'

export class SensorError extends Error {
  constructor(
    message: string,
    readonly reason: SensorFailure,
  ) {
    super(message)
    this.name = 'SensorError'
  }
}

/** Verticale di ripiego finché non arriva la prima lettura. */
export const DEFAULT_UP: Vec3 = [0, 0, 1]

/** Frequenza richiesta al sensore, in Hz. */
export const SAMPLE_RATE = 50
