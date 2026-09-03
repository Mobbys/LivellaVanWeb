<script lang="ts">
  /**
   * Trasferimento fra postazioni: M_new = M_old · R₀ᵀ · R₁.
   * Il camper deve restare fermo, ma non serve che sia in bolla.
   */
  import { onDestroy } from 'svelte'
  import {
    TRANSFER_TIMEOUT_MS,
    matrixDifferenceAngle,
    transferAgrees,
    transferStation,
  } from '../core/calibration'
  import { radToDeg, type Mat3 } from '../core/vec'
  import { ScreenWakeLock } from '../sensors/wakelock'
  import { app } from '../store/app.svelte'
  import { orientation } from '../store/orientation.svelte'
  import { stationMatrix } from '../store/stations'

  type Props = { onclose: () => void }
  const { onclose }: Props = $props()

  type Step = 'intro' | 'moving' | 'result'

  let step = $state<Step>('intro')
  let sourceId = $state(app.activeStation?.id ?? app.stations[0]?.id ?? '')
  let name = $state('Tavolo dinette')
  let error = $state<string | null>(null)
  let elapsed = $state(0)
  let result = $state<Mat3 | null>(null)
  /** Esito del secondo trasferimento, quello di verifica. */
  let differenceDeg = $state<number | null>(null)
  let agreed = $state(false)
  let verifying = $state(false)

  let r0: Mat3 | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  const wakeLock = new ScreenWakeLock()

  const source = $derived(app.stations.find((station) => station.id === sourceId) ?? null)
  const remaining = $derived(Math.max(0, Math.ceil((TRANSFER_TIMEOUT_MS - elapsed) / 1000)))

  function abort(message: string): void {
    clearInterval(timer)
    void wakeLock.release()
    document.removeEventListener('visibilitychange', onHidden)
    r0 = null
    error = message
    step = 'intro'
    verifying = false
  }

  /**
   * Con lo schermo nascosto il sensore relativo si ferma e riparte da un
   * riferimento nuovo: R₀ non varrebbe più niente, quindi si annulla.
   */
  const onHidden = (): void => {
    if (document.visibilityState === 'hidden') {
      abort('Lo schermo si è spento o hai cambiato applicazione: il riferimento è perso, rifai il trasferimento.')
    }
  }

  async function begin(second: boolean): Promise<void> {
    error = null
    verifying = second
    const matrix = orientation.matrix()
    if (matrix === null || !orientation.canTransfer) {
      error = 'Senza riferimento assoluto il trasferimento non è possibile.'
      return
    }
    r0 = matrix
    elapsed = 0
    step = 'moving'
    await wakeLock.request()
    document.addEventListener('visibilitychange', onHidden)
    const startedAt = performance.now()
    timer = setInterval(() => {
      elapsed = performance.now() - startedAt
      if (elapsed >= TRANSFER_TIMEOUT_MS) {
        // Oltre il minuto e mezzo la deriva del giroscopio non è trascurabile.
        abort('Trasferimento annullato: ci hai messo più di 90 secondi. Rifallo più in fretta.')
      }
    }, 200)
  }

  function confirm(): void {
    const r1 = orientation.matrix()
    if (r0 === null || r1 === null) {
      abort('Riferimento perso durante lo spostamento. Rifai il trasferimento.')
      return
    }
    if (source === null) {
      abort('La postazione di partenza non esiste più.')
      return
    }

    clearInterval(timer)
    document.removeEventListener('visibilitychange', onHidden)
    void wakeLock.release()

    const transferred = transferStation(stationMatrix(source), r0, r1)
    if (verifying && result !== null) {
      const first = result
      differenceDeg = radToDeg(matrixDifferenceAngle(first, transferred))
      agreed = transferAgrees(first, transferred)
      // La seconda misura è buona quanto la prima: si tiene quella.
      result = transferred
    } else {
      result = transferred
      differenceDeg = null
      agreed = false
    }
    r0 = null
    verifying = false
    step = 'result'
  }

  /**
   * Il pulsante Annulla in testata smonta il componente senza passare da
   * abort(): senza questo resterebbero accesi il timer, l'ascoltatore di
   * visibilità e soprattutto il wake lock, che tiene lo schermo acceso.
   */
  onDestroy(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onHidden)
    void wakeLock.release()
  })

  function save(): void {
    if (result === null || source === null) return
    app.addStation(name, result, 'transferred', source.id)
    onclose()
  }
