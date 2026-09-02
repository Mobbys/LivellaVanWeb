<script lang="ts">
  /**
   * Vial circolare con la bolla che si muove su un solo asse, come una livella
   * vera: la bolla va verso il lato alto. Satura a ±5°.
   */
  type Props = {
    angleDeg: number
    axis: 'horizontal' | 'vertical'
    label: string
    toleranceDeg?: number
    saturationDeg?: number
    live?: boolean
  }

  const {
    angleDeg,
    axis,
    label,
    toleranceDeg = 1,
    saturationDeg = 5,
    live = true,
  }: Props = $props()

  const R = 46
  const BUBBLE_R = 13
  const TRAVEL = R - BUBBLE_R - 2

  const clamped = $derived(Math.max(-saturationDeg, Math.min(saturationDeg, angleDeg)))
  const offset = $derived((clamped / saturationDeg) * TRAVEL)
  const level = $derived(Math.abs(angleDeg) <= toleranceDeg)
  const saturated = $derived(Math.abs(angleDeg) > saturationDeg)

  const cx = $derived(axis === 'horizontal' ? 50 + offset : 50)
  // In SVG la y cresce verso il basso: un angolo positivo alza il muso,
  // quindi la bolla deve salire.
  const cy = $derived(axis === 'vertical' ? 50 - offset : 50)

  const ticks = [1, 2, 5]
  const tickPosition = (deg: number): number => (deg / saturationDeg) * TRAVEL

  const color = $derived(level ? 'var(--ok)' : saturated ? 'var(--bad)' : 'var(--warn)')

  const text = $derived(
    angleDeg.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  )
</script>

<figure>
  <svg viewBox="0 0 100 100" role="img" aria-label="{label} {text} gradi">
    <circle cx="50" cy="50" r={R} fill="var(--surface)" stroke="var(--line)" stroke-width="2" />

    {#each ticks as tick (tick)}
      {@const d = tickPosition(tick)}
      {#if axis === 'horizontal'}
        <line x1={50 - d} y1="38" x2={50 - d} y2="62" stroke="var(--line)" stroke-width="1.5" />
        <line x1={50 + d} y1="38" x2={50 + d} y2="62" stroke="var(--line)" stroke-width="1.5" />
      {:else}
        <line x1="38" y1={50 - d} x2="62" y2={50 - d} stroke="var(--line)" stroke-width="1.5" />
        <line x1="38" y1={50 + d} x2="62" y2={50 + d} stroke="var(--line)" stroke-width="1.5" />
      {/if}
    {/each}

    <!-- Zona di tolleranza al centro: dentro questa, il camper è in bolla. -->
    {#if axis === 'horizontal'}
      <rect
        x={50 - tickPosition(toleranceDeg)}
        y={50 - BUBBLE_R - 2}
        width={tickPosition(toleranceDeg) * 2}
        height={(BUBBLE_R + 2) * 2}
        fill="none"
        stroke={level ? 'var(--ok)' : 'var(--line)'}
        stroke-width="1.5"
        rx="4"
      />
    {:else}
      <rect
        x={50 - BUBBLE_R - 2}
        y={50 - tickPosition(toleranceDeg)}
        width={(BUBBLE_R + 2) * 2}
        height={tickPosition(toleranceDeg) * 2}
        fill="none"
        stroke={level ? 'var(--ok)' : 'var(--line)'}
        stroke-width="1.5"
        rx="4"
      />
    {/if}

    <circle
      class:live
      {cx}
      {cy}
      r={BUBBLE_R}
      fill={color}
      opacity={live ? 0.9 : 0.3}
    />
  </svg>

  <figcaption>
    <span class="value" style:color={live ? color : 'var(--muted)'}>
      {live ? `${text}°` : '—'}
    </span>
    <span class="label">{label}</span>
  </figcaption>
</figure>

<style>
  figure {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  svg {
    width: 100%;
    max-width: 9.5rem;
    display: block;
  }

  /* La bolla è l'unica cosa che si muove: il resto sta fermo e zitto. */
  circle.live {
    transition:
      cx 90ms linear,
      cy 90ms linear,
      fill 200ms linear;
  }

  figcaption {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .value {
    font-size: var(--size-md);
    font-weight: 600;
  }

  .label {
    font-size: var(--size-xs);
    color: var(--muted);
  }
</style>
