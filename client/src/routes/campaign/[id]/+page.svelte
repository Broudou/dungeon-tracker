<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const id = $page.params.id;

  let campaign = null;
  let loading = true;
  let error = '';
  let saving = false;
  let activeTab = 'overview';

  // Overview
  let name = '', description = '';

  // Players — click-to-edit
  let expandedPlayerId = null;   // null = no player expanded
  let newPlayerOpen = false;
  let playerForm = freshPlayer();
  let editingPlayer = null;

  // Lore — click-to-edit
  let expandedLoreId = null;
  let newLoreOpen = false;
  let loreForm = freshLore();
  let editingLore = null;

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
    saving = true; error = '';
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      campaign = data;
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }

  // ── Players ────────────────────────────────────────────────────────────────

  function openEditPlayer(p, e) {
    e?.stopPropagation();
    expandedPlayerId = p._id;
    editingPlayer = p;
    playerForm = JSON.parse(JSON.stringify(p));
    newPlayerOpen = false;
  }

  function closePlayer() {
    expandedPlayerId = null;
    editingPlayer = null;
    newPlayerOpen = false;
  }

  function openNewPlayer() {
    expandedPlayerId = null;
    editingPlayer = null;
    playerForm = freshPlayer();
    newPlayerOpen = true;
  }

  async function savePlayer() {
    saving = true; error = '';
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
      closePlayer();
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }

  async function deletePlayer(playerId, e) {
    e?.stopPropagation();
    if (!confirm('Remove this adventurer from the campaign?')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/players/${playerId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).message);
      campaign.players = campaign.players.filter(p => p._id !== playerId);
      if (expandedPlayerId === playerId) closePlayer();
    } catch (e) { error = e.message; }
  }

  // ── Lore ───────────────────────────────────────────────────────────────────

  function openEditLore(entry, e) {
    e?.stopPropagation();
    expandedLoreId = entry._id;
    editingLore = entry;
    loreForm = JSON.parse(JSON.stringify(entry));
    newLoreOpen = false;
  }

  function closeLore() {
    expandedLoreId = null;
    editingLore = null;
    newLoreOpen = false;
  }

  function openNewLore() {
    expandedLoreId = null;
    editingLore = null;
    loreForm = freshLore();
    newLoreOpen = true;
  }

  async function saveLore() {
    saving = true; error = '';
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
      closeLore();
    } catch (e) { error = e.message; }
    finally { saving = false; }
  }

  async function deleteLore(entryId, e) {
    e?.stopPropagation();
    if (!confirm('Delete this lore entry?')) return;
    try {
      const res = await fetch(`/api/campaigns/${id}/lore/${entryId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).message);
      campaign.lore = campaign.lore.filter(e => e._id !== entryId);
      if (expandedLoreId === entryId) closeLore();
    } catch (e) { error = e.message; }
  }

  const STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const LORE_CATEGORIES = ['world', 'faction', 'npc', 'location', 'custom'];

  const DND_RACES = [
    'Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf',
    'Half-Orc', 'Halfling', 'Human', 'Tiefling',
  ];
  const DND_CLASSES = [
    'Artificer', 'Barbarian', 'Bard', 'Cleric', 'Druid',
    'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue',
    'Sorcerer', 'Warlock', 'Wizard',
  ];
  const ALIGNMENTS = [
    ['Lawful Good',    'Neutral Good',  'Chaotic Good'],
    ['Lawful Neutral', 'True Neutral',  'Chaotic Neutral'],
    ['Lawful Evil',    'Neutral Evil',  'Chaotic Evil'],
  ];

  function statMod(score) {
    const m = Math.floor((score - 10) / 2);
    return (m >= 0 ? '+' : '') + m;
  }
</script>

<svelte:head>
  <title>{campaign?.name ?? 'Campaign'} — Dungeon Tracker</title>
</svelte:head>

<div class="page">
  <div class="container">
    {#if loading}
      <div class="loading">Loading campaign</div>
    {:else if !campaign}
      <div class="alert alert-error">{error || 'Campaign not found'}</div>
    {:else}

      <!-- Header -->
      <div class="flex-between" style="margin-bottom:1.5rem;">
        <div>
          <a href="/dashboard" style="font-family:var(--font-heading); font-size:0.72rem;
            letter-spacing:0.1em; text-transform:uppercase; color:var(--text-muted);">
            ← Dashboard
          </a>
          <h1 style="font-size:1.7rem; color:var(--gold); margin-top:0.25rem;">{campaign.name}</h1>
        </div>
      </div>

      {#if error}<div class="alert alert-error">{error}</div>{/if}

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" class:active={activeTab==='overview'} on:click={() => activeTab='overview'}>
          Overview
        </button>
        <button class="tab-btn" class:active={activeTab==='players'} on:click={() => activeTab='players'}>
          Adventurers ({campaign.players.length})
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
            <label>Description</label>
            <textarea bind:value={description} rows="5" placeholder="A chronicle of the adventure ahead…"></textarea>
          </div>
          <button class="btn btn-primary" on:click={saveOverview} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      {/if}

      <!-- ── Players ──────────────────────────────────────────────────────── -->
      {#if activeTab === 'players'}
        <div class="section-header">
          <h2 class="section-title">Adventurers</h2>
          <button class="btn btn-primary btn-sm" on:click={openNewPlayer}>+ Add Adventurer</button>
        </div>

        <!-- New player inline form -->
        {#if newPlayerOpen}
          <div class="card" style="margin-bottom:1.5rem; border-color:var(--gold-dim);">
            <h3 class="card-title" style="margin-bottom:1rem;">New Adventurer</h3>
            <div class="grid-2">
              <div class="field"><label>Name *</label><input bind:value={playerForm.name} /></div>
              <div class="field"><label>Level</label><input type="number" min="1" max="20" bind:value={playerForm.level} /></div>
              <div class="field">
                <label>Race</label>
                <select bind:value={playerForm.race}>
                  <option value="">— select race —</option>
                  {#each DND_RACES as r}<option value={r}>{r}</option>{/each}
                </select>
              </div>
              <div class="field">
                <label>Class</label>
                <select bind:value={playerForm.class}>
                  <option value="">— select class —</option>
                  {#each DND_CLASSES as c}<option value={c}>{c}</option>{/each}
                </select>
              </div>
              <div class="field"><label>Subclass</label><input bind:value={playerForm.subclass} /></div>
              <div class="field"><label>Background</label><input bind:value={playerForm.background} /></div>
              <div class="field" style="grid-column:1/-1;">
                <label>Alignment</label>
                <div class="alignment-grid">
                  {#each ALIGNMENTS as row}
                    {#each row as al}
                      <button type="button" class="align-btn" class:selected={playerForm.alignment === al}
                        on:click={() => playerForm.alignment = al}>{al}</button>
                    {/each}
                  {/each}
                </div>
              </div>
            </div>

            <p style="font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.08em;
              text-transform:uppercase; color:var(--text-muted); margin:1rem 0 0.5rem;">Ability Scores</p>
            <div class="grid-6">
              {#each STATS as stat}
                <div class="field" style="text-align:center;">
                  <label>{stat}</label>
                  <input type="number" min="1" max="30" bind:value={playerForm.stats[stat]}
                    style="text-align:center;" />
                </div>
              {/each}
            </div>

            <p style="font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.08em;
              text-transform:uppercase; color:var(--text-muted); margin:1rem 0 0.5rem;">Combat</p>
            <div class="grid-3">
              <div class="field"><label>HP Max</label><input type="number" bind:value={playerForm.combat.hpMax} /></div>
              <div class="field"><label>HP Current</label><input type="number" bind:value={playerForm.combat.hpCurrent} /></div>
              <div class="field"><label>Temp HP</label><input type="number" bind:value={playerForm.combat.tempHp} /></div>
              <div class="field"><label>AC</label><input type="number" bind:value={playerForm.combat.AC} /></div>
              <div class="field"><label>Speed (ft)</label><input type="number" bind:value={playerForm.combat.speed} /></div>
              <div class="field"><label>Initiative Mod</label><input type="number" bind:value={playerForm.combat.initiativeMod} /></div>
              <div class="field"><label>Hit Dice</label><input bind:value={playerForm.combat.hitDice} placeholder="1d8" /></div>
            </div>

            <div class="flex gap-1 mt-2">
              <button class="btn btn-primary" on:click={savePlayer} disabled={saving || !playerForm.name.trim()}>
                {saving ? 'Saving…' : 'Add Adventurer'}
              </button>
              <button class="btn btn-ghost" on:click={closePlayer}>Cancel</button>
            </div>
          </div>
        {/if}

        {#if campaign.players.length === 0 && !newPlayerOpen}
          <div class="card" style="text-align:center; padding:2rem;">
            <p class="text-muted" style="font-family:var(--font-body); font-style:italic;">No adventurers yet. Add your party!</p>
          </div>
        {:else}
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            {#each campaign.players as player (player._id)}
              <div
                class="item-row"
                class:expanded={expandedPlayerId === player._id}
                on:click={() => openEditPlayer(player)}
              >
                <!-- Summary row -->
                <div class="item-row-header">
                  <div>
                    <div class="flex-center gap-1" style="margin-bottom:0.2rem;">
                      <span style="font-family:var(--font-heading); font-size:0.95rem; font-weight:600;">
                        {player.name}
                      </span>
                      <span class="badge badge-gold">Lv {player.level}</span>
                      {#if player.class}
                        <span class="text-muted text-sm" style="font-family:var(--font-body);">
                          {player.race} {player.class}
                        </span>
                      {/if}
                    </div>
                    <div class="text-sm text-muted" style="font-family:var(--font-body);">
                      HP {player.combat.hpCurrent}/{player.combat.hpMax}
                      &nbsp;·&nbsp; AC {player.combat.AC}
                      &nbsp;·&nbsp; Speed {player.combat.speed} ft
                      {#if player.stats}
                        &nbsp;·&nbsp;
                        {STATS.map(s => `${s} ${statMod(player.stats[s] ?? 10)}`).join(' ')}
                      {/if}
                    </div>
                  </div>
                  <span class="item-row-edit-hint">Click to edit</span>
                </div>

                <!-- Expanded inline edit form -->
                {#if expandedPlayerId === player._id}
                  <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-muted);"
                       on:click|stopPropagation>

                    <div class="grid-2">
                      <div class="field"><label>Name *</label><input bind:value={playerForm.name} /></div>
                      <div class="field"><label>Level</label><input type="number" min="1" max="20" bind:value={playerForm.level} /></div>
                      <div class="field">
                        <label>Race</label>
                        <select bind:value={playerForm.race}>
                          <option value="">— select race —</option>
                          {#each DND_RACES as r}<option value={r}>{r}</option>{/each}
                        </select>
                      </div>
                      <div class="field">
                        <label>Class</label>
                        <select bind:value={playerForm.class}>
                          <option value="">— select class —</option>
                          {#each DND_CLASSES as c}<option value={c}>{c}</option>{/each}
                        </select>
                      </div>
                      <div class="field"><label>Subclass</label><input bind:value={playerForm.subclass} /></div>
                      <div class="field"><label>Background</label><input bind:value={playerForm.background} /></div>
                      <div class="field" style="grid-column:1/-1;">
                        <label>Alignment</label>
                        <div class="alignment-grid">
                          {#each ALIGNMENTS as row}
                            {#each row as al}
                              <button type="button" class="align-btn" class:selected={playerForm.alignment === al}
                                on:click={() => playerForm.alignment = al}>{al}</button>
                            {/each}
                          {/each}
                        </div>
                      </div>
                    </div>

                    <p style="font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.08em;
                      text-transform:uppercase; color:var(--text-muted); margin:1rem 0 0.5rem;">Ability Scores</p>
                    <div class="grid-6">
                      {#each STATS as stat}
                        <div class="field" style="text-align:center;">
                          <label>{stat}</label>
                          <input type="number" min="1" max="30" bind:value={playerForm.stats[stat]}
                            style="text-align:center;" />
                        </div>
                      {/each}
                    </div>

                    <p style="font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.08em;
                      text-transform:uppercase; color:var(--text-muted); margin:1rem 0 0.5rem;">Combat</p>
                    <div class="grid-3">
                      <div class="field"><label>HP Max</label><input type="number" bind:value={playerForm.combat.hpMax} /></div>
                      <div class="field"><label>HP Current</label><input type="number" bind:value={playerForm.combat.hpCurrent} /></div>
                      <div class="field"><label>Temp HP</label><input type="number" bind:value={playerForm.combat.tempHp} /></div>
                      <div class="field"><label>AC</label><input type="number" bind:value={playerForm.combat.AC} /></div>
                      <div class="field"><label>Speed (ft)</label><input type="number" bind:value={playerForm.combat.speed} /></div>
                      <div class="field"><label>Initiative Mod</label><input type="number" bind:value={playerForm.combat.initiativeMod} /></div>
                      <div class="field"><label>Hit Dice</label><input bind:value={playerForm.combat.hitDice} placeholder="1d8" /></div>
                    </div>

                    <div class="flex gap-1 mt-2">
                      <button class="btn btn-primary btn-sm" on:click={savePlayer} disabled={saving || !playerForm.name.trim()}>
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button class="btn btn-ghost btn-sm" on:click={closePlayer}>Cancel</button>
                      <button class="btn btn-danger btn-sm" style="margin-left:auto;"
                        on:click={(e) => deletePlayer(player._id, e)}>Remove</button>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- ── Lore ─────────────────────────────────────────────────────────── -->
      {#if activeTab === 'lore'}
        <div class="section-header">
          <h2 class="section-title">Lore & Chronicles</h2>
          <button class="btn btn-primary btn-sm" on:click={openNewLore}>+ Add Entry</button>
        </div>

        <!-- New lore inline form -->
        {#if newLoreOpen}
          <div class="card" style="margin-bottom:1.5rem; border-color:var(--gold-dim);">
            <h3 class="card-title" style="margin-bottom:1rem;">New Lore Entry</h3>
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
              <label>Body</label>
              <textarea bind:value={loreForm.body} rows="5" placeholder="The chronicles tell of…"></textarea>
            </div>
            <div class="field" style="flex-direction:row; align-items:center; gap:0.5rem;">
              <input type="checkbox" id="visible-new" bind:checked={loreForm.visibleToPlayers} />
              <label for="visible-new" style="cursor:pointer; font-family:var(--font-body); font-size:0.9rem; text-transform:none; letter-spacing:0;">
                Visible to players
              </label>
            </div>
            <div class="flex gap-1 mt-2">
              <button class="btn btn-primary" on:click={saveLore} disabled={saving || !loreForm.title.trim()}>
                {saving ? 'Saving…' : 'Add Entry'}
              </button>
              <button class="btn btn-ghost" on:click={closeLore}>Cancel</button>
            </div>
          </div>
        {/if}

        {#if campaign.lore.length === 0 && !newLoreOpen}
          <div class="card" style="text-align:center; padding:2rem;">
            <p class="text-muted" style="font-family:var(--font-body); font-style:italic;">No lore entries yet.</p>
          </div>
        {:else}
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            {#each campaign.lore as entry (entry._id)}
              <div
                class="item-row"
                class:expanded={expandedLoreId === entry._id}
                on:click={() => openEditLore(entry)}
              >
                <!-- Summary row -->
                <div class="item-row-header">
                  <div style="flex:1; min-width:0;">
                    <div class="flex-center gap-1" style="margin-bottom:0.2rem;">
                      <span style="font-family:var(--font-heading); font-size:0.95rem; font-weight:600;">
                        {entry.title}
                      </span>
                      <span class="badge">{entry.category}</span>
                      {#if entry.visibleToPlayers}
                        <span class="badge badge-green">public</span>
                      {/if}
                    </div>
                    {#if entry.body}
                      <p class="text-muted text-sm" style="font-family:var(--font-body); font-style:italic;
                        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:600px;">
                        {entry.body.slice(0, 150)}
                      </p>
                    {/if}
                  </div>
                  <span class="item-row-edit-hint">Click to edit</span>
                </div>

                <!-- Expanded inline edit -->
                {#if expandedLoreId === entry._id}
                  <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-muted);"
                       on:click|stopPropagation>
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
                      <label>Body</label>
                      <textarea bind:value={loreForm.body} rows="5"></textarea>
                    </div>
                    <div class="field" style="flex-direction:row; align-items:center; gap:0.5rem;">
                      <input type="checkbox" id="visible-{entry._id}" bind:checked={loreForm.visibleToPlayers} />
                      <label for="visible-{entry._id}" style="cursor:pointer; font-family:var(--font-body);
                        font-size:0.9rem; text-transform:none; letter-spacing:0;">
                        Visible to players
                      </label>
                    </div>
                    <div class="flex gap-1 mt-2">
                      <button class="btn btn-primary btn-sm" on:click={saveLore}
                        disabled={saving || !loreForm.title.trim()}>
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button class="btn btn-ghost btn-sm" on:click={closeLore}>Cancel</button>
                      <button class="btn btn-danger btn-sm" style="margin-left:auto;"
                        on:click={(e) => deleteLore(entry._id, e)}>Delete</button>
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}

    {/if}
  </div>
</div>

<style>
  .alignment-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.3rem;
    margin-top: 0.25rem;
  }
  .align-btn {
    font-family: var(--font-heading);
    font-size: 0.68rem;
    letter-spacing: 0.02em;
    padding: 0.4rem 0.25rem;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text-muted);
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    text-align: center;
    line-height: 1.2;
  }
  .align-btn:hover { border-color: var(--gold-dim); color: var(--text); }
  .align-btn.selected {
    border-color: var(--gold);
    color: var(--gold);
    background: rgba(201,168,76,0.1);
  }
</style>
