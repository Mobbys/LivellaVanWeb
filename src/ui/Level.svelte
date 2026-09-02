<script lang="ts">
  import { attitude } from '../core/leveling'
  import { matMulVec, radToDeg } from '../core/vec'
  import { IDENTITY_STATION, orientation } from '../store/orientation.svelte'
  import Bubble from './Bubble.svelte'

  // Postazione fittizia: finché la calibrazione non esiste, il telefono è
  // considerato già allineato al telaio.
  const upVehicle = $derived(matMulVec(IDENTITY_STATION, orientation.up))
  const angles = $derived(attitude(upVehicle))
  const rollDeg = $derived(radToDeg(angles.roll))
  const pitchDeg = $derived(radToDeg(angles.pitch))
</script>

<section>
  <header>
    <h1>Livella</h1>
    {#if orientation.running}
      <span class="hint" class:stable={orientation.stable}>
        {orientation.stable ? 'lettura ferma' : 'lettura in movimento'}
      </span>
    {/if}
  </header>

  {#if !orientation.secureContext}
    <p class="warn">
      La pagina è servita in HTTP: i sensori funzionano solo su HTTPS o su
      localhost.
    </p>
  {/if}

  {#if orientation.error}
    <p class="warn">{orientation.error}</p>
  {/if}

  <div class="bubbles">
    <Bubble
      angleDeg={rollDeg}
      axis="horizontal"
      label="Trasversale"
      live={orientation.running}
    />
    <Bubble
      angleDeg={pitchDeg}
      axis="vertical"
      label="Longitudinale"
      live={orientation.running}
    />
  </div>

  {#if !orientation.running}
    <button class="primary" onclick={() => orientation.start()}>
      {orientation.status === 'starting' ? 'Attivazione…' : 'Attiva sensori'}
    </button>
  {/if}

  <p class="note">
    Postazione fittizia: la lettura è quella grezza del telefono, non ancora
    riferita al telaio. La calibrazione arriva con le postazioni.
  </p>
</section>

<style>
  section {
    padding: 1.25rem 1rem;
    max-width: 32rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .hint {
    font-size: var(--size-xs);
    color: var(--muted);
  }

  .hint.stable {
    color: var(--ok);
  }

  .bubbles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .warn {
    color: var(--warn);
    margin: 0;
  }

  .note {
    color: var(--muted);
    font-size: var(--size-xs);
    margin: 0;
  }
</style>
