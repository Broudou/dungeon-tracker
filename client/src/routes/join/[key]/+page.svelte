<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  const key = $page.params.key.toUpperCase();

  let sessionData = null;
  let campaign = null;
  let loading = true;
  let error = '';
  let joining = false;
  let displayName = '';
  let selectedPlayerId = '';

  onMount(async () => {
    try {
      const res = await fetch(`/api/sessions/join/${key}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Invalid join key'; return; }

      sessionData = data;

      const cRes = await fetch(`/api/campaigns/${data.campaignId}`, { credentials: 'include' });
      if (cRes.ok) campaign = await cRes.json();
    } catch {
      error = 'Could not connect to server.';
    } finally {
      loading = false;
    }
  });

  function handleJoin() {
    if (!displayName.trim()) return;
    sessionStorage.setItem(`session_${sessionData.sessionId}`, JSON.stringify({
      displayName: displayName.trim(),
      characterId: selectedPlayerId || null,
    }));
    goto(`/session/${sessionData.sessionId}`);
  }
</script>

<svelte:head>
  <title>Enter Session {key} — Dungeon Tracker</title>
</svelte:head>

<div class="page">
  <div class="container">
    <div class="form-card">
      {#if loading}
        <div class="loading">Verifying passage</div>
      {:else if error}
        <h1 style="color:var(--gold);">Entry Denied</h1>
        <div class="alert alert-error mt-2">{error}</div>
        <a href="/" class="btn btn-ghost btn-full mt-2">← Return Home</a>
      {:else}
        <h1>Enter the Hall</h1>
        <p class="text-muted" style="font-family:var(--font-body); font-style:italic; font-size:0.9rem; margin-bottom:1.5rem;">
          Key: <strong style="font-family:var(--font-heading); letter-spacing:0.1em; color:var(--gold);">{key}</strong>
          {#if campaign}
            &nbsp;·&nbsp; <strong style="color:var(--text);">{campaign.name}</strong>
          {/if}
        </p>

        <form on:submit|preventDefault={handleJoin}>
          <div class="field">
            <label for="displayName">Your Name</label>
            <input id="displayName" bind:value={displayName}
              placeholder="How shall the DM know you?" required />
          </div>

          {#if campaign?.players?.length > 0}
            <div class="field">
              <label for="character">Claim Your Character</label>
              <select id="character" bind:value={selectedPlayerId}>
                <option value="">— Spectator / no character —</option>
                {#each campaign.players as p}
                  <option value={p._id}>
                    {p.name} — Lv {p.level} {p.race} {p.class}
                  </option>
                {/each}
              </select>
            </div>
          {/if}

          <button class="btn btn-primary btn-full mt-2" type="submit"
            disabled={joining || !displayName.trim()}>
            {joining ? 'Entering…' : 'Enter Session'}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
