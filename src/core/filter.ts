/**
 * Filtraggio del versore verticale e rilevamento della stabilità.
 * Gli istanti sono in secondi, gli angoli in radianti.
 */

import { add, angleBetween, degToRad, normalize, scale, sub, type Vec3 } from './vec'

export const DEFAULT_TIME_CONSTANT = 0.8
export const DEFAULT_STABILITY_WINDOW = 1
export const DEFAULT_STABILITY_THRESHOLD_DEG = 0.05
/** Durata della media che precede il salvataggio di una calibrazione. */
export const CALIBRATION_AVERAGE_SECONDS = 2

/**
 * Media esponenziale con rinormalizzazione a ogni passo: senza di essa la
 * combinazione lineare di due versori accorcia il risultato.
 */
export class UpFilter {
  private current: Vec3 | null = null

  constructor(private readonly timeConstant: number = DEFAULT_TIME_CONSTANT) {
    if (timeConstant <= 0) throw new Error('UpFilter: costante di tempo non positiva')
  }

  get value(): Vec3 | null {
    return this.current
  }

  reset(): void {
    this.current = null
  }

  update(sample: Vec3, dt: number): Vec3 {
    const unit = normalize(sample)
    if (this.current === null || dt <= 0) {
      this.current = unit
      return this.current
    }
    const alpha = 1 - Math.exp(-dt / this.timeConstant)
    this.current = normalize(add(this.current, scale(sub(unit, this.current), alpha)))
    return this.current
  }
}

/** Media di una finestra di letture, rinormalizzata. */
export function averageDirection(samples: readonly Vec3[]): Vec3 {
  if (samples.length === 0) throw new Error('averageDirection: nessun campione')
  let sum: Vec3 = [0, 0, 0]
  for (const sample of samples) sum = add(sum, normalize(sample))
  return normalize(sum)
}

type StabilityOptions = {
  /** Ampiezza della finestra di osservazione, in secondi. */
  window?: number
  /** Soglia di dispersione sotto la quale la lettura è considerata ferma. */
  thresholdDeg?: number
}

/**
 * Dispersione angolare del verticale su una finestra scorrevole. Finché la
 * finestra non è piena la risposta è "non lo so", non "fermo": è la condizione
 * che abilita il pulsante di calibrazione.
 */
export class StabilityDetector {
  private readonly window: number
  private readonly threshold: number
  private samples: { up: Vec3; time: number }[] = []

  constructor(options: StabilityOptions = {}) {
    this.window = options.window ?? DEFAULT_STABILITY_WINDOW
    this.threshold = degToRad(options.thresholdDeg ?? DEFAULT_STABILITY_THRESHOLD_DEG)
  }

  reset(): void {
    this.samples = []
  }

  push(sample: Vec3, time: number): void {
    this.samples.push({ up: normalize(sample), time })
    const cutoff = time - this.window
    while (this.samples.length > 0 && this.samples[0].time < cutoff) this.samples.shift()
  }

  /** La finestra copre abbastanza tempo perché il giudizio abbia senso. */
  get ready(): boolean {
    if (this.samples.length < 2) return false
    const span = this.samples[this.samples.length - 1].time - this.samples[0].time
    return span >= this.window * 0.9
  }

  /** Deviazione angolare quadratica media rispetto alla direzione media. */
  get spread(): number {
    if (this.samples.length < 2) return Infinity
    const mean = averageDirection(this.samples.map((s) => s.up))
    const sumSquares = this.samples.reduce((acc, s) => acc + angleBetween(mean, s.up) ** 2, 0)
    return Math.sqrt(sumSquares / this.samples.length)
  }

  get stable(): boolean {
    return this.ready && this.spread < this.threshold
  }

  /** Media della finestra corrente, da usare come lettura di calibrazione. */
  average(): Vec3 {
    return averageDirection(this.samples.map((s) => s.up))
  }
}
