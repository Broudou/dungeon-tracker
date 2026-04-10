<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const id = $page.params.id;

  let campaign = null;
  let loading = true;
  let error = '';
  let saving = false;
  let activeTab = 'overview';

  // Overview form
  let name = '', description = '';

  // Player form state
  let showPlayerForm = false;
  let editingPlayer = null;
  let playerForm = freshPlayer();

  // Lore form state
  let showLoreForm = false;
  let editingLore = null;
  let loreForm = freshLore();

  function freshPlayer() {
    return {
      name: '', race: '', class: '', subclass: '', background: '',
      alignment: '', level: 1,
      stats: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      combat: { hpMax: 0, hpCurrent: 0, tempHp: 0, AC: 10, speed: 30, initiativeMod: 0, hitDice: '' },
    };
  }

  function freshLore() {
    return { title: '', body: '', category: 'custom', visibleToPlayers: false };
  }

  onMount(load);

  async function load() {
    loading = true;
    try {
      const res = await fetch(`/api/campaigns/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
      campaign = await res.json();
      name = campaign.name;
      description = campaign.description || '';
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function saveOverview() {
    saving = true;
    error = '';
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      campaign = data;
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  // ── Players ────────────────────────────────────────────────────────────────

  function openNewPlayer() {
    editingPlayer = null;
    playerForm = freshPlayer();
    showPlayerForm = true;
  }

  function openEditPlayer(p) {
    editingPlayer = p;
    playerForm = JSON.parse(JSON.stringify(p)); // deep copy
    showPlayerForm = true;
  }

  async function savePlayer() {
    saving = true;
    error = '';
    try {
      let res, data;
      if (editingPlayer) {
        res = await fetch(`/api/campaigns/${id}/players/${editingPlayer._id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(playerForm),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        campaign.players = campaign.players.map(p => p._id === editingPlayer._id ? data : p);
      } else {
        res = await fetch(`/api/campaigns/${id}/players`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(playerForm),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        campaign.players = [...campaign.players, data];
      }
      showPlayerForm = false;
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function deletePlayer(playerId) {
    if (!confirm('Remove this player from the campaign?')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/players/${playerId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).message);
      campaign.players = campaign.players.filter(p => p._id !== playerId);
    } catch (e) {
      error = e.message;
    }
  }

  // ── Lore ───────────────────────────────────────────────────────────────────

  function openNewLore() {
    editingLore = null;
    loreForm = freshLore();
    showLoreForm = true;
  }

  function openEditLore(entry) {
    editingLore = entry;
    loreForm = JSON.parse(JSON.stringify(entry));
    showLoreForm = true;
  }

  async function saveLore() {
    saving = true;
    error = '';
    try {
      let res, data;
      if (editingLore) {
        res = await fetch(`/api/campaigns/${id}/lore/${editingLore._id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loreForm),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        campaign.lore = campaign.lore.map(e => e._id === editingLore._id ? data : e);
      } else {
        res = await fetch(`/api/campaigns/${id}/lore`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loreForm),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        campaign.lore = [...campaign.lore, data];
      }
      showLoreForm = false;
    } catch (e) {
      error = e.message;
    } finally {
      saving = false;
    }
  }

  async function deleteLore(entryId) {
    if (!confirm('Delete this lore entry?')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/lore/${entryId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).message);
      campaign.lore = campaign.lore.filter(e => e._id !== entryId);
    } catch (e) {
      error = e.message;
    }
  }

  const STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const LORE_CATEGORIES = ['world', 'faction', 'npc', 'location', 'custom'];
</script>

<svelte:head>
  <title>{campaign?.name ?? 'Campaign'} — D&D 5e Tracker</title>
</svelte:head>

<div class="page">
  <div class="container">
    {#if loading}
      <div class="loading">Loading campaign…</div>
    {:else if !campaign}
      <div class="alert alert-error">{error || 'Campaign not found'}</div>
    {:else}
      <!-- Page header -->
      <div class="flex-between" style="margin-bottom:1.5rem;">
        <div>
          <a href="/dashboard" class="text-muted text-sm">← Dashboard</a>
          <h1 style="font-size:1.8rem; font-weight:700; margin-top:.25rem;">{campaign.name}</h1>
        </div>
      </div>

      {#if error}<div class="alert alert-error">{error}</div>{/if}

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" class:active={activeTab==='overview'} on:click={() => activeTab='overview'}>Overview</button>
        <button class="tab-btn" class:active={activeTab==='players'} on:click={() => activeTab='players'}>
          Players ({campaign.players.length})
        </button>
        <button class="tab-btn" class:active={activeTab==='lore'} on:click={() => activeTab='lore'}>
          Lore ({campaign.lore.length})
        </button>
      </div>

      <!-- ── Overview ─────────────────────────────────────────────────────── -->
      {#if activeTab === 'overview'}
        <div class="card" style="max-width:600px;">
          <h2 class="card-title" style="margin-bottom:1rem;">Campaign Details</h2>
          <div class="field">
            <label>Name</label>
            <input bind:value={name} />
          </div>
          <div class="field">
            <label>Description (markdown)</label>
            <textarea bind:value={description} rows="5"></textarea>
          </div>
          <button class="btn btn-primary" on:click={saveOverview} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      {/if}

      <!-- ── Players ──────────────────────────────────────────────────────── -->
      {#if activeTab === 'players'}
        <div class="section-header">
          <h2 class="section-title">Player Characters</h2>
          <button class="btn btn-primary btn-sm" on:click={openNewPlayer}>+ Add Player</button>
        </div>

        {#if showPlayerForm}
          <div class="card" style="margin-bottom:1.5rem;">
            <h3 class="card-title" style="margin-bottom:1rem;">
              {editingPlayer ? 'Edit Player' : 'New Player'}
            </h3>

            <div class="grid-2">
              <div class="field"><label>Name *</label><input bind:value={playerForm.name} /></div>
              <div class="field"><label>Level</label><input type="number" min="1" max="20" bind:value={playerForm.level} /></div>
              <div class="field"><label>Race</label><input bind:value={playerForm.race} /></div>
              <div class="field"><label>Class</label><input bind:value={playerForm.class} /></div>
              <div class="field"><label>Subclass</label><input bind:value={playerForm.subclass} /></div>
              <div class="field"><label>Background</label><input bind:value={playerForm.background} /></div>
              <div class="field"><label>Alignment</label><input bind:value={playerForm.alignment} /></div>
            </div>

            <h4 style="margin:1rem 0 .5rem; font-size:.9rem; color:var(--color-text-muted);">Ability Scores</h4>
            <div class="grid-6">
              {#each STATS as stat}
                <div class="field" style="text-align:center;">
                  <label>{stat}</label>
                  <input type="number" min="1" max="30" bind:value={playerForm.stats[stat]}
                    style="text-align:center;" />
                </div>
              {/each}
            </div>

            <h4 style="margin:1rem 0 .5rem; font-size:.9rem; color:var(--color-text-muted);">Combat</h4>
            <div class="grid-3">
              <div class="field"><label>HP Max</label><input type="number" bind:value={playerForm.combat.hpMax} /></div>
              <div class="field"><label>HP Current</label><input type="number" bind:value={playerForm.combat.hpCurrent} /></div>
              <div class="field"><label>Temp HP</label><input type="number" bind:value={playerForm.combat.tempHp} /></div>
              <div class="field"><label>AC</label><input type="number" bind:value={playerForm.combat.AC} /></div>
              <div class="field"><label>Speed (ft)</label><input type="number" bind:value={playerForm.combat.speed} /></div>
              <div class="field"><label>Initiative Mod</label><input type="number" bind:value={playerForm.combat.initiativeMod} /></div>
              <div class="field"><label>Hit Dice</label><input bind:value={playerForm.combat.hitDice} placeholder="e.g. 1d8" /></div>
            </div>

            <div class="flex gap-1 mt-2">
              <button class="btn btn-primary" on:click={savePlayer} disabled={saving || !playerForm.name.trim()}>
                {saving ? 'Saving…' : editingPlayer ? 'Update Player' : 'Add Player'}
              </button>
              <button class="btn btn-ghost" on:click={() => showPlayerForm = false}>Cancel</button>
            </div>
          </div>
        {/if}

        {#if campaign.players.length === 0}
          <div class="card" style="text-align:center; padding:2rem;">
            <p class="text-muted">No players yet. Add your party!</p>
          </div>
        {:else}
          <div style="display:flex; flex-direction:column; gap:.75rem;">
            {#each campaign.players as player (player._id)}
              <div class="card flex-between">
                <div>
                  <div class="flex-center gap-1">
                    <strong>{player.name}</strong>
                    <span class="badge">Lv {player.level}</span>
                    {#if player.class}<span class="text-muted text-sm">{player.race} {player.class}</span>{/if}
                  </div>
                  <div class="text-sm text-muted mt-1">
                    HP {player.combat.hpCurrent}/{player.combat.hpMax} · AC {player.combat.AC} · Speed {player.combat.speed} ft
                  </div>
                </div>
                <div class="flex gap-1">
                  <button class="btn btn-secondary btn-sm" on:click={() => openEditPlayer(player)}>Edit</button>
                  <button class="btn btn-danger btn-sm" on:click={() => deletePlayer(player._id)}>Remove</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- ── Lore ─────────────────────────────────────────────────────────── -->
      {#if activeTab === 'lore'}
        <div class="section-header">
          <h2 class="section-title">Lore & Notes</h2>
          <button class="btn btn-primary btn-sm" on:click={openNewLore}>+ Add Entry</button>
        </div>

        {#if showLoreForm}
          <div class="card" style="margin-bottom:1.5rem;">
            <h3 class="card-title" style="margin-bottom:1rem;">
              {editingLore ? 'Edit Lore Entry' : 'New Lore Entry'}
            </h3>
            <div class="grid-2">
              <div class="field">
                <label>Title *</label>
                <input bind:value={loreForm.title} />
              </div>
              <div class="field">
                <label>Category</label>
                <select bind:value={loreForm.category}>
                  {#each LORE_CATEGORIES as cat}
                    <option value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  {/each}
                </select>
              </div>
            </div>
            <div class="field">
              <label>Body (markdown)</label>
              <textarea bind:value={loreForm.body} rows="6"></textarea>
            </div>
            <div class="field" style="flex-direction:row; align-items:center; gap:.5rem;">
              <input type="checkbox" id="visible" bind:checked={loreForm.visibleToPlayers} />
              <label for="visible" style="cursor:pointer;">Visible to players</label>
            </div>
            <div class="flex gap-1 mt-2">
              <button class="btn btn-primary" on:click={saveLore} disabled={saving || !loreForm.title.trim()}>
                {saving ? 'Saving…' : editingLore ? 'Update Entry' : 'Add Entry'}
              </button>
              <button class="btn btn-ghost" on:click={() => showLoreForm = false}>Cancel</button>
            </div>
          </div>
        {/if}

        {#if campaign.lore.length === 0}
          <div class="card" style="text-align:center; padding:2rem;">
            <p class="text-muted">No lore entries yet.</p>
          </div>
        {:else}
          <div style="display:flex; flex-direction:column; gap:.75rem;">
            {#each campaign.lore as entry (entry._id)}
              <div class="card">
                <div class="flex-between" style="margin-bottom:.5rem;">
                  <div class="flex-center gap-1">
                    <strong>{entry.title}</strong>
                    <span class="badge">{entry.category}</span>
                    {#if entry.visibleToPlayers}
                      <span class="badge" style="background:#1a3a1a; color:#8aff8a;">public</span>
                    {/if}
                  </div>
                  <div class="flex gap-1">
                    <button class="btn btn-secondary btn-sm" on:click={() => openEditLore(entry)}>Edit</button>
                    <button class="btn btn-danger btn-sm" on:click={() => deleteLore(entry._id)}>Delete</button>
                  </div>
                </div>
                {#if entry.body}
                  <p class="text-muted text-sm" style="white-space:pre-wrap; line-height:1.6;">
                    {entry.body.length > 300 ? entry.body.slice(0, 300) + '…' : entry.body}
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>
