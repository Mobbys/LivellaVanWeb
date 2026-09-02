/**
 * Stato reattivo della lettura corrente. Il sensore si interroga in un
 * requestAnimationFrame: si disegna al ritmo dello schermo, non a quello del
 * sensore, e il filtro riceve il dt vero fra due frame.
 */

import { StabilityDetector, UpFilter } from '../core/filter'
import { quaternionToMatrix, type Quat } from '../core/orientation'
import { identity, type Mat3, type Vec3 } from '../core/vec'
import {
  createOrientationSource,
  explainSensorError,
  isSecureContextAvailable,
  needsExplicitPermission,
  requestSensorPermission,
  type OrientationSource,
  type SensorQuality,
  type SourceAttempt,
} from '../sensors'

export type OrientationStatus = 'idle' | 'starting' | 'running' | 'failed'

class OrientationStore {
  status = $state<OrientationStatus>('idle')
  error = $state<string | null>(null)
  attempts = $state<SourceAttempt[]>([])

  /** Verticale filtrato in coordinate telefono. */
  up = $state<Vec3>([0, 0, 1])
  /** Verticale grezzo: la calibrazione media i campioni da sé. */
  raw = $state<Vec3>([0, 0, 1])
  quaternion = $state<Quat | null>(null)
  quality = $state<SensorQuality>('tilt-only')
  stable = $state(false)
  samples = $state(0)
  sourceLabel = $state('—')

  private source: OrientationSource | null = null
  private frame = 0
  private lastFrameAt = 0
  private readonly filter = new UpFilter()
  private readonly stability = new StabilityDetector()

  get running(): boolean {
    return this.status === 'running'
  }

  /** Il trasferimento fra postazioni ha bisogno del riferimento assoluto. */
  get canTransfer(): boolean {
    return this.running && this.quality === 'full' && this.quaternion !== null
  }

  get secureContext(): boolean {
    return isSecureContextAvailable()
  }

  /** Matrice telefono→mondo dell'istante corrente, per il trasferimento. */
  matrix(): Mat3 | null {
    return this.quaternion === null ? null : quaternionToMatrix(this.quaternion)
  }

  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') return
    this.status = 'starting'
    this.error = null
    try {
      if (needsExplicitPermission()) await requestSensorPermission()
      const selection = await createOrientationSource()
      this.source = selection.source
      this.attempts = selection.attempts
      this.sourceLabel = selection.source.label
      this.status = 'running'
      this.lastFrameAt = performance.now()
      this.filter.reset()
      this.stability.reset()
      this.tick()
    } catch (caught) {
      this.status = 'failed'
      this.error = explainSensorError(caught)
      this.attempts = (caught as { attempts?: SourceAttempt[] }).attempts ?? []
    }
  }

  stop(): void {
    cancelAnimationFrame(this.frame)
    this.source?.stop()
    this.source = null
    this.status = 'idle'
    this.filter.reset()
    this.stability.reset()
  }

  private tick = (): void => {
    this.frame = requestAnimationFrame(this.tick)
    const source = this.source
    if (source === null) return

    const now = performance.now()
    const dt = (now - this.lastFrameAt) / 1000
    this.lastFrameAt = now

    this.samples = source.samples
    if (source.samples === 0) return

    this.raw = source.up
    this.up = this.filter.update(source.up, dt)
    this.quaternion = source.quaternion
    this.quality = source.quality

    this.stability.push(source.up, now / 1000)
    this.stable = this.stability.stable
  }

  /** Media della finestra ferma: è la lettura che si salva in calibrazione. */
  averageUp(): Vec3 {
    return this.stability.average()
  }
}

export const orientation = new OrientationStore()

/** Verticale in coordinate camper con la postazione fittizia (identità). */
export const IDENTITY_STATION: Mat3 = identity()
