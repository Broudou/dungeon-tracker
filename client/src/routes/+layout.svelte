<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth, setUser, clearUser } from '$lib/stores/auth';

  // Public routes that don't require authentication
  const PUBLIC = ['/', '/login', '/register', '/join'];

  function isPublic(pathname) {
    return PUBLIC.some(p => pathname === p || pathname.startsWith('/join/'));
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        setUser(await res.json());
      } else {
        clearUser();
      }
    } catch {
      clearUser();
    }
  });

  // Redirect unauthenticated users away from protected routes once loading finishes
  $: if (!$auth.loading && !$auth.user && !isPublic($page.url.pathname)) {
    goto('/login');
  }
</script>

<nav>
  <div class="container">
    <a href="/" class="nav-brand">⚔ D&D 5e Tracker</a>
    <div class="nav-links">
      {#if $auth.user}
        <a href="/dashboard">Dashboard</a>
        <span class="text-muted text-sm">{$auth.user.email}</span>
        <button
          class="btn btn-ghost btn-sm"
          on:click={async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            clearUser();
            goto('/');
          }}
        >
          Log out
        </button>
      {:else if !$auth.loading}
        <a href="/login">Log in</a>
        <a href="/register" class="btn btn-primary btn-sm">Register</a>
      {/if}
    </div>
  </div>
</nav>

<slot />
