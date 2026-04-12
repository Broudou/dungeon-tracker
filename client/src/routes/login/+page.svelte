<script>
  import { goto } from '$app/navigation';
  import { setUser } from '$lib/stores/auth';

  let email = '', password = '', error = '', loading = false;

  async function submit() {
    error = '';
    loading = true;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { error = data.message || 'Login failed'; return; }
      setUser(data);
      goto('/dashboard');
    } catch {
      error = 'Could not connect to server.';
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Log In — Dungeon Tracker</title></svelte:head>

<div class="form-card">
  <h1>Enter the Keep</h1>
  <form on:submit|preventDefault={submit}>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" bind:value={email} required autocomplete="email" />
    </div>
    <div class="field">
      <label for="password">Password</label>
      <input id="password" type="password" bind:value={password} required autocomplete="current-password" />
    </div>
    {#if error}<div class="alert alert-error">{error}</div>{/if}
    <button class="btn btn-primary btn-full mt-2" type="submit" disabled={loading}>
      {loading ? 'Entering…' : 'Log In'}
    </button>
  </form>
  <p class="text-muted text-sm mt-2" style="text-align:center; font-family:var(--font-body);">
    No account? <a href="/register">Register</a>
  </p>
</div>
