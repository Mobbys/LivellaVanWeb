/**
 * Schermo sempre acceso. Serve durante l'uso normale e soprattutto durante il
 * trasferimento: se lo schermo si spegne, la sessione sensori si interrompe e
 * il riferimento del giroscopio si azzera.
 */

type Sentinel = {
  released: boolean
  release(): Promise<void>
  addEventListener(type: 'release', handler: () => void): void
}

type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> }

const api = (): WakeLockApi | undefined =>
  (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock

export const isWakeLockSupported = (): boolean => api() !== undefined

export class ScreenWakeLock {
  private sentinel: Sentinel | null = null
  private wanted = false

  get active(): boolean {
    return this.sentinel !== null && !this.sentinel.released
  }

  async request(): Promise<boolean> {
    this.wanted = true
    document.addEventListener('visibilitychange', this.onVisibility)
    return this.acquire()
  }

  async release(): Promise<void> {
    this.wanted = false
    document.removeEventListener('visibilitychange', this.onVisibility)
    const sentinel = this.sentinel
    this.sentinel = null
    if (sentinel !== null && !sentinel.released) await sentinel.release().catch(() => undefined)
  }

  private async acquire(): Promise<boolean> {
    const wakeLock = api()
    if (wakeLock === undefined) return false
    try {
      this.sentinel = await wakeLock.request('screen')
      return true
    } catch {
      // Batteria bassa o permesso negato: la app funziona lo stesso, lo schermo
      // si spegnerà da solo.
      return false
    }
  }

  // Tornando in primo piano il lock non si riattiva da solo.
  private onVisibility = (): void => {
    if (this.wanted && document.visibilityState === 'visible' && !this.active) void this.acquire()
  }
}
