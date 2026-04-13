<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  const joinKey = $page.params.key.toUpperCase();

  let sessionData = null;
  let players     = [];
  let campaignName = '';
  let loading     = true;
  let error       = '';
  let charId      = '';

  onMount(async () => {
    try {
      // Step 1: validate key → get sessionId
      const res = await fetch(`/api/sessions/join/${joinKey}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Invalid session key.'; loading = false; return; }
      sessionData = data;

      // Step 2: load public player roster via lobby endpoint
      const lr = await fetch(`/api/sessions/${data.sessionId}/lobby`);
      if (lr.ok) {
        const lobby = await lr.json();
        campaignName = lobby.campaignName;
        players = lobby.players ?? [];
      }
    } catch {
      error = 'Could not reach the server.';
    } finally {
      loading = false;
    }
  });

  $: selectedChar = players.find(p => p._id === charId) ?? null;
  $: canEnter = !!charId;

  function enter() {
    if (!canEnter) return;
    const identity = {
      displayName: selectedChar.name,
      characterId: charId,
    };
    sessionStorage.setItem(`session_${sessionData.sessionId}`, JSON.stringify(identity));
    goto(`/session/${sessionData.sessionId}`);
  }
</script>

<svelte:head><title>Join Session {joinKey} — Dungeon Tracker</title></svelte:head>

<div class="page">
  <div class="container">
    <div class="join-card">

      {#if loading}
        <div class="loading">Validating key…</div>
      {:else if error}
        <div class="alert alert-error">{error}</div>
        <a href="/" class="btn btn-secondary btn-full mt-md">Back to Home</a>
      {:else}

        <p class="session-key-display">{joinKey}</p>
        {#if campaignName}
          <h1 class="campaign-name">{campaignName}</h1>
        {/if}
        <p class="text-muted text-sm" style="margin-bottom: 1.5rem;">
          Select your character to join the session.
        </p>

        {#if players.length}
          <div class="char-list">
            {#each players as p (p._id)}
              <button
                class="char-row"
                class:selected={charId === p._id}
                on:click={() => charId = p._id}
              >
                <span class="char-name">{p.name}</span>
                <span class="char-meta">Lv {p.level} {p.race} {p.class}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="text-muted text-sm">No characters found for this campaign.</p>
        {/if}

        <button
          class="btn btn-primary btn-full"
          style="margin-top: 1.25rem;"
          on:click={enter}
          disabled={!canEnter}
        >
          Enter as {selectedChar?.name ?? '…'}
        </button>

      {/if}

    </div>
  </div>
</div>

<style>
  .join-card {
    max-width: 420px;
    margin: 4rem auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 2rem;
    box-shadow: var(--shadow);
  }

  .session-key-display {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--text-faint);
    margin-bottom: 0.25rem;
  }

  .campaign-name {
    font-size: 1.375rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .char-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .char-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.875rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface-2);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all 0.1s;
    width: 100%;
  }

  .char-row:hover { border-color: var(--border-strong); }

  .char-row.selected {
    border-color: var(--accent, #7c6af7);
    background: var(--surface);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #7c6af7) 20%, transparent);
  }

  .char-name { font-size: 0.9375rem; font-weight: 600; color: var(--text); }
  .char-meta { font-size: 0.75rem; color: var(--text-faint); }
</style>
