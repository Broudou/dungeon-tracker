<script>
  import { goto } from '$app/navigation';

  let joinKey = '';
  let error   = '';

  async function handleJoin() {
    error = '';
    const key = joinKey.trim().toUpperCase();
    if (key.length !== 6) { error = 'Session key must be 6 characters.'; return; }

    try {
      const res  = await fetch(`/api/sessions/join/${key}`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Invalid session key.'; return; }
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
    <section class="hero">
      <p class="hero-eyebrow">Tabletop Combat Management</p>
      <h1 class="hero-title">Dungeon Tracker</h1>
      <p class="hero-sub">
        A real-time companion for Dungeon Masters. Govern your campaign,
        command the initiative order, and shape the fate of your table.
      </p>

      <!-- Session join card -->
      <div class="join-card">
        <h2 class="join-card-title">Enter a Session</h2>
        <form on:submit|preventDefault={handleJoin}>
          <div class="field">
            <label for="key">Session Key</label>
            <input
              id="key"
              bind:value={joinKey}
              placeholder="AB3X9Z"
              maxlength="6"
              class="key-input"
            />
          </div>
          {#if error}<div class="alert alert-error">{error}</div>{/if}
          <button class="btn btn-primary btn-full" type="submit">Enter Session</button>
        </form>
      </div>
    </section>

    <!-- Features -->
    <section class="features">
      <div class="feature-card">
        <h3>Campaign Ledger</h3>
        <p class="text-muted text-sm">
          Chronicle your roster, write lore entries, and assemble your party
          of adventurers before each session.
        </p>
      </div>
      <div class="feature-card">
        <h3>Combat Command</h3>
        <p class="text-muted text-sm">
          Roll initiative, track hit points, manage conditions, and run
          real-time encounters with your full party.
        </p>
      </div>
      <div class="feature-card">
        <h3>World Chronicle</h3>
        <p class="text-muted text-sm">
          Reveal lore cards, narrate events, and weave the world's history
          directly to your players in the session.
        </p>
      </div>
    </section>

    <div class="cta-row">
      <a href="/register" class="btn btn-primary">Create DM Account</a>
      <a href="/login"    class="btn btn-secondary">Log in</a>
    </div>

  </div>
</main>

<style>
  .hero {
    text-align: center;
    padding: 4rem 0 3rem;
    max-width: 540px;
    margin: 0 auto;
  }

  .hero-eyebrow {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-faint);
    margin-bottom: 1rem;
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text);
    margin-bottom: 0.875rem;
  }

  .hero-sub {
    font-size: 1rem;
    color: var(--text-muted);
    line-height: 1.7;
    margin-bottom: 2rem;
  }

  .join-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    max-width: 340px;
    margin: 0 auto;
    box-shadow: var(--shadow);
  }

  .join-card-title {
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  /* Monospaced, centered key input */
  .key-input {
    font-family: 'SFMono-Regular', Consolas, monospace;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 1.25rem;
    text-align: center;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 2.5rem 0;
  }

  .feature-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-top: 2px solid var(--border-strong);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    box-shadow: var(--shadow-sm);
  }

  .feature-card h3 {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .cta-row {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    padding-bottom: 3rem;
  }

  @media (max-width: 640px) {
    .features { grid-template-columns: 1fr; }
    .hero-title { font-size: 1.875rem; }
  }
</style>
