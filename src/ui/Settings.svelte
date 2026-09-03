<script lang="ts">
  import { app } from '../store/app.svelte'
  import { THEMES, exportJson, importJson, type ThemeId } from '../store/persist'
  import { isWakeLockSupported } from '../sensors/wakelock'
  import { isAudioSupported } from './beep'

  type Props = { ondebug: () => void }
  const { ondebug }: Props = $props()

  const THEME_LABELS: Record<ThemeId, string> = {
    day: 'Giorno',
    sand: 'Sabbia',
    dusk: 'Crepuscolo',
    night: 'Notte',
    amber: 'Ambra',
    red: 'Rosso',
  }

  let message = $state<string | null>(null)
  let error = $state<string | null>(null)
  let fileInput: HTMLInputElement

  function download(): void {
    const blob = new Blob([exportJson(app.state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const day = new Date().toISOString().slice(0, 10)
    link.download = `livella-camper-${day}.json`
    link.click()
    URL.revokeObjectURL(url)
    message = 'Backup scaricato.'
  }

  async function restore(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file === undefined) return
    error = null
    message = null
    try {
      const state = importJson(await file.text())
      app.replaceAll(state)
      message = `Ripristinate ${state.stations.length} postazioni.`
    } catch {
      error = 'Il file non è un backup valido di questa app.'
    }
    fileInput.value = ''
  }
</script>

<section>
  <h1>Opzioni</h1>

  <div class="row">
    <span>Unità</span>
    <div class="choice">
      <button class:selected={app.units === 'cm'} onclick={() => app.setUnits('cm')}>cm</button>
      <button class:selected={app.units === 'mm'} onclick={() => app.setUnits('mm')}>mm</button>
    </div>
  </div>

  <div class="field">
    <label for="tolerance">
      Tolleranza: sotto {app.toleranceDeg.toLocaleString('it-IT')}° la bolla è verde
    </label>
    <input
      id="tolerance"
      type="range"
      min="0.2"
      max="3"
      step="0.1"
      value={app.toleranceDeg}
      oninput={(event) => app.setTolerance(Number(event.currentTarget.value))}
    />
  </div>

  <div class="field">
    <span class="legend">Tema, dal chiaro allo scuro</span>
    <div class="themes">
      {#each THEMES as id (id)}
        <button class="theme" class:selected={app.theme === id} onclick={() => app.setTheme(id)}>
          <!-- L'anteprima porta il proprio tema, il resto del pulsante no. -->
          <span class="swatch" data-theme={id}>
            <span class="ink"></span>
            <span class="dot"></span>
          </span>
          {THEME_LABELS[id]}
        </button>
      {/each}
    </div>
    <small>
      Ambra e rosso sono per il buio: un colore solo su nero, per non bruciare
      l’adattamento all’oscurità.
    </small>
  </div>

  <div class="row">
    <span>
      Beep
      <small>
        {isAudioSupported()
          ? 'Accelera avvicinandosi allo zero, poi diventa un tono continuo.'
          : 'Questo browser non espone l’audio.'}
      </small>
    </span>
    <button
      class:selected={app.beep}
      disabled={!isAudioSupported()}
      onclick={() => app.setBeep(!app.beep)}
    >
      {app.beep ? 'Attivo' : 'Spento'}
    </button>
  </div>

  {#if app.beep}
    <div class="field">
      <label for="beep-tolerance">
        Tono continuo sotto {app.beepToleranceDeg.toLocaleString('it-IT')}°
      </label>
      <input
        id="beep-tolerance"
        type="range"
        min="0.2"
        max="3"
        step="0.1"
        value={app.beepToleranceDeg}
        oninput={(event) => app.setBeepTolerance(Number(event.currentTarget.value))}
      />
      <small>
        È indipendente dalla tolleranza della bolla: puoi farti dire dall’orecchio
        che sei arrivato prima o dopo di quanto lo dica il verde.
      </small>
    </div>
  {/if}

  <h2>Backup</h2>
  <p class="note">
    Le postazioni vivono solo in questo browser. L’export in JSON è l’unico
    modo per non perderle cambiando telefono.
  </p>
  <div class="choice">
    <button onclick={download}>Esporta JSON</button>
    <button onclick={() => fileInput.click()}>Importa JSON</button>
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="application/json,.json"
    class="hidden"
    onchange={restore}
  />

  {#if message}<p class="ok">{message}</p>{/if}
  {#if error}<p class="warn">{error}</p>{/if}
  {#if !app.persisted}
    <p class="warn">
      Il browser rifiuta di salvare: esporta un backup, o perderai tutto
      chiudendo la pagina.
    </p>
  {/if}

  <h2>Diagnostica</h2>
  <p class="note">
    Quaternione, versore verticale, qualità della sorgente e frequenza delle
    letture in tempo reale. Serve solo se qualcosa non funziona.
  </p>
  <button onclick={ondebug}>Apri la diagnostica sensori</button>

  {#if !isWakeLockSupported()}
    <p class="note">
      Questo browser non permette di tenere acceso lo schermo: durante il
      trasferimento tienilo sveglio a mano.
    </p>
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

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .row span {
    display: flex;
    flex-direction: column;
  }

  small,
  .note {
    color: var(--muted);
    font-size: var(--size-xs);
    line-height: 1.4;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .choice {
    display: flex;
    gap: 0.5rem;
  }

  .selected {
    border-color: var(--accent);
    color: var(--accent);
  }

  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
    gap: 0.5rem;
  }

  .theme {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--size-xs);
    padding: 0.5rem 0.625rem;
  }

  /*
   * L'anteprima usa i colori del tema che rappresenta, non di quello attivo:
   * l'attributo data-theme sul pulsante ridefinisce le variabili lì dentro.
   */
  .swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.1875rem;
    width: 1.75rem;
    height: 1.75rem;
    flex: none;
    border-radius: 0.375rem;
    background: var(--bg);
    border: 1px solid var(--line);
  }

  .ink,
  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }

  .ink {
    background: var(--text);
  }

  .dot {
    background: var(--accent);
  }

  .note,
  p {
    margin: 0;
  }

  .hidden {
    display: none;
  }

  .ok {
    color: var(--ok);
  }

  .warn {
    color: var(--warn);
  }
</style>
