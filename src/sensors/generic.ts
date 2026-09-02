/**
 * Sorgente primaria: RelativeOrientationSensor della Generic Sensor API.
 * Relativa e non assoluta di proposito: l'assoluta usa il magnetometro, che
 * dentro una scocca di alluminio con inverter e pannelli non è affidabile.
 */

import { upFromQuaternion, type Quat } from '../core/orientation'
import type { Vec3 } from '../core/vec'
import {
  DEFAULT_UP,
  SAMPLE_RATE,
  SensorError,
  type OrientationSource,
  type SensorQuality,
} from './source'

type SensorReadingEvent = Event & { error?: DOMException }

interface RelativeOrientationSensorLike {
  quaternion: number[] | null
  start(): void
  stop(): void
  addEventListener(type: string, handler: (event: SensorReadingEvent) => void): void
  removeEventListener(type: string, handler: (event: SensorReadingEvent) => void): void
}

type SensorConstructor = new (options: {
  frequency?: number
  referenceFrame?: 'device' | 'screen'
}) => RelativeOrientationSensorLike

/** Oltre questo tempo senza letture il sensore esiste ma non produce dati. */
const ACTIVATION_TIMEOUT_MS = 3000

const constructor = (): SensorConstructor | undefined =>
  (globalThis as Record<string, unknown>).RelativeOrientationSensor as SensorConstructor | undefined

/**
 * I permessi di accelerometro e giroscopio su Android sono concessi per
 * impostazione predefinita: si interroga solo per intercettare un diniego
 * esplicito, senza mostrare nulla all'utente.
 */
async function assertPermissions(): Promise<void> {
  if (!navigator.permissions?.query) return
  for (const name of ['accelerometer', 'gyroscope']) {
    try {
      const status = await navigator.permissions.query({ name: name as PermissionName })
      if (status.state === 'denied') {
        throw new SensorError(`Permesso negato per ${name}.`, 'permission-denied')
      }
    } catch (error) {
      // Un browser che non conosce il nome del permesso non è un diniego.
      if (error instanceof SensorError) throw error
    }
  }
}

export class GenericOrientationSource implements OrientationSource {
  readonly id = 'generic' as const
  readonly label = 'RelativeOrientationSensor'
  readonly quality: SensorQuality = 'full'

  private sensor: RelativeOrientationSensorLike | null = null
  private currentQuaternion: Quat | null = null
  private currentUp: Vec3 = DEFAULT_UP
  private count = 0
  private lastAt: number | null = null

  static isSupported(): boolean {
    return constructor() !== undefined
  }

  get quaternion(): Quat | null {
    return this.currentQuaternion
  }

  get up(): Vec3 {
    return this.currentUp
  }

  get samples(): number {
    return this.count
  }

  get lastReadingAt(): number | null {
    return this.lastAt
  }

  async start(): Promise<void> {
    const Ctor = constructor()
    if (Ctor === undefined) {
      throw new SensorError('Generic Sensor API non disponibile.', 'unsupported')
    }
    await assertPermissions()

    // referenceFrame 'device': gli assi restano quelli del telefono anche se
    // lo schermo ruota, e la matrice di postazione assorbe l'offset fisso.
    const sensor = new Ctor({ frequency: SAMPLE_RATE, referenceFrame: 'device' })
    this.sensor = sensor

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        this.stop()
        reject(new SensorError('Il sensore non produce letture.', 'unavailable'))
      }, ACTIVATION_TIMEOUT_MS)

      const onReading = (): void => {
        this.read()
        cleanup()
        resolve()
      }

      const onError = (event: SensorReadingEvent): void => {
        cleanup()
        this.stop()
        reject(toSensorError(event.error))
      }

      const cleanup = (): void => {
        clearTimeout(timeout)
        sensor.removeEventListener('reading', onReading)
        sensor.removeEventListener('error', onError)
      }

      sensor.addEventListener('reading', onReading)
      sensor.addEventListener('error', onError)
      sensor.start()
    })

    sensor.addEventListener('reading', this.onReading)
  }

  stop(): void {
    if (this.sensor === null) return
    this.sensor.removeEventListener('reading', this.onReading)
    this.sensor.stop()
    this.sensor = null
  }

  private onReading = (): void => this.read()

  private read(): void {
    const q = this.sensor?.quaternion
    if (!q || q.length !== 4) return
    const quat: Quat = [q[0], q[1], q[2], q[3]]
    this.currentQuaternion = quat
    this.currentUp = upFromQuaternion(quat)
    this.count += 1
    this.lastAt = performance.now()
  }
}

function toSensorError(error: DOMException | undefined): SensorError {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new SensorError('Accesso ai sensori bloccato dal browser.', 'permission-denied')
    default:
      return new SensorError(error?.message ?? 'Sensore non disponibile.', 'unavailable')
  }
}
