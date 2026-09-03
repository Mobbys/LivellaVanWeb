/**
 * Beep che accelera avvicinandosi allo zero, e tono continuo quando il camper
 * è in bolla. Serve quando si è fuori a sistemare i cunei con il telefono
 * dentro: l'orecchio basta, non serve guardare lo schermo.
 */

const TONE_HZ = 880
const LEVEL_TONE_HZ = 1320
const BURST_MS = 55
const FAST_MS = 150
const SLOW_MS = 900
/** Oltre questo angolo il ritmo non rallenta più. */
const FAR_DEG = 5

export function beepInterval(angleDeg: number, toleranceDeg: number): number {
  const span = Math.max(0.1, FAR_DEG - toleranceDeg)
  const excess = Math.min(1, Math.max(0, (Math.abs(angleDeg) - toleranceDeg) / span))
  return FAST_MS + (SLOW_MS - FAST_MS) * excess
}

type AudioContextCtor = new () => AudioContext

const contextCtor = (): AudioContextCtor | undefined =>
  ((globalThis as Record<string, unknown>).AudioContext ??
    (globalThis as Record<string, unknown>).webkitAudioContext) as AudioContextCtor | undefined

export const isAudioSupported = (): boolean => contextCtor() !== undefined

export class LevelBeeper {
  private context: AudioContext | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private steady: { oscillator: OscillatorNode; gain: GainNode } | null = null
  private angleDeg = 90
  private toleranceDeg = 1
  private running = false
  /** Cambia a ogni start/stop: una ripresa tardiva capisce di essere vecchia. */
  private session = 0

  /** Da chiamare dentro un gesto dell'utente: l'audio non parte da solo. */
  async start(): Promise<boolean> {
    if (this.running) return true
    const Ctor = contextCtor()
    if (Ctor === undefined) return false

    // running si alza subito, prima dell'attesa: due chiamate ravvicinate non
    // devono avviare due cicli paralleli che battono fuori tempo.
    this.running = true
    const session = ++this.session
    this.context ??= new Ctor()
    await this.context.resume().catch(() => undefined)
    if (session !== this.session) return false

    clearTimeout(this.timer)
    this.schedule()
    return true
  }

  stop(): void {
    this.session += 1
    this.running = false
    clearTimeout(this.timer)
    this.stopSteady()
    void this.context?.close().catch(() => undefined)
    this.context = null
  }

  update(angleDeg: number, toleranceDeg: number): void {
    this.angleDeg = angleDeg
    this.toleranceDeg = toleranceDeg
  }

  private get level(): boolean {
    return Math.abs(this.angleDeg) <= this.toleranceDeg
  }

  private schedule(): void {
    if (!this.running) return

    if (this.level) {
      // In bolla il suono diventa continuo: è il segnale di fermarsi.
      this.startSteady()
      this.timer = setTimeout(() => this.schedule(), 100)
      return
    }

    this.stopSteady()
    this.burst()
    this.timer = setTimeout(() => this.schedule(), beepInterval(this.angleDeg, this.toleranceDeg))
  }

  private burst(): void {
    const context = this.context
    if (context === null) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = TONE_HZ
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + BURST_MS / 1000)
    oscillator.connect(gain).connect(context.destination)
    // Senza scollegarli, i nodi spenti restano appesi al grafo audio fino alla
    // garbage collection: a dieci beep al secondo se ne accumulano parecchi.
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start()
    oscillator.stop(context.currentTime + BURST_MS / 1000 + 0.02)
  }

  private startSteady(): void {
    const context = this.context
    if (context === null || this.steady !== null) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = LEVEL_TONE_HZ
    gain.gain.setValueAtTime(0.12, context.currentTime)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    this.steady = { oscillator, gain }
  }

  private stopSteady(): void {
    if (this.steady === null) return
    this.steady.oscillator.stop()
    this.steady.oscillator.disconnect()
    this.steady.gain.disconnect()
    this.steady = null
  }
}
