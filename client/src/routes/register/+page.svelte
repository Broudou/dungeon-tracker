<script>
  import { goto } from '$app/navigation';
  import { setUser } from '$lib/stores/auth';

  let email = '', password = '', confirm = '', error = '', loading = false;

  async function submit() {
    error = '';
    if (password !== confirm) { error = 'Passwords do not match'; return; }
    if (password.length < 8) { error = 'Password must be at least 8 characters'; return; }
    loading = true;
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Registration failed'; return; }
      setUser(data);
      goto('/dashboard');
    } catch {
      error = 'Could not connect to server.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Register — Dungeon Tracker</title></svelte:head>

<div class="form-card">
  <h1>Claim Your Seat</h1>
  <p style="font-family:var(--font-body); font-style:italic; color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">
    Create your Dungeon Master account
  </p>
  <form on:submit|preventDefault={submit}>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required autocomplete="email" />
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} required autocomplete="new-password" />
    </div>
    <div class="field">
      <label for="confirm">Confirm Password</label>
      <input id="confirm" type="password" bind:value={confirm} required autocomplete="new-password" />
    </div>
    {#if error}<div class="alert alert-error">{error}</div>{/if}
    <button class="btn btn-primary btn-full mt-2" type="submit" disabled={loading}>
      {loading ? 'Creating…' : 'Create Account'}
    </button>
  </form>
  <p class="text-muted text-sm mt-2" style="text-align:center; font-family:var(--font-body);">
    Already have an account? <a href="/login">Log In</a>
  </p>
</div>
