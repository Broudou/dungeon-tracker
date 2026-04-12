<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth, setUser, clearUser } from '$lib/stores/auth';

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

  $: if (!$auth.loading && !$auth.user && !isPublic($page.url.pathname)) {
    goto('/login');
  }
</script>

<nav>
  <div class="container">
    <a href="/" class="nav-brand">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gold)">
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>
      </svg>
      Dungeon Tracker
    </a>
    <div class="nav-links">
      {#if $auth.user}
        <a href="/dashboard">Dashboard</a>
        <span class="text-muted text-sm" style="font-family:var(--font-body)">{$auth.user.email}</span>
        <button
          class="btn btn-ghost btn-sm"
          on:click={async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            clearUser();
            goto('/');
          }}
        >
          Log Out
        </button>
      {:else if !$auth.loading}
        <a href="/login">Log In</a>
        <a href="/register" class="btn btn-primary btn-sm">Register</a>
      {/if}
    </div>
  </div>
</nav>

<slot />
