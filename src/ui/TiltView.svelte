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
  <!--
    Le due viste condividono la stessa scala in altezza: il camper è alto 40
    unità in entrambe. Da dietro è largo 32 (2,05 m contro 2,55 m di altezza,
    cioè più alto che largo come il mezzo vero); di lato è lungo 82, che sulla
    stessa altezza è il rapporto di un L2H2.
  -->
  <svg viewBox="0 0 120 80" role="img" aria-label="{label} {text} gradi">
    <!-- Riferimento orizzontale: è il piano, non il camper. -->
    <line
      x1="4"
      y1="62"
      x2="116"
      y2="62"
      stroke="var(--line)"
      stroke-width="2"
      stroke-dasharray="4 4"
    />

    <g transform="rotate({-drawn} 60 62)">
      {#if view === 'rear'}
        <!--
          Da dietro il Ducato è più alto che largo: 2,55 m contro 2,05, cioè
          40 unità di larghezza per 50 di altezza fino a terra. Le ruote sono
          rettangoli, disegnati sotto la scocca che ne copre la parte alta.
        -->
        <rect x="42" y="44" width="6" height="18" rx="1.5" fill={wheelColor('second')} />
        <rect x="72" y="44" width="6" height="18" rx="1.5" fill={wheelColor('first')} />
        <rect
          x="40"
          y="12"
          width="40"
          height="40"
          rx="5"
          fill="var(--surface)"
          stroke={body}
          stroke-width="2"
        />
        <rect
          x="44"
          y="17"
          width="32"
          height="13"
          rx="2"
          fill="none"
          stroke="var(--line)"
          stroke-width="1.2"
        />
        <line x1="60" y1="30" x2="60" y2="46" stroke="var(--line)" stroke-width="1.2" />
        <line x1="42" y1="46" x2="78" y2="46" stroke="var(--line)" stroke-width="1.5" />
      {:else}
        <!-- Profilo, muso a destra: 84 unità di lunghezza sulla stessa altezza. -->
        <path
          d="M23 19 H73 L88 38 L97 41 Q102 42 102 47 V49 Q102 54 97 54 H23 Q18 54 18 49 V24
             Q18 19 23 19 Z"
          fill="var(--surface)"
          stroke={body}
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path d="M74 22 L86 38 H74 Z" fill="none" stroke="var(--line)" stroke-width="1.2" />
        <rect
          x="27"
          y="24"
          width="32"
          height="13"
          rx="2"
          fill="none"
          stroke="var(--line)"
          stroke-width="1.2"
        />
        <circle cx="36" cy="56" r="6" fill={wheelColor('second')} />
        <circle cx="88" cy="56" r="6" fill={wheelColor('first')} />
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
