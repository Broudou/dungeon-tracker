<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth, setUser, clearUser } from '$lib/stores/auth';

  // Routes accessible without authentication
  function isPublic(pathname) {
    return (
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/register' ||
      pathname.startsWith('/join/') ||
      pathname.startsWith('/session/')
    );
  }

  onMount(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      res.ok ? setUser(await res.json()) : clearUser();
    } catch {
      clearUser();
    }
  });

  // Redirect unauthenticated users away from protected routes
  $: if (!$auth.loading && !$auth.user && !isPublic($page.url.pathname)) {
    goto('/login');
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    clearUser();
    goto('/');
  }
</script>

<nav>
  <div class="nav-inner">
    <a href="/" class="nav-brand">
      <!-- Minimal sword icon, inline SVG — no icon library needed -->
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
           stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
           aria-hidden="true">
        <path d="M10 2l4 4-7 7-4-1-1-4z" />
        <path d="M2 14l3-3" />
      </svg>
      Dungeon Tracker
    </a>

    <div class="nav-links">
      {#if $auth.user}
        <a href="/dashboard">Dashboard</a>
        <span class="text-faint text-sm">{$auth.user.email}</span>
        <button class="btn btn-ghost btn-sm" on:click={logout}>Log out</button>
      {:else if !$auth.loading}
        <a href="/login">Log in</a>
        <a href="/register" class="btn btn-secondary btn-sm">Register</a>
      {/if}
    </div>
  </div>
</nav>

<slot />
