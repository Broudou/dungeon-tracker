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
        // If a session already exists, navigate to it
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
</script>

<svelte:head><title>Dashboard — D&D 5e Tracker</title></svelte:head>

<div class="page">
  <div class="container">
    <div class="flex-between" style="margin-bottom:2rem;">
      <div>
        <h1 style="font-size:1.8rem; font-weight:700;">My Campaigns</h1>
        {#if $auth.user}
          <p class="text-muted text-sm">{$auth.user.email}</p>
        {/if}
      </div>
      <button class="btn btn-primary" on:click={() => showNew = !showNew}>
        {showNew ? 'Cancel' : '+ New Campaign'}
      </button>
    </div>

    {#if error}<div class="alert alert-error">{error}</div>{/if}

    {#if showNew}
      <div class="card" style="margin-bottom:1.5rem;">
        <h2 class="card-title" style="margin-bottom:1rem;">New Campaign</h2>
        <div class="field">
          <label>Campaign Name</label>
          <input bind:value={newName} placeholder="The Lost Mines of Phandelver" />
        </div>
        <div class="field">
          <label>Description (markdown)</label>
          <textarea bind:value={newDesc} placeholder="A short campaign description…" rows="3"></textarea>
        </div>
        <button class="btn btn-primary" on:click={createCampaign} disabled={creating || !newName.trim()}>
          {creating ? 'Creating…' : 'Create Campaign'}
        </button>
      </div>
    {/if}

    {#if loading}
      <div class="loading">Loading campaigns…</div>
    {:else if campaigns.length === 0}
      <div class="card" style="text-align:center; padding:3rem;">
        <p class="text-muted" style="margin-bottom:1rem;">No campaigns yet.</p>
        <button class="btn btn-primary" on:click={() => showNew = true}>Create your first campaign</button>
      </div>
    {:else}
      <div style="display:flex; flex-direction:column; gap:1rem;">
        {#each campaigns as campaign (campaign._id)}
          <div class="card" style="display:flex; align-items:center; gap:1rem;">
            <div style="flex:1; min-width:0;">
              <div class="flex-center gap-1" style="margin-bottom:.25rem;">
                <span class="card-title">{campaign.name}</span>
                <span class="badge">{campaign.players?.length ?? 0} players</span>
                <span class="badge">{campaign.lore?.length ?? 0} lore entries</span>
              </div>
              {#if campaign.description}
                <p class="text-muted text-sm" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  {campaign.description}
                </p>
              {/if}
            </div>
            <div class="flex gap-1">
              <a href="/campaign/{campaign._id}" class="btn btn-secondary btn-sm">Edit</a>
              <button class="btn btn-primary btn-sm" on:click={() => startSession(campaign._id)}>
                Start Session
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
