<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  const joinKey = $page.params.key.toUpperCase();

  let sessionData = null;
  let campaign    = null;
  let loading     = true;
  let error       = '';
  let displayName = '';
  let charId      = '';

  onMount(async () => {
    try {
      // Validate key and get session + campaign info
      const res = await fetch(`/api/sessions/join/${joinKey}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Invalid session key.'; loading = false; return; }
      sessionData = data;

      // Fetch campaign for character list
      if (data.campaignId) {
        const cr = await fetch(`/api/campaigns/${data.campaignId}`, { credentials: 'include' });
        if (cr.ok) campaign = await cr.json();
      }
    } catch {
      error = 'Could not reach the server.';
    } finally {
      loading = false;
    }
  });

  function enter() {
    if (!displayName.trim()) return;
    const identity = { displayName: displayName.trim(), characterId: charId || null };
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
        {#if campaign}
          <h1 class="campaign-name">{campaign.name}</h1>
        {/if}
        <p class="text-muted text-sm" style="margin-bottom: 1.5rem;">
          Enter your name and select your character to join the session.
        </p>

        <div class="field">
          <label for="name">Your name</label>
          <input id="name" bind:value={displayName} placeholder="Gandalf" maxlength="40" />
        </div>

        {#if campaign?.players?.length}
          <div class="field">
            <label for="char">Character <span class="text-faint">(optional)</span></label>
            <select id="char" bind:value={charId}>
              <option value="">— no character —</option>
              {#each campaign.players as p (p._id)}
                <option value={p._id}>{p.name} — Lv {p.level} {p.race} {p.class}</option>
              {/each}
            </select>
          </div>
        {/if}

        <button
          class="btn btn-primary btn-full"
          on:click={enter}
          disabled={!displayName.trim()}
        >
          Enter Session
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
</style>
