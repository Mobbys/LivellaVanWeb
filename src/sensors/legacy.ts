/**
 * Fallback: DeviceOrientationEvent con alpha/beta/gamma. L'inclinazione è
 * sempre buona; l'azimut no, e da questo dipende la qualità dichiarata.
 */

import { AngleDriftMonitor, StabilityDetector } from '../core/filter'
import {
  quaternionFromDeviceOrientation,
  upFromDeviceOrientation,
  type Quat,
} from '../core/orientation'
import type { Vec3 } from '../core/vec'
import {
  DEFAULT_UP,
  SensorError,
  type OrientationSource,
  type SensorQuality,
} from './source'

/** Oltre questo tempo senza eventi la sorgente non è utilizzabile. */
const ACTIVATION_TIMEOUT_MS = 3000

type PermissionRequest = () => Promise<'granted' | 'denied' | 'prompt'>

type DeviceOrientationConstructor = {
  requestPermission?: PermissionRequest
}

const deviceOrientation = (): DeviceOrientationConstructor | undefined =>
  (globalThis as Record<string, unknown>).DeviceOrientationEvent as
    | DeviceOrientationConstructor
    | undefined

/** iOS chiede il permesso, e solo dentro un handler di click. */
export const needsExplicitPermission = (): boolean =>
  typeof deviceOrientation()?.requestPermission === 'function'

export async function requestLegacyPermission(): Promise<void> {
  const request = deviceOrientation()?.requestPermission
  if (typeof request !== 'function') return
  const state = await request()
  if (state !== 'granted') {
    throw new SensorError('Permesso sui sensori di movimento negato.', 'permission-denied')
  }
}

export class LegacyOrientationSource implements OrientationSource {
  readonly id = 'legacy' as const
  readonly label = 'DeviceOrientationEvent'

  private currentQuaternion: Quat | null = null
  private currentUp: Vec3 = DEFAULT_UP
  private count = 0
  private lastAt: number | null = null
  private absolute = false
  private hasAzimuth = false
  private startedAt = 0

  // L'alpha è affidabile solo se non deriva mentre il telefono è fermo:
  // le due finestre insieme distinguono la deriva dal movimento della mano.
  private readonly tilt = new StabilityDetector({ window: 2, thresholdDeg: 0.5 })
  private readonly azimuth = new AngleDriftMonitor({ window: 2 })

  static isSupported(): boolean {
    return deviceOrientation() !== undefined
  }

  get quaternion(): Quat | null {
    return this.quality === 'full' ? this.currentQuaternion : null
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

  get quality(): SensorQuality {
    if (!this.hasAzimuth) return 'tilt-only'
    if (this.absolute) return 'full'
    // Alpha relativo: si degrada solo se deriva mentre il telefono è fermo.
    return this.tilt.stable && this.azimuth.drifting ? 'tilt-only' : 'full'
  }

  async start(): Promise<void> {
    if (!LegacyOrientationSource.isSupported()) {
      throw new SensorError('DeviceOrientationEvent non disponibile.', 'unsupported')
    }
    await requestLegacyPermission()

    this.startedAt = performance.now()
    window.addEventListener('deviceorientation', this.onEvent)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('deviceorientation', firstEvent)
        this.stop()
        reject(
          new SensorError(
            'Nessuna lettura di inclinazione: il browser espone l’evento ma non i dati.',
            'unavailable',
          ),
        )
      }, ACTIVATION_TIMEOUT_MS)

      // Un evento con beta e gamma nulli non è una lettura: alcuni browser lo
      // emettono comunque, e prenderlo per buono farebbe partire una livella cieca.
      const firstEvent = (event: DeviceOrientationEvent): void => {
        if (event.beta === null || event.gamma === null) return
        clearTimeout(timeout)
        window.removeEventListener('deviceorientation', firstEvent)
        resolve()
      }

      window.addEventListener('deviceorientation', firstEvent)
    })
  }

  stop(): void {
    window.removeEventListener('deviceorientation', this.onEvent)
    this.tilt.reset()
    this.azimuth.reset()
  }

  private onEvent = (event: DeviceOrientationEvent): void => {
    const { alpha, beta, gamma } = event
    if (beta === null || gamma === null) return

    const seconds = (performance.now() - this.startedAt) / 1000
    this.currentUp = upFromDeviceOrientation(alpha ?? 0, beta, gamma)
    this.tilt.push(this.currentUp, seconds)

    this.hasAzimuth = alpha !== null
    this.absolute = event.absolute === true
    if (alpha !== null) {
      this.currentQuaternion = quaternionFromDeviceOrientation(alpha, beta, gamma)
      this.azimuth.push(alpha, seconds)
    } else {
      this.currentQuaternion = null
    }

    this.count += 1
    this.lastAt = performance.now()
  }
}
