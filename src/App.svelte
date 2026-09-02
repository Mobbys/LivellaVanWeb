<script lang="ts">
  import Level from './ui/Level.svelte'
  import SensorDebug from './ui/SensorDebug.svelte'

  type View = 'level' | 'debug'

  let view = $state<View>('level')
</script>

{#if view === 'level'}
  <Level />
{:else}
  <SensorDebug />
{/if}

<nav>
  <button class:active={view === 'level'} onclick={() => (view = 'level')}>Livella</button>
  <button class:active={view === 'debug'} onclick={() => (view = 'debug')}>Debug</button>
</nav>

<style>
  nav {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    padding: 0 1rem 1.25rem;
  }

  .active {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
