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

<svelte:head><title>Dungeon Tracker</title></svelte:head>

<main class="page">
  <div class="container">

    <!-- Hero -->
    <section style="text-align:center; padding: 5rem 0 3rem;">
      <p style="font-family:var(--font-heading); font-size:0.75rem; letter-spacing:0.25em; text-transform:uppercase; color:var(--gold-dim); margin-bottom:1rem;">
        Tabletop Combat Management
      </p>
      <h1 style="font-size:3rem; font-weight:900; color:var(--gold); margin-bottom:1rem; text-shadow:0 2px 16px rgba(201,168,76,0.25);">
        Dungeon Tracker
      </h1>
      <p style="font-size:1.15rem; color:var(--text-muted); font-family:var(--font-body); max-width:480px; margin:0 auto 2.5rem; font-style:italic; line-height:1.7;">
        A real-time companion for Dungeon Masters. Govern your campaign, command the initiative order, and shape the fate of your table.
      </p>

      <!-- Join form -->
      <div class="card" style="max-width:360px; margin:0 auto;">
        <h2 style="font-family:var(--font-heading); font-size:1rem; letter-spacing:0.06em; margin-bottom:1rem; color:var(--gold);">
          Enter a Session
        </h2>
        <form on:submit|preventDefault={handleJoin}>
          <div class="field">
            <label for="key">Session Key</label>
            <input
              id="key"
              bind:value={joinKey}
              placeholder="AB3X9Z"
              maxlength="6"
              style="text-transform:uppercase; letter-spacing:0.2em; font-size:1.15rem; text-align:center; font-family:var(--font-heading);"
            />
          </div>
          {#if error}<div class="alert alert-error">{error}</div>{/if}
          <button class="btn btn-primary btn-full" type="submit">Enter Session</button>
        </form>
      </div>
    </section>

    <!-- Ornamental divider -->
    <div style="text-align:center; margin:1rem 0 2.5rem; color:var(--gold-dim); font-size:1.2rem; letter-spacing:0.4em;">
      ✦ ✦ ✦
    </div>

    <!-- Features -->
    <section class="grid-3" style="gap:1.5rem; padding-bottom:4rem;">
      <div class="card" style="border-top:2px solid var(--gold-dim);">
        <h3 style="font-family:var(--font-heading); font-size:0.9rem; letter-spacing:0.05em; color:var(--gold); margin-bottom:.75rem;">
          Campaign Ledger
        </h3>
        <p class="text-muted text-sm" style="font-family:var(--font-body); line-height:1.7;">
          Chronicle your campaign roster, pen lore entries, and assemble your party of adventurers before each session.
        </p>
      </div>
      <div class="card" style="border-top:2px solid var(--gold-dim);">
        <h3 style="font-family:var(--font-heading); font-size:0.9rem; letter-spacing:0.05em; color:var(--gold); margin-bottom:.75rem;">
          Combat Command
        </h3>
        <p class="text-muted text-sm" style="font-family:var(--font-body); line-height:1.7;">
          Roll initiative, track hit points, manage conditions, and conduct real-time encounters with your full party.
        </p>
      </div>
      <div class="card" style="border-top:2px solid var(--gold-dim);">
        <h3 style="font-family:var(--font-heading); font-size:0.9rem; letter-spacing:0.05em; color:var(--gold); margin-bottom:.75rem;">
          World Chronicle
        </h3>
        <p class="text-muted text-sm" style="font-family:var(--font-body); line-height:1.7;">
          Reveal lore cards, narrate events, and weave the world's history directly to your players in the session.
        </p>
      </div>
    </section>

    <div style="text-align:center; padding-bottom:3rem;">
      <p style="color:var(--text-muted); font-family:var(--font-body); font-style:italic; margin-bottom:1.25rem;">
        Commanding a campaign?
      </p>
      <a href="/register" class="btn btn-primary">Create DM Account</a>
      <span style="margin:0 1rem; color:var(--text-dim);">—</span>
      <a href="/login" class="btn btn-ghost">Log In</a>
    </div>

  </div>
</main>
