<script lang="ts">
  import { app } from '../store/app.svelte'
  import { cmToMeters, metersToCm, sanitizeVehicle } from '../store/vehicle'

  type Props = { oncalibrate?: () => void }
  const { oncalibrate }: Props = $props()

  let name = $state(app.vehicle.name)
  let trackWidthCm = $state(Math.round(metersToCm(app.vehicle.trackWidth)))
  let wheelbaseCm = $state(Math.round(metersToCm(app.vehicle.wheelbase)))
  let rearAxles = $state<1 | 2>(app.vehicle.rearAxles)
  let saved = $state(false)

  function save(): void {
    app.setVehicle(
      sanitizeVehicle({
        name,
        trackWidth: cmToMeters(trackWidthCm),
        wheelbase: cmToMeters(wheelbaseCm),
        rearAxles,
      }),
    )
    // Rileggo dallo store: se un valore è stato riportato nei limiti, il campo
    // deve mostrare quello che è stato davvero salvato.
    trackWidthCm = Math.round(metersToCm(app.vehicle.trackWidth))
    wheelbaseCm = Math.round(metersToCm(app.vehicle.wheelbase))
    name = app.vehicle.name
    saved = true
    setTimeout(() => (saved = false), 2000)
  }
</script>

<section>
  <h1>Veicolo</h1>

  <div class="field">
    <label for="v-name">Nome</label>
    <input id="v-name" bind:value={name} />
  </div>

  <div class="field">
    <label for="v-track">Carreggiata, in cm</label>
    <input id="v-track" type="number" inputmode="numeric" min="50" max="1200" bind:value={trackWidthCm} />
    <small>Distanza fra il centro delle due ruote dello stesso asse.</small>
  </div>

  <div class="field">
    <label for="v-base">Passo, in cm</label>
    <input id="v-base" type="number" inputmode="numeric" min="50" max="1200" bind:value={wheelbaseCm} />
    <small>
      {rearAxles === 2
        ? 'Con due assi posteriori: distanza dall’asse anteriore al centro del tandem.'
        : 'Distanza fra asse anteriore e asse posteriore.'}
    </small>
  </div>

  <div class="field">
    <span class="legend">Assi posteriori</span>
    <div class="choice">
      <button class:selected={rearAxles === 1} onclick={() => (rearAxles = 1)}>Uno</button>
      <button class:selected={rearAxles === 2} onclick={() => (rearAxles = 2)}>Due</button>
    </div>
  </div>

  <button class="primary" onclick={save}>{saved ? 'Salvato' : 'Salva'}</button>

  {#if app.stations.length === 0 && oncalibrate}
    <p class="next">
      Misure a posto. Ora metti il camper in piano e calibra la prima
      postazione: è il passo che rende buone tutte le misure future.
    </p>
    <button onclick={oncalibrate}>Vai alla calibrazione</button>
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

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .legend {
    color: var(--muted);
    font-size: var(--size-xs);
  }

  small {
    color: var(--muted);
    font-size: var(--size-xs);
    line-height: 1.4;
  }

  .choice {
    display: flex;
    gap: 0.5rem;
  }

  .choice button {
    flex: 1;
  }

  .selected {
    border-color: var(--accent);
    color: var(--accent);
  }

  .next {
    margin: 0.5rem 0 0;
    color: var(--muted);
    font-size: var(--size-xs);
    line-height: 1.5;
  }
</style>
