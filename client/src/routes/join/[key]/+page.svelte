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

      // Fetch campaign roster so player can pick their character
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
    // Store player identity for the session view
    sessionStorage.setItem(`session_${sessionData.sessionId}`, JSON.stringify({
      displayName: displayName.trim(),
      characterId: selectedPlayerId || null,
    }));
    goto(`/session/${sessionData.sessionId}`);
  }
</script>

<svelte:head>
  <title>Join Session {key} — D&D 5e Tracker</title>
</svelte:head>

<div class="page">
  <div class="container">
    <div class="form-card">
      {#if loading}
        <div class="loading">Validating join key…</div>
      {:else if error}
        <h1>Can't Join</h1>
        <div class="alert alert-error">{error}</div>
        <a href="/" class="btn btn-ghost btn-full mt-2">← Back to Home</a>
      {:else}
        <h1>Join Session</h1>
        <p class="text-muted text-sm" style="margin-bottom:1.5rem;">
          Key: <strong style="letter-spacing:.1em;">{key}</strong>
          {#if campaign} · Campaign: <strong>{campaign.name}</strong>{/if}
        </p>

        <form on:submit|preventDefault={handleJoin}>
          <div class="field">
            <label for="displayName">Your Display Name</label>
            <input id="displayName" bind:value={displayName} placeholder="How should the DM see you?" required />
          </div>

          {#if campaign?.players?.length > 0}
            <div class="field">
              <label for="character">Select Your Character (optional)</label>
              <select id="character" bind:value={selectedPlayerId}>
                <option value="">— No character / spectator —</option>
                {#each campaign.players as p}
                  <option value={p._id}>
                    {p.name} — Lv {p.level} {p.race} {p.class}
                  </option>
                {/each}
              </select>
            </div>
          {/if}

          <button class="btn btn-primary btn-full mt-2" type="submit" disabled={joining || !displayName.trim()}>
            {joining ? 'Joining…' : 'Enter Session'}
          </button>
        </form>

        <p class="text-muted text-sm mt-2" style="text-align:center;">
          Real-time features arrive in Phase 2.
        </p>
      {/if}
    </div>
  </div>
</div>
