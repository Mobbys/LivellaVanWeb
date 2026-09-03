<script lang="ts">
  /**
   * Camper visto dall'alto, muso in su, con i centimetri su ogni ruota.
   * La sagoma è quella di un furgonato su Ducato: cabina che si restringe verso
   * il muso, specchi sporgenti, cellula più larga dietro. Serve a capire a
   * colpo d'occhio quale ruota è quale, senza leggere etichette.
   */
  import { referenceWheel, type Wheels, type WheelId } from '../core/leveling'
  import type { Vehicle } from '../store/vehicle'
  import { formatNumber } from './format'

  type Props = {
    /** Rialzi già convertiti nell'unità scelta e arrotondati. */
    lifts: Wheels<number>
    vehicle: Vehicle
    /** Unità mostrata sotto i numeri: cm o mm. */
    unit: string
    live?: boolean
  }

  const { lifts, vehicle, unit, live = true }: Props = $props()

  const reference = $derived(referenceWheel(lifts))

  // La ruota di riferimento è già la più alta: un trattino dice "non toccarla",
  // uno zero si legge come una misura.
  const value = (id: WheelId): string =>
    !live ? '—' : id === reference ? '—' : formatNumber(lifts[id])

  const tone = (id: WheelId): string =>
    !live || id === reference ? 'var(--muted)' : lifts[id] === 0 ? 'var(--ok)' : 'var(--text)'

  // Con il tandem le due ruote posteriori dello stesso lato vanno alzate
  // insieme: il numero è uno solo, in mezzo alla coppia.
  const rearY = $derived(vehicle.rearAxles === 2 ? 188 : 194)
</script>

<figure>
  <svg viewBox="0 0 260 250" role="img" aria-label="Rialzo per ruota, camper visto dall'alto">
    <!-- Specchi retrovisori: il dettaglio che dice subito dov'è il muso. -->
    <g fill="var(--line)">
      <rect x="70" y="44" width="14" height="5" rx="2.5" />
      <rect x="64" y="38" width="8" height="14" rx="3" />
      <rect x="176" y="44" width="14" height="5" rx="2.5" />
      <rect x="188" y="38" width="8" height="14" rx="3" />
    </g>

    <!-- Scocca: cabina rastremata davanti, cellula piena dietro. -->
    <path
      d="M100 22 h60 a14 14 0 0 1 10 5 l8 20 a10 10 0 0 1 2 6 V226 a10 10 0 0 1 -10 10 H90
         a10 10 0 0 1 -10 -10 V53 a10 10 0 0 1 2 -6 l8 -20 a14 14 0 0 1 10 -5 z"
      fill="var(--surface)"
      stroke="var(--line)"
      stroke-width="2"
      stroke-linejoin="round"
    />

    <!-- Parabrezza inclinato. -->
    <path d="M99 30 h62 l7 18 H92 z" fill="none" stroke="var(--line)" stroke-width="1.5" />
    <text x="130" y="64" class="axis-label" text-anchor="middle">muso</text>
    <!-- Stacco fra cabina e cellula abitativa. -->
    <line x1="82" y1="70" x2="178" y2="70" stroke="var(--line)" stroke-width="1.5" />
    <!-- Oblò sul tetto. -->
    <rect
      x="112"
      y="96"
      width="36"
      height="30"
      rx="5"
      fill="none"
      stroke="var(--line)"
      stroke-width="1.5"
    />

    <!-- Ruote anteriori, infilate sotto i passaruota. -->
    <rect x="70" y="82" width="18" height="34" rx="5" fill="var(--line)" />
    <rect x="172" y="82" width="18" height="34" rx="5" fill="var(--line)" />
    <text x="60" y="106" class="value" text-anchor="end" fill={tone('frontLeft')}>
      {value('frontLeft')}
    </text>
    <text x="200" y="106" class="value" fill={tone('frontRight')}>{value('frontRight')}</text>

    {#if vehicle.rearAxles === 2}
      <rect x="70" y="150" width="18" height="28" rx="5" fill="var(--line)" />
      <rect x="70" y="182" width="18" height="28" rx="5" fill="var(--line)" />
      <rect x="172" y="150" width="18" height="28" rx="5" fill="var(--line)" />
      <rect x="172" y="182" width="18" height="28" rx="5" fill="var(--line)" />
    {:else}
      <rect x="70" y="170" width="18" height="34" rx="5" fill="var(--line)" />
      <rect x="172" y="170" width="18" height="34" rx="5" fill="var(--line)" />
    {/if}
    <text x="60" y={rearY} class="value" text-anchor="end" fill={tone('rearLeft')}>
      {value('rearLeft')}
    </text>
    <text x="200" y={rearY} class="value" fill={tone('rearRight')}>{value('rearRight')}</text>

    <text x="130" y="146" class="axis-label" text-anchor="middle">{unit} da alzare</text>
  </svg>

  {#if vehicle.rearAxles === 2}
    <figcaption>
      Doppio asse: il rialzo posteriore va messo sotto entrambe le ruote dello
      stesso lato.
    </figcaption>
  {/if}
</figure>

<style>
  figure {
    margin: 0;
  }

  svg {
    width: 100%;
    max-width: 19rem;
    margin: 0 auto;
    display: block;
  }

  .value {
    font-size: 22px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .axis-label {
    font-size: 11px;
    fill: var(--muted);
  }

  figcaption {
    color: var(--muted);
    font-size: var(--size-xs);
    text-align: center;
    margin-top: 0.5rem;
    line-height: 1.5;
  }
</style>
