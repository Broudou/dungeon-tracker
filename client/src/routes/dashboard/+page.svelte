<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';

  let campaigns = [];
  let loading = true;
  let error = '';
  let creating = false;
  let newName = '';
  let newDesc = '';
  let showNew = false;
  let expandedId = null; // click-to-edit

  onMount(async () => {
    await load();
  });

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
    creating = true;
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
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
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.session) {
          goto(`/session/${data.session._id}`);
          return;
        }
        throw new Error(data.message);
      }
      goto(`/session/${data._id}`);
    } catch (e) {
      error = e.message;
    }
  }

  function toggleExpand(id) {
    expandedId = expandedId === id ? null : id;
  }
</script>

<svelte:head><title>Dashboard — Dungeon Tracker</title></svelte:head>

<div class="page">
  <div class="container">

    <!-- Header -->
    <div class="flex-between" style="margin-bottom:2rem;">
      <div>
        <h1 style="font-size:1.7rem; color:var(--gold);">My Campaigns</h1>
        {#if $auth.user}
          <p class="text-muted text-sm" style="font-family:var(--font-body); margin-top:0.2rem;">
            {$auth.user.email}
          </p>
        {/if}
      </div>
      <button class="btn btn-primary" on:click={() => { showNew = !showNew; expandedId = null; }}>
        {showNew ? 'Cancel' : '+ New Campaign'}
      </button>
    </div>

    {#if error}<div class="alert alert-error">{error}</div>{/if}

    <!-- New Campaign Form -->
    {#if showNew}
      <div class="card" style="margin-bottom:1.5rem; border-color:var(--gold-dim);">
        <h2 class="card-title" style="margin-bottom:1rem;">New Campaign</h2>
        <div class="field">
          <label>Campaign Name</label>
          <input bind:value={newName} placeholder="The Lost Mines of Phandelver" />
        </div>
        <div class="field">
          <label>Description</label>
          <textarea bind:value={newDesc} placeholder="A brief account of the adventure ahead…" rows="3"></textarea>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-primary" on:click={createCampaign} disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'Create Campaign'}
          </button>
          <button class="btn btn-ghost" on:click={() => showNew = false}>Cancel</button>
        </div>
      </div>
    {/if}

    <!-- Campaign list -->
    {#if loading}
      <div class="loading">Loading campaigns</div>
    {:else if campaigns.length === 0}
      <div class="card" style="text-align:center; padding:3rem;">
        <p class="text-muted" style="font-family:var(--font-body); font-style:italic; margin-bottom:1rem;">
          No campaigns have been written yet.
        </p>
        <button class="btn btn-primary" on:click={() => showNew = true}>Create your first campaign</button>
      </div>
    {:else}
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        {#each campaigns as campaign (campaign._id)}
          <div
            class="item-row"
            class:expanded={expandedId === campaign._id}
            on:click={() => toggleExpand(campaign._id)}
          >
            <!-- Row header (always visible) -->
            <div class="item-row-header">
              <div style="flex:1; min-width:0;">
                <div class="flex-center gap-1" style="margin-bottom:0.2rem;">
                  <span style="font-family:var(--font-heading); font-size:1rem; font-weight:600;">
                    {campaign.name}
                  </span>
                  <span class="badge">{campaign.players?.length ?? 0} players</span>
                  <span class="badge">{campaign.lore?.length ?? 0} lore</span>
                </div>
                {#if campaign.description}
                  <p class="text-muted text-sm" style="font-family:var(--font-body); font-style:italic;
                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:500px;">
                    {campaign.description}
                  </p>
                {/if}
              </div>
              <span class="item-row-edit-hint">Edit</span>
            </div>

            <!-- Expanded actions -->
            {#if expandedId === campaign._id}
              <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-muted);"
                   on:click|stopPropagation>
                <div class="flex gap-1">
                  <a href="/campaign/{campaign._id}" class="btn btn-secondary btn-sm">
                    Edit Campaign
                  </a>
                  <button class="btn btn-primary btn-sm" on:click={() => startSession(campaign._id)}>
                    Start Session
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>
