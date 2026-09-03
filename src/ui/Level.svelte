<script lang="ts">
  import {
    attitude,
    axleLift,
    metersToCm,
    sideLift,
    wheelLifts,
    type Wheels,
  } from '../core/leveling'
  import { matMulVec, radToDeg } from '../core/vec'
  import { app } from '../store/app.svelte'
  import { orientation } from '../store/orientation.svelte'
  import Bubble from './Bubble.svelte'
  import WheelDiagram from './WheelDiagram.svelte'
  import { LevelBeeper } from './beep'
  import { formatDegrees, formatLift, liftValue, unitLabel } from './format'

  type Props = { oncalibrate: () => void; onvehicle: () => void }
  const { oncalibrate, onvehicle }: Props = $props()

  const matrix = $derived(app.activeMatrix)
  const upVehicle = $derived(matrix === null ? null : matMulVec(matrix, orientation.up))
  const angles = $derived(upVehicle === null ? { roll: 0, pitch: 0 } : attitude(upVehicle))
  const live = $derived(orientation.running && matrix !== null)

  const liftsMeters = $derived(
    upVehicle === null
      ? { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 }
      : wheelLifts(upVehicle, app.vehicle),
  )

  const lifts = $derived<Wheels<number>>({
    frontLeft: liftValue(liftsMeters.frontLeft, app.units),
    frontRight: liftValue(liftsMeters.frontRight, app.units),
    rearLeft: liftValue(liftsMeters.rearLeft, app.units),
    rearRight: liftValue(liftsMeters.rearRight, app.units),
  })

  const worstDeg = $derived(
    Math.max(Math.abs(radToDeg(angles.roll)), Math.abs(radToDeg(angles.pitch))),
  )

  const beeper = new LevelBeeper()

  // Il beep serve a chi è fuori con i cunei: acceso solo mentre si misura.
  $effect(() => {
    if (app.beep && live) void beeper.start()
    else beeper.stop()
    return () => beeper.stop()
  })

  $effect(() => {
    beeper.update(worstDeg, app.toleranceDeg)
  })

  const levelled = $derived(
    Math.abs(radToDeg(angles.roll)) <= app.toleranceDeg &&
      Math.abs(radToDeg(angles.pitch)) <= app.toleranceDeg,
  )

  /**
   * In piazzola si livella prima il trasversale, mettendo entrambe le ruote di
   * un lato sullo stesso cuneo: il suggerimento segue lo stesso ordine.
   */
  const advice = $derived.by((): string => {
    if (upVehicle === null || !live) return 'Attiva i sensori per misurare.'
    if (levelled) return 'Il camper è in bolla.'

    if (Math.abs(radToDeg(angles.roll)) > app.toleranceDeg) {
      const { side, lift } = sideLift(upVehicle, app.vehicle)
      const where = side === 'left' ? 'sinistro' : 'destro'
      return `Alza il lato ${where} di ${formatLift(lift, app.units)}, poi rimisura.`
    }

    const { axle, lift } = axleLift(upVehicle, app.vehicle)
    const where = axle === 'front' ? 'anteriore' : 'posteriore'
    return `Alza l’asse ${where} di ${formatLift(lift, app.units)}, poi rimisura.`
  })
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

  {#if app.stations.length === 0}
    <!-- Niente bolle finte: senza calibrazione non c'è nulla da mostrare.
         I due passi sono in quest'ordine perché le misure del camper servono
         già al primo risultato: senza, i centimetri sono di un camper generico. -->
    <div class="empty">
      <p>Due cose da fare una volta sola, in quest'ordine.</p>

      <div class="step">
        <h2><span class="num">1</span> Controlla le misure del camper</h2>
        <p>
          Carreggiata {Math.round(metersToCm(app.vehicle.trackWidth))} cm, passo
          {Math.round(metersToCm(app.vehicle.wheelbase))} cm,
          {app.vehicle.rearAxles === 2 ? 'due assi dietro' : 'un asse dietro'}.
          Se non sono le tue, i centimetri di rialzo saranno sbagliati.
        </p>
        <button onclick={onvehicle}>Correggi le misure</button>
      </div>

      <div class="step">
        <h2><span class="num">2</span> Metti il camper in piano e calibra</h2>
        <p>
          Serve una livella a bolla vera, o i martinetti. Da lì in poi basta
          appoggiare il telefono e leggere.
        </p>
        <button class="primary" onclick={oncalibrate}>Calibra la prima postazione</button>
      </div>
    </div>
  {:else}
    <label class="selector">
      <span>Postazione</span>
      <select
        value={app.activeStation?.id ?? ''}
        onchange={(event) => app.setActiveStation(event.currentTarget.value)}
      >
        {#each app.stations as station (station.id)}
          <option value={station.id}>{station.name}</option>
        {/each}
      </select>
    </label>

    <div class="bubbles">
      <Bubble
        angleDeg={radToDeg(angles.roll)}
        axis="horizontal"
        label="Trasversale"
        toleranceDeg={app.toleranceDeg}
        {live}
      />
      <Bubble
        angleDeg={radToDeg(angles.pitch)}
        axis="vertical"
        label="Longitudinale"
        toleranceDeg={app.toleranceDeg}
        {live}
      />
    </div>

    <WheelDiagram {lifts} vehicle={app.vehicle} unit={unitLabel(app.units)} {live} />

    <p class="advice" class:ok={levelled && live}>{advice}</p>

    {#if live}
      <p class="note">
        Valori in {unitLabel(app.units)}. Dopo ogni cuneo la geometria cambia:
        rimisura prima di considerarli buoni. Angoli: {formatDegrees(angles.roll)}
        trasversale, {formatDegrees(angles.pitch)} longitudinale.
      </p>
    {/if}

    {#if !orientation.running}
      <button class="primary" onclick={() => orientation.start()}>
        {orientation.status === 'starting' ? 'Attivazione…' : 'Attiva sensori'}
      </button>
    {/if}
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

  .selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
  }

  .selector span {
    color: var(--muted);
    font-size: var(--size-xs);
    flex: none;
  }

  .bubbles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .advice {
    margin: 0;
    font-size: var(--size-md);
    line-height: 1.35;
  }

  .advice.ok {
    color: var(--ok);
  }

  .empty {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty > p {
    margin: 0;
    color: var(--muted);
    line-height: 1.5;
  }

  .step {
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .step h2 {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: var(--size-sm);
  }

  .step p {
    margin: 0;
    color: var(--muted);
    font-size: var(--size-xs);
    line-height: 1.5;
  }

  .num {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    flex: none;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-accent);
    font-size: var(--size-xs);
    font-weight: 700;
  }

  .note {
    margin: 0;
    color: var(--muted);
    font-size: var(--size-xs);
    line-height: 1.5;
  }

  .warn {
    color: var(--warn);
    margin: 0;
  }
</style>
