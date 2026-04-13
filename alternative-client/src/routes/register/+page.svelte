<script>
  import { goto } from '$app/navigation';
  import { setUser } from '$lib/stores/auth';

  let email    = '';
  let password = '';
  let confirm  = '';
  let error    = '';
  let loading  = false;

  async function handleRegister() {
    error = '';
    if (password.length < 8)  { error = 'Password must be at least 8 characters.'; return; }
    if (password !== confirm)  { error = 'Passwords do not match.'; return; }
    loading = true;
    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Registration failed.'; return; }
      setUser(data.user ?? data);
      goto('/dashboard');
    } catch {
      error = 'Could not connect to the server.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Register — Dungeon Tracker</title></svelte:head>

<div class="page">
  <div class="container">
    <div class="auth-card">
      <h1 class="auth-title">Create account</h1>
      <p class="auth-sub">For Dungeon Masters only.</p>

      {#if error}<div class="alert alert-error">{error}</div>{/if}

      <form on:submit|preventDefault={handleRegister}>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" bind:value={email} autocomplete="email" required />
        </div>
        <div class="field">
          <label for="password">Password <span class="text-faint">(min. 8 characters)</span></label>
          <input id="password" type="password" bind:value={password} autocomplete="new-password" required />
        </div>
        <div class="field">
          <label for="confirm">Confirm password</label>
          <input id="confirm" type="password" bind:value={confirm} autocomplete="new-password" required />
        </div>
        <button class="btn btn-primary btn-full" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p class="auth-footer">
        Already have an account? <a href="/login">Log in</a>
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
