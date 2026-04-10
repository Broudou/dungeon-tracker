<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const id = $page.params.id;
  let session = null;
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const res = await fetch(`/api/sessions/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
      session = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Session — D&D 5e Tracker</title>
</svelte:head>

<div class="page">
  <div class="container">
    {#if loading}
      <div class="loading">Loading session…</div>
    {:else if error}
      <div class="alert alert-error">{error}</div>
    {:else if session}
      <div style="text-align:center; padding:4rem 0;">
        <!-- Phase 2 placeholder -->
        <div style="font-size:4rem; margin-bottom:1.5rem;">⚔</div>
        <h1 style="font-size:2rem; font-weight:700; margin-bottom:.5rem;">
          Session Active
        </h1>
        <p class="text-muted" style="margin-bottom:2rem;">
          Campaign: <strong>{session.campaignId?.name ?? session.campaignId}</strong>
        </p>

        <div class="card" style="max-width:360px; margin:0 auto 2rem;">
          <p class="text-muted text-sm" style="margin-bottom:.5rem;">Join Key</p>
          <div style="font-size:2.5rem; font-weight:800; letter-spacing:.2em; color:var(--color-accent);">
            {session.joinKey}
          </div>
          <p class="text-muted text-sm" style="margin-top:.5rem;">
            Share this with your players at <strong>dnd5e.app/join/{session.joinKey}</strong>
          </p>
        </div>

        <div class="flex-center" style="justify-content:center; gap:.5rem; margin-bottom:2rem;">
          <span class="badge">Phase: {session.phase}</span>
          <span class="badge">Status: {session.status}</span>
        </div>

        <div class="card" style="max-width:480px; margin:0 auto; text-align:left;">
          <h2 class="card-title" style="margin-bottom:.75rem;">Phase 2 coming soon</h2>
          <ul class="text-muted text-sm" style="line-height:2; padding-left:1.25rem;">
            <li>Real-time initiative tracker with WebSocket sync</li>
            <li>HP adjustment with damage / healing log</li>
            <li>Condition tracking per combatant</li>
            <li>Monster stat block overlay</li>
            <li>Spell slot tracking during combat</li>
          </ul>
        </div>

        <div style="margin-top:2rem;">
          <a href="/dashboard" class="btn btn-ghost">← Back to Dashboard</a>
        </div>
      </div>
    {/if}
  </div>
</div>
