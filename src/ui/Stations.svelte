<script lang="ts">
  import { app } from '../store/app.svelte'
  import { orientation } from '../store/orientation.svelte'

  type Props = { oncalibrate: () => void; ontransfer: () => void }
  const { oncalibrate, ontransfer }: Props = $props()

  let renamingId = $state<string | null>(null)
  let draftName = $state('')

  const formatDate = (ms: number): string =>
    new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })

  const originName = (id: string | null): string =>
    app.stations.find((station) => station.id === id)?.name ?? 'una postazione cancellata'

  function startRename(id: string, current: string): void {
    renamingId = id
    draftName = current
  }

  function commitRename(): void {
    if (renamingId !== null) app.renameStation(renamingId, draftName)
    renamingId = null
  }
</script>

<section>
  <h1>Postazioni</h1>

  {#if app.stations.length === 0}
    <p class="empty">
      Nessuna postazione salvata. Una postazione è il punto dove appoggi il
      telefono: il cruscotto, il tavolo della dinette, un gradino. Ognuna ha la
      sua correzione e va calibrata una volta sola.
    </p>
  {:else}
    <ul>
      {#each app.stations as station (station.id)}
        <li class:active={station.id === app.activeStation?.id}>
          <label class="row">
            <input
              type="radio"
              name="station"
              checked={station.id === app.activeStation?.id}
              onchange={() => app.setActiveStation(station.id)}
            />
            <span class="info">
              {#if renamingId === station.id}
                <input
                  class="rename"
                  bind:value={draftName}
                  onblur={commitRename}
                  onkeydown={(event) => event.key === 'Enter' && commitRename()}
                />
              {:else}
                <strong>{station.name}</strong>
              {/if}
              <small>
                {station.quality === 'transferred'
                  ? `trasferita da ${originName(station.derivedFrom)}`
                  : 'misurata in bolla'} · {formatDate(station.createdAt)}
              </small>
            </span>
          </label>
          <div class="actions">
            <button onclick={() => startRename(station.id, station.name)}>Rinomina</button>
            <button class="danger" onclick={() => app.removeStation(station.id)}>Elimina</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <button class="primary" onclick={oncalibrate}>Nuova calibrazione in bolla</button>

  <button onclick={ontransfer} disabled={app.stations.length === 0 || !orientation.canTransfer}>
    Trasferisci da una postazione salvata
  </button>

  {#if app.stations.length > 0 && !orientation.canTransfer}
    <p class="note">
      {#if !orientation.running}
        Il trasferimento ha bisogno dei sensori attivi.
      {:else}
        Questo telefono non fornisce un riferimento assoluto stabile
        (qualità «tilt-only»): il trasferimento non è affidabile e resta
        disattivato. Calibra la nuova postazione con il camper in bolla.
      {/if}
    </p>
  {/if}

  {#if !app.persisted}
    <p class="warn">
      Il browser non permette di salvare: le postazioni andranno perse chiudendo
      la pagina.
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
    gap: 0.75rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  li {
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  li.active {
    border-color: var(--accent);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0;
    color: var(--text);
    font-size: var(--size-sm);
  }

  .row input[type='radio'] {
    width: 1.25rem;
    height: 1.25rem;
    min-height: 0;
    flex: none;
    accent-color: var(--accent);
  }

  .info {
    display: flex;
    flex-direction: column;
  }

  small {
    color: var(--muted);
    font-size: var(--size-xs);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .actions button {
    flex: 1;
    font-size: var(--size-xs);
    padding: 0.5rem;
  }

  .empty,
  .note,
  .warn {
    margin: 0;
    font-size: var(--size-xs);
    line-height: 1.5;
  }

  .empty,
  .note {
    color: var(--muted);
  }

  .warn {
    color: var(--warn);
  }
</style>
