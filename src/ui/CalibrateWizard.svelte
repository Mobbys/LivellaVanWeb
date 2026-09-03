<script lang="ts">
  import { CalibrationError, calibrateStation, type NoseDirection } from '../core/calibration'
  import { DEFAULT_STABILITY_THRESHOLD_DEG, averageDirection } from '../core/filter'
  import type { Mat3, Vec3 } from '../core/vec'
  import { app } from '../store/app.svelte'
  import { orientation } from '../store/orientation.svelte'

  type Props = {
    onclose: () => void
    /** Se valorizzato, la misura sostituisce quella postazione invece di crearne una. */
    stationId?: string | null
  }
  const { onclose, stationId = null }: Props = $props()

  const target = $derived(
    stationId === null ? null : app.stations.find((s) => s.id === stationId) ?? null,
  )
  let updated = $state(0)

  type Step = 'level' | 'nose' | 'measure' | 'name'

  const MEASURE_MS = 2000
  /**
   * Dopo questo tempo senza che la lettura si fermi, si offre di misurare lo
   * stesso: su certi telefoni il rumore del sensore non scende mai sotto la
   * soglia, e restare davanti a una barra che non parte non aiuta nessuno.
   */
  const PATIENCE_MS = 8000

  const NOSE_OPTIONS: { value: NoseDirection; label: string }[] = [
    { value: 'top', label: 'Bordo superiore verso il muso' },
    { value: 'bottom', label: 'Bordo superiore verso il retro' },
    { value: 'right', label: 'Bordo superiore verso destra' },
    { value: 'left', label: 'Bordo superiore verso sinistra' },
  ]

  let step = $state<Step>('level')
  let nose = $state<NoseDirection>('top')
  let progress = $state(0)
  let error = $state<string | null>(null)
  let matrix = $state<Mat3 | null>(null)
  let name = $state('Cruscotto')

  let frame = 0
  let samples: Vec3[] = []
  let startedAt = 0
  let enteredAt = 0
  let forced = $state(false)
  let waited = $state(0)

  const impatient = $derived(waited > PATIENCE_MS && !forced)

  function beginMeasure(chosen: NoseDirection): void {
    nose = chosen
    error = null
    step = 'measure'
    samples = []
    progress = 0
    forced = false
    waited = 0
    startedAt = performance.now()
    enteredAt = startedAt
    frame = requestAnimationFrame(collect)
  }

  function collect(): void {
    waited = performance.now() - enteredAt

    // La misura vale solo se il telefono resta fermo: al primo tremolio si
    // riparte da zero, invece di mediare un movimento. Con «misura comunque»
    // si accetta il rumore, che la media di 2 secondi in buona parte cancella.
    if (!orientation.stable && !forced) {
      samples = []
      startedAt = performance.now()
      progress = 0
      frame = requestAnimationFrame(collect)
      return
    }

    samples.push(orientation.raw)
    progress = Math.min(1, (performance.now() - startedAt) / MEASURE_MS)

    if (progress < 1) {
      frame = requestAnimationFrame(collect)
      return
    }

    try {
      matrix = calibrateStation(averageDirection(samples), nose)
      step = 'name'
    } catch (caught) {
      error =
        caught instanceof CalibrationError
          ? caught.message
          : 'Calibrazione non riuscita, riprova.'
      step = 'nose'
    }
  }

  function cancelMeasure(): void {
    cancelAnimationFrame(frame)
    step = 'nose'
  }

  function saveStation(): void {
    if (matrix === null) return
    if (target !== null) {
      updated = app.recalibrateStation(target.id, matrix)
      if (updated === 0) onclose()
      return
    }
    app.addStation(name, matrix, 'measured', null)
    onclose()
  }
</script>

<section>
  <header>
    <h1>{target === null ? 'Calibrazione' : `Rifai «${target.name}»`}</h1>
    <button onclick={onclose}>Annulla</button>
  </header>

  {#if error}
    <p class="warn">{error}</p>
  {/if}

  {#if step === 'level'}
    <p>
      Metti il camper in bolla con una livella a bolla vera o con i martinetti
      automatici. Questa misura vale per sempre: se il camper non è davvero in
      piano adesso, ogni misura futura sarà sbagliata della stessa quantità.
    </p>
    {#if target !== null}
      <p class="note">
        La misura sostituisce quella di «{target.name}»: nome e cronologia
        restano, quella vecchia viene buttata.
      </p>
    {/if}
    <button class="primary" onclick={() => (step = 'nose')}>Il camper è in bolla</button>
  {:else if step === 'nose'}
    <p>
      Appoggia il telefono dove vuoi misurare, poi dichiara dove punta il muso
      del camper rispetto allo schermo.
    </p>
    {#if !orientation.running}
      <button class="primary" onclick={() => orientation.start()}>Attiva sensori</button>
    {:else}
      <div class="options">
        {#each NOSE_OPTIONS as option (option.value)}
          <button onclick={() => beginMeasure(option.value)}>{option.label}</button>
        {/each}
      </div>
      <p class="note">
        Il telefono deve stare appoggiato quasi in piano: in piedi la
        calibrazione è impossibile e viene rifiutata.
      </p>
    {/if}
  {:else if step === 'measure'}
    <p>Tieni fermo, sto misurando.</p>
    <div class="bar" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
      <div class="fill" style:width="{progress * 100}%"></div>
    </div>
    <p class="note">
      {#if orientation.stable || forced}
        Lettura ferma. Non toccare il telefono.
      {:else}
        Lettura in movimento: la misura riparte quando il telefono si ferma.
      {/if}
      Oscillazione attuale {Number.isFinite(orientation.spreadDeg)
        ? orientation.spreadDeg.toLocaleString('it-IT', { maximumFractionDigits: 3 })
        : '—'}°, serve sotto {DEFAULT_STABILITY_THRESHOLD_DEG.toLocaleString('it-IT')}°.
    </p>

    {#if impatient}
      <p class="warn">
        Il telefono non si ferma abbastanza. Se è già appoggiato e immobile, è
        il rumore del suo sensore a non scendere sotto la soglia: puoi misurare
        lo stesso, la media di 2 secondi cancella gran parte del disturbo.
      </p>
      <button onclick={() => (forced = true)}>Misura comunque</button>
    {/if}

    <button onclick={cancelMeasure}>Interrompi</button>
  {:else if target !== null}
    {#if updated > 0}
      <p class="ok">
        «{target.name}» è stata rifatta. {updated === 1
          ? 'Una postazione era stata trasferita da questa ed è stata corretta con lo stesso scarto.'
          : `${updated} postazioni erano state trasferite da questa e sono state corrette con lo stesso scarto.`}
      </p>
      <button class="primary" onclick={onclose}>Ho capito</button>
    {:else}
      <p>Misura acquisita. Sostituisce la calibrazione di «{target.name}».</p>
      <button class="primary" onclick={saveStation}>Sostituisci la calibrazione</button>
    {/if}
  {:else}
    <p>Misura acquisita. Dai un nome a questa postazione.</p>
    <label for="station-name">Nome</label>
    <input id="station-name" bind:value={name} placeholder="Cruscotto" />
    <button class="primary" onclick={saveStation}>Salva postazione</button>
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

  .options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .bar {
    height: 0.75rem;
    border-radius: 999px;
    background: var(--surface);
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--accent);
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
