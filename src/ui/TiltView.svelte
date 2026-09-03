<script lang="ts">
  /**
   * Il camper che si inclina, invece di una bolla astratta: visto da dietro
   * per il trasversale, di lato per il longitudinale. La linea orizzontale è
   * il riferimento, e la ruota che ci finisce sotto è quella da alzare.
   *
   * Vista da dietro il camper punta lontano da chi guarda, quindi il suo lato
   * destro resta a destra sullo schermo: stesso verso dello schema visto
   * dall'alto, che è ciò che evita di scambiare i lati.
   */
  type Props = {
    angleDeg: number
    view: 'rear' | 'side'
    label: string
    toleranceDeg?: number
    saturationDeg?: number
    live?: boolean
  }

  const {
    angleDeg,
    view,
    label,
    toleranceDeg = 1,
    saturationDeg = 5,
    live = true,
  }: Props = $props()

  /**
   * L'inclinazione vera è di pochi gradi e a schermo non si vedrebbe: il
   * disegno la amplifica. Il numero sotto resta quello misurato.
   */
  const GAIN = 5

  const clamped = $derived(Math.max(-saturationDeg, Math.min(saturationDeg, angleDeg)))
  const drawn = $derived(clamped * GAIN)
  const level = $derived(Math.abs(angleDeg) <= toleranceDeg)
  const saturated = $derived(Math.abs(angleDeg) > saturationDeg)

  const color = $derived(
    !live ? 'var(--muted)' : level ? 'var(--ok)' : saturated ? 'var(--bad)' : 'var(--warn)',
  )
  const body = $derived(live ? 'var(--text)' : 'var(--muted)')

  /**
   * Quale ruota va alzata, cioè quella che il disegno manda sotto la linea.
   * Angolo positivo significa lato destro più alto (o muso più alto): in
   * entrambe le viste il punto basso è quello disegnato a sinistra.
   */
  const lowSide = $derived(level || !live ? 'none' : angleDeg > 0 ? 'second' : 'first')

  const wheelColor = (which: 'first' | 'second'): string =>
    lowSide === which ? color : 'var(--line)'

  const text = $derived(
    angleDeg.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  )
</script>

<figure>
  <svg viewBox="0 0 120 96" role="img" aria-label="{label} {text} gradi">
    <!-- Riferimento orizzontale: è il piano, non il camper. -->
    <line
      x1="4"
      y1="74"
      x2="116"
      y2="74"
      stroke="var(--line)"
      stroke-width="2"
      stroke-dasharray="4 4"
    />

    <g transform="rotate({-drawn} 60 62)">
      {#if view === 'rear'}
        <!-- Camper visto da dietro: sinistra e destra come nello schema ruote. -->
        <rect
          x="26"
          y="20"
          width="68"
          height="42"
          rx="7"
          fill="var(--surface)"
          stroke={body}
          stroke-width="2.5"
        />
        <rect
          x="34"
          y="26"
          width="52"
          height="16"
          rx="3"
          fill="none"
          stroke="var(--line)"
          stroke-width="1.5"
        />
        <line x1="60" y1="42" x2="60" y2="58" stroke="var(--line)" stroke-width="1.5" />
        <line x1="30" y1="56" x2="90" y2="56" stroke="var(--line)" stroke-width="2" />
        <circle cx="34" cy="62" r="10" fill={wheelColor('second')} />
        <circle cx="86" cy="62" r="10" fill={wheelColor('first')} />
      {:else}
        <!-- Profilo del Ducato, muso a destra. -->
        <path
          d="M18 20 H84 L96 38 L106 42 Q110 43 110 48 V57 Q110 62 105 62 H18 Q13 62 13 57 V25
             Q13 20 18 20 Z"
          fill="var(--surface)"
          stroke={body}
          stroke-width="2.5"
          stroke-linejoin="round"
        />
        <path d="M85 24 L95 38 H85 Z" fill="none" stroke="var(--line)" stroke-width="1.5" />
        <rect
          x="24"
          y="26"
          width="30"
          height="14"
          rx="3"
          fill="none"
          stroke="var(--line)"
          stroke-width="1.5"
        />
        <circle cx="32" cy="62" r="10" fill={wheelColor('second')} />
        <circle cx="92" cy="62" r="10" fill={wheelColor('first')} />
      {/if}
    </g>
  </svg>

  <figcaption>
    <span class="value" style:color>{live ? `${text}°` : '—'}</span>
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
    max-width: 10.5rem;
    display: block;
  }

  /* Il camper è l'unica cosa che si muove: tutto il resto sta fermo. */
  g {
    transition: transform 120ms linear;
  }

  circle {
    transition: fill 200ms linear;
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
