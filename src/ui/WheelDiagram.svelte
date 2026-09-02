<script lang="ts">
  /** Camper visto dall'alto, muso in su, con i centimetri su ogni ruota. */
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
</script>

<figure>
  <svg viewBox="0 0 260 240" role="img" aria-label="Rialzo per ruota, camper visto dall'alto">
    <!-- Scocca -->
    <rect x="82" y="18" width="96" height="204" rx="18" fill="var(--surface)" stroke="var(--line)" stroke-width="2" />
    <!-- Muso -->
    <path d="M108 32 L130 16 L152 32" fill="none" stroke="var(--line)" stroke-width="2" />
    <text x="130" y="52" class="axis-label" text-anchor="middle">muso</text>

    <!-- Ruote anteriori -->
    <rect x="64" y="66" width="18" height="34" rx="5" fill="var(--line)" />
    <rect x="178" y="66" width="18" height="34" rx="5" fill="var(--line)" />
    <text x="56" y="90" class="value" text-anchor="end" fill={tone('frontLeft')}>{value('frontLeft')}</text>
    <text x="204" y="90" class="value" fill={tone('frontRight')}>{value('frontRight')}</text>

    {#if vehicle.rearAxles === 2}
      <!-- Tandem: stesso rialzo su entrambe le ruote posteriori del lato. -->
      <rect x="64" y="142" width="18" height="30" rx="5" fill="var(--line)" />
      <rect x="64" y="176" width="18" height="30" rx="5" fill="var(--line)" />
      <rect x="178" y="142" width="18" height="30" rx="5" fill="var(--line)" />
      <rect x="178" y="176" width="18" height="30" rx="5" fill="var(--line)" />
      <text x="56" y="182" class="value" text-anchor="end" fill={tone('rearLeft')}>{value('rearLeft')}</text>
      <text x="204" y="182" class="value" fill={tone('rearRight')}>{value('rearRight')}</text>
    {:else}
      <rect x="64" y="154" width="18" height="34" rx="5" fill="var(--line)" />
      <rect x="178" y="154" width="18" height="34" rx="5" fill="var(--line)" />
      <text x="56" y="178" class="value" text-anchor="end" fill={tone('rearLeft')}>{value('rearLeft')}</text>
      <text x="204" y="178" class="value" fill={tone('rearRight')}>{value('rearRight')}</text>
    {/if}

    <text x="130" y="136" class="axis-label" text-anchor="middle">{unit} da alzare</text>
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