</script>

<section>
  <header>
    <h1>Trasferimento</h1>
    <button onclick={onclose}>Annulla</button>
  </header>

  {#if error}
    <p class="warn">{error}</p>
  {/if}

  {#if !orientation.canTransfer}
    <p class="warn">
      Questo telefono non fornisce un riferimento assoluto stabile: senza
      quello il trasferimento non funziona. Calibra la nuova postazione con il
      camper in bolla.
    </p>
    <button onclick={onclose}>Torna indietro</button>
  {:else if step === 'intro'}
    <p class="alert">
      Non uscire dal camper e non far salire nessuno finché non hai finito. Il
      camper deve restare fermo, ma non serve che sia in bolla.
    </p>

    <div class="field">
      <label for="source">Parti da questa postazione</label>
      <select id="source" bind:value={sourceId}>
        {#each app.stations as station (station.id)}
          <option value={station.id}>{station.name}</option>
        {/each}
      </select>
    </div>

    <p class="note">
      Appoggia il telefono nella postazione di partenza, premi inizia, poi
      spostalo nella nuova posizione senza spegnere lo schermo. Hai 90 secondi.
    </p>

    <button class="primary" onclick={() => begin(false)} disabled={source === null}>
      Inizia dalla postazione «{source?.name ?? '—'}»
    </button>
  {:else if step === 'moving'}
    <p class="alert">Sposta il telefono nella nuova posizione. Non spegnere lo schermo.</p>
    <p class="countdown" class:urgent={remaining <= 20}>{remaining} s</p>
    <button class="primary" onclick={confirm}>Sono in posizione, conferma</button>
    <button onclick={() => abort('Trasferimento annullato.')}>Annulla</button>
  {:else}
    <p>Trasferimento riuscito.</p>

    {#if differenceDeg !== null}
      {#if agreed}
        <p class="ok">
          Verifica superata: le due misure differiscono di
          {differenceDeg.toLocaleString('it-IT', { maximumFractionDigits: 2 })}°.
        </p>
      {:else}
        <p class="warn">
          Le due misure differiscono di
          {differenceDeg.toLocaleString('it-IT', { maximumFractionDigits: 2 })}°,
          più del mezzo grado ammesso: questa calibrazione è poco affidabile.
          Rifalla senza camminare dentro il camper.
        </p>
      {/if}
    {:else}
      <p class="note">
        Conviene ripetere il trasferimento una seconda volta: se le due misure
        coincidono, la postazione è affidabile. Prima riporta il telefono sulla
        postazione «{source?.name ?? '—'}», poi premi il pulsante: la seconda
        misura parte da lì, non da dove si trova adesso.
      </p>
      <button onclick={() => begin(true)}>
        Ho rimesso il telefono in partenza, ripeti
      </button>
    {/if}

    <div class="field">
      <label for="transfer-name">Nome della nuova postazione</label>
      <input id="transfer-name" bind:value={name} />
    </div>

    <button class="primary" onclick={save}>Salva postazione</button>
  {/if}
</section>

<style>
  section {
    padding: 1.25rem 1rem;
    max-width: 32rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  p {
    margin: 0;
    line-height: 1.5;
  }

  .alert {
    font-size: var(--size-md);
  }

  .countdown {
    font-size: var(--size-xl);
    font-weight: 600;
    text-align: center;
  }

  .countdown.urgent {
    color: var(--warn);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .note {
    color: var(--muted);
    font-size: var(--size-xs);
  }

  .warn {
    color: var(--warn);
  }

  .ok {
    color: var(--ok);
  }
</style>
