<script lang="ts">
  import { ScreenWakeLock } from './sensors/wakelock'
  import { app } from './store/app.svelte'
  import { orientation } from './store/orientation.svelte'
  import CalibrateWizard from './ui/CalibrateWizard.svelte'
  import Level from './ui/Level.svelte'
  import SensorDebug from './ui/SensorDebug.svelte'
  import Settings from './ui/Settings.svelte'
  import Stations from './ui/Stations.svelte'
  import TransferWizard from './ui/TransferWizard.svelte'
  import Vehicle from './ui/Vehicle.svelte'

  type View = 'level' | 'stations' | 'vehicle' | 'settings' | 'calibrate' | 'transfer' | 'debug'

  let view = $state<View>('level')

  const tabs: { id: View; label: string }[] = [
    { id: 'level', label: 'Livella' },
    { id: 'stations', label: 'Postazioni' },
    { id: 'vehicle', label: 'Veicolo' },
    { id: 'settings', label: 'Impostazioni' },
    { id: 'debug', label: 'Debug' },
  ]

  const wakeLock = new ScreenWakeLock()

  $effect(() => {
    document.documentElement.dataset.night = String(app.nightMode)
  })

  // Schermo sempre acceso mentre si misura, e non un minuto di più.
  $effect(() => {
    if (orientation.running) void wakeLock.request()
    else void wakeLock.release()
  })
</script>

{#if view === 'level'}
  <Level oncalibrate={() => (view = 'calibrate')} />
{:else if view === 'stations'}
  <Stations oncalibrate={() => (view = 'calibrate')} ontransfer={() => (view = 'transfer')} />
{:else if view === 'vehicle'}
  <Vehicle />
{:else if view === 'settings'}
  <Settings />
{:else if view === 'calibrate'}
  <CalibrateWizard onclose={() => (view = 'stations')} />
{:else if view === 'transfer'}
  <TransferWizard onclose={() => (view = 'stations')} />
{:else}
  <SensorDebug />
{/if}

{#if view !== 'calibrate' && view !== 'transfer'}
  <nav>
    {#each tabs as tab (tab.id)}
      <button class:active={view === tab.id} onclick={() => (view = tab.id)}>{tab.label}</button>
    {/each}
  </nav>
{/if}

<style>
  nav {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    padding: 0.5rem 1rem 1.25rem;
    flex-wrap: wrap;
  }

  nav button {
    font-size: var(--size-xs);
    padding: 0.5rem 0.875rem;
  }

  .active {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
