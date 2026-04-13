<script>
  import { goto } from '$app/navigation';
  import { setUser } from '$lib/stores/auth';

  let email    = '';
  let password = '';
  let error    = '';
  let loading  = false;

  async function handleLogin() {
    error = ''; loading = true;
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Login failed.'; return; }
      setUser(data.user ?? data);
      goto('/dashboard');
    } catch {
      error = 'Could not connect to the server.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Log In — Dungeon Tracker</title></svelte:head>

<div class="page">
  <div class="container">
    <div class="auth-card">
      <h1 class="auth-title">Log in</h1>
      <p class="auth-sub">Dungeon Masters only.</p>

      {#if error}<div class="alert alert-error">{error}</div>{/if}

      <form on:submit|preventDefault={handleLogin}>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" bind:value={email} autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" bind:value={password} autocomplete="current-password" required />
        </div>
        <button class="btn btn-primary btn-full" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p class="auth-footer">
        No account? <a href="/register">Register</a>
      </p>
    </div>
  </div>
</div>

<style>
  .auth-card {
    max-width: 380px;
    margin: 4rem auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 2rem;
    box-shadow: var(--shadow);
  }

  .auth-title {
    font-size: 1.375rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .auth-sub {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .auth-footer {
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
    margin-top: 1.25rem;
  }
</style>
