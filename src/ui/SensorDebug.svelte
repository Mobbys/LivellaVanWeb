<script lang="ts">
  import { onDestroy } from 'svelte'
  import { StabilityDetector } from '../core/filter'
  import { attitude } from '../core/leveling'
  import { radToDeg, type Vec3 } from '../core/vec'
  import {
    createOrientationSource,
    explainSensorError,
    isSecureContextAvailable,
    needsExplicitPermission,
    requestSensorPermission,
    type OrientationSource,
    type SourceAttempt,
  } from '../sensors'

  type Status = 'idle' | 'starting' | 'running' | 'failed'

  let status = $state<Status>('idle')
  let error = $state<string | null>(null)
  let attempts = $state<SourceAttempt[]>([])
  let source: OrientationSource | null = null
  let frame = 0

  let label = $state('—')
  let quality = $state('—')
  let quaternion = $state<readonly number[] | null>(null)
  let up = $state<Vec3>([0, 0, 1])
  let samples = $state(0)
  let rate = $state(0)
  let spreadDeg = $state(Infinity)
  let stable = $state(false)

  const stability = new StabilityDetector()
  let lastCount = 0
  let lastRateAt = 0

  const angles = $derived(attitude(up))

  // Lo zero negativo, in un valore che oscilla intorno allo zero, si legge male.
  const format = (value: number, digits = 4): string => {
    const rounded = Number(value.toFixed(digits))
    return (rounded === 0 ? 0 : rounded).toFixed(digits)
  }

  async function start(): Promise<void> {
    status = 'starting'
    error = null
    try {
      if (needsExplicitPermission()) await requestSensorPermission()
      const selection = await createOrientationSource()
      source = selection.source
      attempts = selection.attempts
      label = source.label
      status = 'running'
      lastCount = 0
      lastRateAt = performance.now()
      poll()
    } catch (caught) {
      status = 'failed'
      error = explainSensorError(caught)
      attempts = (caught as { attempts?: SourceAttempt[] }).attempts ?? []
    }
  }

  function poll(): void {
    frame = requestAnimationFrame(poll)
    if (source === null) return

    up = source.up
    quaternion = source.quaternion
    quality = source.quality
    samples = source.samples

    const now = performance.now()
    // Senza letture non c'è nulla da giudicare: il verticale è solo il valore
    // di ripiego, e darlo per "fermo" nasconderebbe una sorgente muta.
    if (samples > 0) {
      stability.push(up, now / 1000)
      spreadDeg = radToDeg(stability.spread)
      stable = stability.stable
    }

    // Frequenza effettiva delle letture, misurata su un secondo.
    if (now - lastRateAt >= 1000) {
      rate = ((samples - lastCount) * 1000) / (now - lastRateAt)
      lastCount = samples
      lastRateAt = now
    }
  }

  function stop(): void {
    cancelAnimationFrame(frame)
    source?.stop()
    source = null
    stability.reset()
    status = 'idle'
  }

  onDestroy(stop)
</script>

<section>
  <h1>Debug sensori</h1>

  {#if !isSecureContextAvailable()}
    <p class="warn">
      Contesto non sicuro: la pagina è servita in HTTP. I sensori funzionano solo
      su HTTPS o su localhost.
    </p>
  {/if}

  {#if status === 'running'}
    <button onclick={stop}>Ferma</button>
  {:else}
    <button onclick={start} disabled={status === 'starting'}>
      {status === 'starting' ? 'Attivazione…' : 'Attiva sensori'}
    </button>
  {/if}

  {#if error}
    <p class="warn">{error}</p>
  {/if}

  {#if status === 'running'}
    <dl>
      <dt>Sorgente</dt>
      <dd>{label}</dd>

      <dt>Qualità</dt>
      <dd class:warn={quality === 'tilt-only'}>{quality}</dd>

      <dt>Quaternione</dt>
      <dd>
        {#if quaternion}
          [{quaternion.map((v) => format(v)).join(', ')}]
        {:else}
          non disponibile — trasferimento fra postazioni disabilitato
        {/if}
      </dd>

      <dt>up (telefono)</dt>
      <dd>[{up.map((v) => format(v, 6)).join(', ')}]</dd>

      <dt>Rollio / beccheggio</dt>
      <dd>
        {format(radToDeg(angles.roll), 2)}° / {format(radToDeg(angles.pitch), 2)}°
        <small>(postazione fittizia: matrice identità)</small>
      </dd>

      <dt>Letture</dt>
      <dd>{samples} · {format(rate, 1)} Hz</dd>

      <dt>Stabilità</dt>
      <dd class:ok={stable} class:warn={samples === 0}>
        {#if samples === 0}
          nessuna lettura ricevuta
        {:else}
          {stable ? 'ferma' : 'in movimento'} · dispersione
          {Number.isFinite(spreadDeg) ? `${format(spreadDeg, 3)}°` : '—'}
        {/if}
      </dd>
    </dl>
  {/if}

  {#if attempts.length > 0}
    <h2>Tentativi</h2>
    <ul>
      {#each attempts as attempt (attempt.id)}
        <li>{attempt.id}: {attempt.ok ? 'attiva' : attempt.reason}</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    padding: 1.5rem 1rem;
    max-width: 34rem;
    margin: 0 auto;
  }

  h1 {
    font-size: 1.375rem;
    margin: 0 0 1rem;
  }

  h2 {
    font-size: 1rem;
    margin: 1.5rem 0 0.5rem;
  }

  button {
    font: inherit;
    color: #0a0e12;
    background: #4cc9e0;
    border: 0;
    border-radius: 0.5rem;
    padding: 0.75rem 1.25rem;
  }

  dl {
    display: grid;
    /* Su schermo stretto i numeri hanno bisogno di tutta la larghezza. */
    grid-template-columns: 1fr;
    gap: 0.25rem 1rem;
    margin: 1.5rem 0 0;
  }

  @media (min-width: 34rem) {
    dl {
      grid-template-columns: max-content 1fr;
      gap: 0.75rem 1rem;
    }
  }

  dt {
    color: #8b98a5;
  }

  dt:not(:first-of-type) {
    margin-top: 0.75rem;
  }

  @media (min-width: 34rem) {
    dt:not(:first-of-type) {
      margin-top: 0;
    }
  }

  dd {
    margin: 0;
    /* Cifre tabulari: senza, i numeri ballano a ogni aggiornamento. */
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, monospace;
    overflow-wrap: anywhere;
  }

  small {
    color: #8b98a5;
  }

  .warn {
    color: #f0a830;
  }

  .ok {
    color: #3dd68c;
  }

  ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #8b98a5;
  }
</style>
