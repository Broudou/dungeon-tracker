<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';

  let campaigns  = [];
  let loading    = true;
  let error      = '';
  let showNew    = false;
  let creating   = false;
  let expandedId = null;
  let newName    = '';
  let newDesc    = '';

  onMount(load);

  async function load() {
    loading = true;
    try {
      const res = await fetch('/api/campaigns', { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
      campaigns = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function createCampaign() {
    if (!newName.trim()) return;
    creating = true; error = '';
    try {
      const res  = await fetch('/api/campaigns', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      campaigns = [data, ...campaigns];
      newName = ''; newDesc = ''; showNew = false;
    } catch (e) {
      error = e.message;
    } finally {
      creating = false;
    }
  }

  async function startSession(campaignId) {
    error = '';
    try {
      const res  = await fetch('/api/sessions', {
        method:  'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 = session already active
        if (res.status === 409 && data.session) { goto(`/session/${data.session._id}`); return; }
        throw new Error(data.message);
      }
      goto(`/session/${data._id}`);
    } catch (e) {
      error = e.message;
    }
  }

  function toggle(id) {
    expandedId = expandedId === id ? null : id;
  }
</script>

<svelte:head><title>Dashboard — Dungeon Tracker</title></svelte:head>

<div class="page">
  <div class="container">

    <div class="flex-between" style="margin-bottom: 1.5rem;">
      <div>
        <h1>My Campaigns</h1>
        {#if $auth.user}
          <p class="text-muted text-sm" style="margin-top: 0.2rem;">{$auth.user.email}</p>
        {/if}
      </div>
      <button class="btn btn-primary" on:click={() => { showNew = !showNew; expandedId = null; }}>
        {showNew ? 'Cancel' : '+ New Campaign'}
      </button>
    </div>

    {#if error}<div class="alert alert-error">{error}</div>{/if}

    <!-- New campaign form -->
    {#if showNew}
      <div class="card" style="margin-bottom: 1rem;">
        <h2 style="font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem;">New Campaign</h2>
        <div class="field">
          <label>Campaign name</label>
          <input bind:value={newName} placeholder="The Lost Mines of Phandelver" />
        </div>
        <div class="field">
          <label>Description <span class="text-faint">(optional)</span></label>
          <textarea bind:value={newDesc} rows="2" placeholder="A brief account of the adventure…"></textarea>
        </div>
        <div class="flex-center gap-sm">
          <button class="btn btn-primary" on:click={createCampaign} disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button class="btn btn-ghost" on:click={() => showNew = false}>Cancel</button>
        </div>
      </div>
    {/if}

    <!-- Campaign list -->
    {#if loading}
      <div class="loading">Loading campaigns…</div>
    {:else if campaigns.length === 0}
      <div class="empty-state">
        <p class="text-muted">No campaigns yet.</p>
        <button class="btn btn-primary mt-sm" on:click={() => showNew = true}>
          Create your first campaign
        </button>
      </div>
    {:else}
      <div class="list">
        {#each campaigns as c (c._id)}
          <div
            class="item-row"
            class:expanded={expandedId === c._id}
            on:click={() => toggle(c._id)}
            role="button"
            tabindex="0"
            on:keydown={e => e.key === 'Enter' && toggle(c._id)}
          >
            <div class="item-row-header">
              <div style="flex: 1; min-width: 0;">
                <div class="flex-center gap-xs" style="margin-bottom: 0.2rem;">
                  <span class="campaign-name">{c.name}</span>
                  <span class="badge">{c.players?.length ?? 0} players</span>
                  <span class="badge">{c.lore?.length ?? 0} lore</span>
                </div>
                {#if c.description}
                  <p class="text-muted text-sm truncate">{c.description}</p>
                {/if}
              </div>
              <span class="item-row-hint">{expandedId === c._id ? 'Collapse' : 'Expand'}</span>
            </div>

            {#if expandedId === c._id}
              <div class="expanded-actions" on:click|stopPropagation role="presentation">
                <a href="/campaign/{c._id}" class="btn btn-secondary btn-sm">Edit Campaign</a>
                <button class="btn btn-primary btn-sm" on:click={() => startSession(c._id)}>
                  Start Session
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<style>
  .list { display: flex; flex-direction: column; gap: 0.5rem; }

  .campaign-name { font-weight: 600; font-size: 0.9rem; }

  .expanded-actions {
    margin-top: 0.875rem;
    padding-top: 0.875rem;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 0.5rem;
  }

  .empty-state {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 3rem;
    text-align: center;
    box-shadow: var(--shadow-sm);
  }
</style>
