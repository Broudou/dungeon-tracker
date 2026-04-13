<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const id = $page.params.id;

  const STATS       = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
  const DND_RACES   = ['Dragonborn','Dwarf','Elf','Gnome','Half-Elf','Half-Orc','Halfling','Human','Tiefling'];
  const DND_CLASSES = ['Artificer','Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
  const ALIGNMENTS  = [['Lawful Good','Neutral Good','Chaotic Good'],['Lawful Neutral','True Neutral','Chaotic Neutral'],['Lawful Evil','Neutral Evil','Chaotic Evil']];
  let campaign   = null;
  let loading    = true;
  let saving     = false;
  let error      = '';
  let activeTab  = 'overview';

  // Overview
  let name = '', description = '';

  // Players
  let expandedPlayerId = null;
  let newPlayerOpen    = false;
  let playerForm       = freshPlayer();
  let editingPlayer    = null;

  function freshPlayer() {
    return {
      name: '', race: '', class: '', subclass: '', background: '',
      alignment: '', level: 1,
      stats:  { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      combat: { hpMax: 0, hpCurrent: 0, tempHp: 0, AC: 10, speed: 30, initiativeMod: 0, hitDice: '' },
    };
  }

  function statMod(score) {
    const m = Math.floor((score - 10) / 2);
    return (m >= 0 ? '+' : '') + m;
  }

  onMount(load);

  async function load() {
    loading = true;
    try {
      const res = await fetch(`/api/campaigns/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
      campaign    = await res.json();
      name        = campaign.name;
      description = campaign.description || '';
    } catch (e) { error = e.message; }
    finally { loading = false; }
  }

  // ── Overview ────────────────────────────────────────────────────────────────
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

  // ── Players ─────────────────────────────────────────────────────────────────
  function openEditPlayer(p, e) {
    e?.stopPropagation();
    expandedPlayerId = p._id;
    editingPlayer    = p;
    playerForm       = JSON.parse(JSON.stringify(p));
    newPlayerOpen    = false;
  }

  function closePlayer() { expandedPlayerId = null; editingPlayer = null; newPlayerOpen = false; }

  function openNewPlayer() {
    expandedPlayerId = null; editingPlayer = null;
    playerForm = freshPlayer(); newPlayerOpen = true;
  }

  async function savePlayer() {
    saving = true; error = '';
    try {
      let res, data;
      if (editingPlayer) {
        res  = await fetch(`/api/campaigns/${id}/players/${editingPlayer._id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(playerForm),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.message);
        campaign.players = campaign.players.map(p => p._id === editingPlayer._id ? data : p);
      } else {
        res  = await fetch(`/api/campaigns/${id}/players`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(playerForm),
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
      const res = await fetch(`/api/campaigns/${id}/players/${playerId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
      campaign.players = campaign.players.filter(p => p._id !== playerId);
      if (expandedPlayerId === playerId) closePlayer();
    } catch (e) { error = e.message; }
  }

</script>

<svelte:head><title>{campaign?.name ?? 'Campaign'} — Dungeon Tracker</title></svelte:head>

<div class="page">
  <div class="container">

    {#if loading}
      <div class="loading">Loading campaign…</div>
    {:else if !campaign}
      <div class="alert alert-error">{error || 'Campaign not found.'}</div>
    {:else}

      <!-- Header -->
      <div class="flex-between" style="margin-bottom: 1.25rem;">
        <div>
          <a href="/dashboard" class="back-link">← Dashboard</a>
          <h1 style="margin-top: 0.2rem;">{campaign.name}</h1>
        </div>
      </div>

      {#if error}<div class="alert alert-error">{error}</div>{/if}

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn" class:active={activeTab==='overview'} on:click={() => activeTab='overview'}>Overview</button>
        <button class="tab-btn" class:active={activeTab==='players'} on:click={() => activeTab='players'}>
          Adventurers ({campaign.players.length})
        </button>
      </div>

      <!-- ── Overview ──────────────────────────────────────────────────────── -->
      {#if activeTab === 'overview'}
        <div class="card" style="max-width: 600px;">
          <div class="field">
            <label>Campaign name</label>
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

      <!-- ── Players ───────────────────────────────────────────────────────── -->
      {#if activeTab === 'players'}
        <div class="section-header">
          <span class="section-title">Adventurers</span>
          <button class="btn btn-primary btn-sm" on:click={openNewPlayer}>+ Add Adventurer</button>
        </div>

        <!-- New player form -->
        {#if newPlayerOpen}
          <div class="card mb-md">
            <h3 style="margin-bottom: 1rem; font-size: 0.875rem; font-weight: 600;">New Adventurer</h3>
            <!-- Inline player form -->
            <div class="grid-2">
              <div class="field"><label>Name *</label><input bind:value={playerForm.name} /></div>
              <div class="field"><label>Level</label><input type="number" min="1" max="20" bind:value={playerForm.level} /></div>
              <div class="field">
                <label>Race</label>
                <select bind:value={playerForm.race}>
                  <option value="">— select —</option>
                  {#each DND_RACES as r}<option value={r}>{r}</option>{/each}
                </select>
              </div>
              <div class="field">
                <label>Class</label>
                <select bind:value={playerForm.class}>
                  <option value="">— select —</option>
                  {#each DND_CLASSES as c}<option value={c}>{c}</option>{/each}
                </select>
              </div>
              <div class="field"><label>Subclass</label><input bind:value={playerForm.subclass} /></div>
              <div class="field"><label>Background</label><input bind:value={playerForm.background} /></div>
              <div class="field" style="grid-column: 1/-1;">
                <label>Alignment</label>
                <div class="align-grid">
                  {#each ALIGNMENTS as row}
                    {#each row as al}
                      <button type="button" class="align-btn" class:selected={playerForm.alignment === al}
                        on:click={() => playerForm.alignment = al}>{al}</button>
                    {/each}
                  {/each}
                </div>
              </div>
            </div>

            <p class="subsection-label">Ability Scores</p>
            <div class="grid-6">
              {#each STATS as stat}
                <div class="field" style="text-align: center;">
                  <label>{stat}</label>
                  <input type="number" min="1" max="30" bind:value={playerForm.stats[stat]} style="text-align: center;" />
                </div>
              {/each}
            </div>

            <p class="subsection-label">Combat</p>
            <div class="grid-3">
              <div class="field"><label>HP Max</label><input type="number" bind:value={playerForm.combat.hpMax} /></div>
              <div class="field"><label>HP Current</label><input type="number" bind:value={playerForm.combat.hpCurrent} /></div>
              <div class="field"><label>Temp HP</label><input type="number" bind:value={playerForm.combat.tempHp} /></div>
              <div class="field"><label>AC</label><input type="number" bind:value={playerForm.combat.AC} /></div>
              <div class="field"><label>Speed (ft)</label><input type="number" bind:value={playerForm.combat.speed} /></div>
              <div class="field"><label>Initiative Mod</label><input type="number" bind:value={playerForm.combat.initiativeMod} /></div>
              <div class="field"><label>Hit Dice</label><input bind:value={playerForm.combat.hitDice} placeholder="1d8" /></div>
            </div>

            <div class="flex-center gap-sm mt-md">
              <button class="btn btn-primary" on:click={savePlayer} disabled={saving || !playerForm.name.trim()}>
                {saving ? 'Saving…' : 'Add Adventurer'}
              </button>
              <button class="btn btn-ghost" on:click={closePlayer}>Cancel</button>
            </div>
          </div>
        {/if}

        {#if campaign.players.length === 0 && !newPlayerOpen}
          <div class="empty-card">No adventurers yet. Add your party!</div>
        {:else}
          <div class="list">
            {#each campaign.players as player (player._id)}
              <div
                class="item-row"
                class:expanded={expandedPlayerId === player._id}
                on:click={() => openEditPlayer(player)}
                role="button" tabindex="0"
                on:keydown={e => e.key === 'Enter' && openEditPlayer(player)}
              >
                <div class="item-row-header">
                  <div>
                    <div class="flex-center gap-xs mb-sm">
                      <span class="player-name">{player.name}</span>
                      <span class="badge">Lv {player.level}</span>
                      {#if player.class}
                        <span class="text-muted text-sm">{player.race} {player.class}</span>
                      {/if}
                    </div>
                    <div class="text-sm text-muted">
                      HP {player.combat.hpCurrent}/{player.combat.hpMax}
                      &nbsp;·&nbsp; AC {player.combat.AC}
                      &nbsp;·&nbsp; Spd {player.combat.speed}ft
                      {#if player.stats}
                        &nbsp;·&nbsp;{STATS.map(s => `${s} ${statMod(player.stats[s] ?? 10)}`).join(' ')}
                      {/if}
                    </div>
                  </div>
                  <span class="item-row-hint">Edit</span>
                </div>

                {#if expandedPlayerId === player._id}
                  <div class="expand-form" on:click|stopPropagation role="presentation">
                    <div class="grid-2">
                      <div class="field"><label>Name *</label><input bind:value={playerForm.name} /></div>
                      <div class="field"><label>Level</label><input type="number" min="1" max="20" bind:value={playerForm.level} /></div>
                      <div class="field">
                        <label>Race</label>
                        <select bind:value={playerForm.race}>
                          <option value="">— select —</option>
                          {#each DND_RACES as r}<option value={r}>{r}</option>{/each}
                        </select>
                      </div>
                      <div class="field">
                        <label>Class</label>
                        <select bind:value={playerForm.class}>
                          <option value="">— select —</option>
                          {#each DND_CLASSES as c}<option value={c}>{c}</option>{/each}
                        </select>
                      </div>
                      <div class="field"><label>Subclass</label><input bind:value={playerForm.subclass} /></div>
                      <div class="field"><label>Background</label><input bind:value={playerForm.background} /></div>
                      <div class="field" style="grid-column: 1/-1;">
                        <label>Alignment</label>
                        <div class="align-grid">
                          {#each ALIGNMENTS as row}
                            {#each row as al}
                              <button type="button" class="align-btn" class:selected={playerForm.alignment === al}
                                on:click={() => playerForm.alignment = al}>{al}</button>
                            {/each}
                          {/each}
                        </div>
                      </div>
                    </div>

                    <p class="subsection-label">Ability Scores</p>
                    <div class="grid-6">
                      {#each STATS as stat}
                        <div class="field" style="text-align: center;">
                          <label>{stat}</label>
                          <input type="number" min="1" max="30" bind:value={playerForm.stats[stat]} style="text-align: center;" />
                        </div>
                      {/each}
                    </div>

                    <p class="subsection-label">Combat</p>
                    <div class="grid-3">
                      <div class="field"><label>HP Max</label><input type="number" bind:value={playerForm.combat.hpMax} /></div>
                      <div class="field"><label>HP Current</label><input type="number" bind:value={playerForm.combat.hpCurrent} /></div>
                      <div class="field"><label>Temp HP</label><input type="number" bind:value={playerForm.combat.tempHp} /></div>
                      <div class="field"><label>AC</label><input type="number" bind:value={playerForm.combat.AC} /></div>
                      <div class="field"><label>Speed (ft)</label><input type="number" bind:value={playerForm.combat.speed} /></div>
                      <div class="field"><label>Initiative Mod</label><input type="number" bind:value={playerForm.combat.initiativeMod} /></div>
                      <div class="field"><label>Hit Dice</label><input bind:value={playerForm.combat.hitDice} placeholder="1d8" /></div>
                    </div>

                    <div class="flex-center gap-sm mt-md">
                      <button class="btn btn-primary btn-sm" on:click={savePlayer} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button class="btn btn-ghost btn-sm" on:click={closePlayer}>Cancel</button>
                      <button class="btn btn-danger btn-sm" style="margin-left: auto;"
                        on:click={e => deletePlayer(player._id, e)}>Remove</button>
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
  .back-link {
    font-size: 0.8125rem;
    color: var(--text-muted);
    text-decoration: none;
  }
  .back-link:hover { color: var(--text); text-decoration: underline; }

  .player-name { font-weight: 600; }

  .list { display: flex; flex-direction: column; gap: 0.5rem; }

  .expand-form {
    margin-top: 0.875rem;
    padding-top: 0.875rem;
    border-top: 1px solid var(--border);
  }

  .subsection-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 0.875rem 0 0.5rem;
  }

  /* 3×3 alignment grid */
  .align-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
    margin-top: 0.25rem;
  }

  .align-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.3rem 0.25rem;
    font-family: inherit;
    font-size: 0.75rem;
    color: var(--text-muted);
    cursor: pointer;
    text-align: center;
    transition: all 0.1s;
  }
  .align-btn:hover { border-color: var(--border-strong); color: var(--text); }
  .align-btn.selected {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .empty-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 2rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
    box-shadow: var(--shadow-sm);
  }

  .mb-md { margin-bottom: 1rem; }
  .mt-md { margin-top: 0.875rem; }
</style>
