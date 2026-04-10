<script>
  import { goto } from '$app/navigation';

  let joinKey = '';
  let error = '';

  async function handleJoin() {
    error = '';
    const key = joinKey.trim().toUpperCase();
    if (key.length !== 6) { error = 'Join key must be 6 characters'; return; }

    try {
      const res = await fetch(`/api/sessions/join/${key}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Invalid key'; return; }
      goto(`/join/${key}`);
    } catch {
      error = 'Could not connect. Is the server running?';
    }
  }
</script>

<svelte:head><title>D&D 5e Tracker</title></svelte:head>

<main class="page">
  <div class="container">
    <!-- Hero -->
    <section style="text-align:center; padding: 5rem 0 3rem;">
      <h1 style="font-size:3rem; font-weight:800; color:var(--color-accent); margin-bottom:1rem;">
        ⚔ D&D 5e Combat Tracker
      </h1>
      <p style="font-size:1.2rem; color:var(--color-text-muted); max-width:520px; margin:0 auto 2.5rem;">
        A real-time combat tracker for Dungeon Masters. Manage campaigns, track initiative, and run epic encounters.
      </p>

      <!-- Join form -->
      <div class="card" style="max-width:380px; margin:0 auto;">
        <h2 style="font-size:1.1rem; margin-bottom:1rem;">Join a Session</h2>
        <form on:submit|preventDefault={handleJoin}>
          <div class="field">
            <label for="key">Session Join Key</label>
            <input
              id="key"
              bind:value={joinKey}
              placeholder="e.g. AB3X9Z"
              maxlength="6"
              style="text-transform:uppercase; letter-spacing:0.15em; font-size:1.1rem;"
            />
          </div>
          {#if error}<div class="alert alert-error">{error}</div>{/if}
          <button class="btn btn-primary btn-full" type="submit">Join Session</button>
        </form>
      </div>
    </section>

    <!-- Features -->
    <section class="grid-3" style="gap:1.5rem; padding-bottom:4rem;">
      <div class="card">
        <h3 style="margin-bottom:.5rem;">📋 Campaign Builder</h3>
        <p class="text-muted text-sm">Build your campaign roster, write lore, and manage up to 20 players per session.</p>
      </div>
      <div class="card">
        <h3 style="margin-bottom:.5rem;">⚡ Initiative Tracker</h3>
        <p class="text-muted text-sm">Roll initiative, track HP, conditions, and spell slots in real time. (Phase 2)</p>
      </div>
      <div class="card">
        <h3 style="margin-bottom:.5rem;">📚 5e SRD Reference</h3>
        <p class="text-muted text-sm">Full monster stat blocks and spell cards from the SRD, always at your fingertips.</p>
      </div>
    </section>

    <div style="text-align:center; padding-bottom:3rem;">
      <p class="text-muted" style="margin-bottom:1rem;">Running a campaign?</p>
      <a href="/register" class="btn btn-primary">Create DM Account</a>
      <span style="margin:0 1rem; color:var(--color-text-muted);">or</span>
      <a href="/login" class="btn btn-ghost">Log in</a>
    </div>
  </div>
</main>
