<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import localMonsters from '$lib/data/monsters.json';

  export let players = [];        // campaign players array
  export let monsterList = [];    // monsters from API (if available)

  const dispatch = createEventDispatcher();

  // ── State ────────────────────────────────────────────────────────────────
  let selectedPlayerIds = players.map(p => p._id);  // all selected by default
  let selectedMonsters = [];   // [{ monster, count }]
  let searchText = '';
  let filterCR = 'all';
  let filterType = 'all';
  let filterEnv = 'all';

  // Use API list if provided, otherwise local SRD data
  $: allMonsters = monsterList.length ? monsterList : localMonsters;

  const CR_OPTIONS = [
    { value: 'all', label: 'All CR' },
    { value: '0', label: 'CR 0' },
    { value: '1/8', label: 'CR 1/8' },
    { value: '1/4', label: 'CR 1/4' },
    { value: '1/2', label: 'CR 1/2' },
    { value: '1', label: 'CR 1' },
    { value: '2', label: 'CR 2' },
    { value: '3', label: 'CR 3' },
    { value: '4', label: 'CR 4' },
    { value: '5', label: 'CR 5' },
    { value: '6-9', label: 'CR 6–9' },
    { value: '10-15', label: 'CR 10–15' },
    { value: '16+', label: 'CR 16+' },
  ];

  const TYPE_OPTIONS = [
    'All', 'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon',
    'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity',
    'Ooze', 'Plant', 'Undead',
  ];

  const ENV_OPTIONS = [
    'All', 'Arctic', 'Coastal', 'Desert', 'Forest', 'Grassland',
    'Hill', 'Mountain', 'Swamp', 'Underdark', 'Underwater', 'Urban',
  ];

  // ── Filtering ────────────────────────────────────────────────────────────
  function matchesCR(m) {
    if (filterCR === 'all') return true;
    const cr = m.cr?.toString() ?? '';
    const crNum = m.crNum ?? parseCR(cr);
    if (filterCR === '6-9')  return crNum >= 6  && crNum <= 9;
    if (filterCR === '10-15') return crNum >= 10 && crNum <= 15;
    if (filterCR === '16+')  return crNum >= 16;
    return cr === filterCR;
  }

  function parseCR(cr) {
    if (cr === '1/8') return 0.125;
    if (cr === '1/4') return 0.25;
    if (cr === '1/2') return 0.5;
    return parseFloat(cr) || 0;
  }

  $: filtered = allMonsters.filter(m => {
    const matchSearch = !searchText || m.name.toLowerCase().includes(searchText.toLowerCase());
    const matchType   = filterType === 'all' || filterType === 'All' || m.type === filterType;
    const matchEnv    = filterEnv === 'all'  || filterEnv === 'All'  || (m.environments || []).includes(filterEnv);
    return matchSearch && matchesCR(m) && matchType && matchEnv;
  }).slice(0, 40);

  // ── Selection logic ──────────────────────────────────────────────────────
  function togglePlayer(id) {
    selectedPlayerIds = selectedPlayerIds.includes(id)
      ? selectedPlayerIds.filter(x => x !== id)
      : [...selectedPlayerIds, id];
  }

  function getMonsterCount(m) {
    return selectedMonsters.find(x => x.monster._id === m._id)?.count ?? 0;
  }

  function setMonsterCount(m, delta) {
    const existing = selectedMonsters.find(x => x.monster._id === m._id);
    if (existing) {
      const newCount = existing.count + delta;
      if (newCount <= 0) {
        selectedMonsters = selectedMonsters.filter(x => x.monster._id !== m._id);
      } else {
        existing.count = newCount;
        selectedMonsters = [...selectedMonsters];
      }
    } else if (delta > 0) {
      selectedMonsters = [...selectedMonsters, { monster: m, count: 1 }];
    }
  }

  function removeFromEncounter(mId) {
    selectedMonsters = selectedMonsters.filter(x => x.monster._id !== mId);
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  function startCombat() {
    dispatch('start', {
      playerIds: selectedPlayerIds,
      monsters: selectedMonsters.map(x => ({
        monsterId: x.monster._id,
        name: x.monster.name,
        count: x.count,
      })),
    });
  }

  $: totalXP = selectedMonsters.reduce((sum, x) => sum + (crToXP(x.monster.cr) * x.count), 0);

  function crToXP(cr) {
    const table = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700,
      '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900 };
    return table[String(cr)] ?? (parseFloat(cr) || 0) * 1000;
  }

  $: canStart = selectedPlayerIds.length > 0 || selectedMonsters.length > 0;
</script>

<div class="modal-backdrop" on:click={() => dispatch('close')}>
  <div class="modal" style="max-width:860px;" on:click|stopPropagation>

    <!-- Header -->
    <div class="modal-header">
      <h2>Assemble the Encounter</h2>
      <button class="btn btn-ghost btn-sm" on:click={() => dispatch('close')}>✕</button>
    </div>

    <!-- Body -->
    <div class="modal-body" style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; min-height:0;">

      <!-- ── Left: Party selection ────────────────────────────────────────── -->
      <div style="display:flex; flex-direction:column; gap:0.75rem;">
        <p style="font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.1em;
          text-transform:uppercase; color:var(--gold); margin-bottom:0.25rem;">
          The Party
        </p>

        {#if players.length === 0}
          <p class="text-muted text-sm" style="font-style:italic;">No adventurers in this campaign.</p>
        {:else}
          {#each players as p (p._id)}
            {@const selected = selectedPlayerIds.includes(p._id)}
            <div
              class="player-card"
              class:selected
              on:click={() => togglePlayer(p._id)}
            >
              <!-- Avatar initials -->
              <div class="avatar">{p.name.slice(0,2).toUpperCase()}</div>

              <div style="flex:1; min-width:0;">
                <div style="font-family:var(--font-heading); font-size:0.88rem; font-weight:600; color:var(--text);">
                  {p.name}
                </div>
                <div style="font-family:var(--font-body); font-size:0.8rem; color:var(--text-muted);">
                  Lv {p.level} {p.race} {p.class}
                </div>
                <div style="display:flex; gap:0.75rem; margin-top:0.2rem; font-family:var(--font-heading);
                  font-size:0.68rem; letter-spacing:0.04em; color:var(--text-muted);">
                  <span>HP {p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0}</span>
                  <span>AC {p.combat?.AC ?? 10}</span>
                </div>
              </div>

              {#if selected}
                <div class="check-badge">✓</div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      <!-- ── Right: Enemy search ──────────────────────────────────────────── -->
      <div style="display:flex; flex-direction:column; gap:0.75rem; min-height:0;">
        <p style="font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.1em;
          text-transform:uppercase; color:var(--gold); margin-bottom:0.25rem;">
          Enemies
        </p>

        <!-- Filter toolbar -->
        <div class="filter-bar">
          <input
            class="filter-input"
            bind:value={searchText}
            placeholder="Search by name…"
          />
          <select class="filter-select" bind:value={filterCR}>
            {#each CR_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
          <select class="filter-select" bind:value={filterType}>
            {#each TYPE_OPTIONS as t}
              <option value={t === 'All' ? 'all' : t}>{t}</option>
            {/each}
          </select>
          <select class="filter-select" bind:value={filterEnv}>
            {#each ENV_OPTIONS as e}
              <option value={e === 'All' ? 'all' : e}>{e}</option>
            {/each}
          </select>
        </div>

        <!-- Monster grid -->
        <div class="monster-grid">
          {#if filtered.length === 0}
            <p class="text-muted text-sm" style="font-style:italic; grid-column:1/-1; padding:1rem 0;">
              No creatures match the current filters.
            </p>
          {:else}
            {#each filtered as m (m._id)}
              {@const count = getMonsterCount(m)}
              <div class="monster-card" class:has-count={count > 0}>
                {#if count > 0}
                  <div class="count-badge">{count}</div>
                {/if}
                <div style="font-family:var(--font-heading); font-size:0.82rem; font-weight:600;
                  margin-bottom:0.25rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  {m.name}
                </div>
                <div style="display:flex; gap:0.35rem; flex-wrap:wrap; margin-bottom:0.4rem;">
                  <span class="badge badge-gold" style="font-size:0.6rem;">CR {m.cr}</span>
                  <span class="badge" style="font-size:0.6rem;">{m.type}</span>
                </div>
                <div style="font-family:var(--font-body); font-size:0.78rem; color:var(--text-muted); margin-bottom:0.5rem;">
                  HP {m.hp} · AC {m.ac}
                </div>
                <!-- Quantity stepper -->
                <div class="stepper">
                  <button class="step-btn" on:click|stopPropagation={() => setMonsterCount(m, -1)}
                    disabled={count === 0}>−</button>
                  <span class="step-count">{count}</span>
                  <button class="step-btn" on:click|stopPropagation={() => setMonsterCount(m, 1)}>+</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>

    <!-- Encounter summary -->
    {#if selectedMonsters.length > 0}
      <div class="encounter-summary">
        <span style="font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.08em;
          text-transform:uppercase; color:var(--gold-dim);">Encounter:</span>
        {#each selectedMonsters as x}
          <div class="enc-item">
            <span>{x.monster.name} ×{x.count}</span>
            <button class="enc-remove" on:click={() => removeFromEncounter(x.monster._id)}>✕</button>
          </div>
        {/each}
        <span style="font-family:var(--font-heading); font-size:0.72rem; color:var(--text-muted); margin-left:auto;">
          ~{totalXP.toLocaleString()} XP
        </span>
      </div>
    {/if}

    <!-- Footer -->
    <div class="modal-footer">
      <button class="btn btn-ghost" on:click={() => dispatch('close')}>Cancel</button>
      <button class="btn btn-primary" on:click={startCombat} disabled={!canStart}>
        Roll Initiative &amp; Begin
      </button>
    </div>
  </div>
</div>

<style>
  /* ── Player cards ─────────────────────────────────────────────────────── */
  .player-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative;
    user-select: none;
  }
  .player-card:hover { border-color: var(--gold-dim); }
  .player-card.selected {
    border-color: var(--gold);
    box-shadow: 0 0 0 1px rgba(201,168,76,0.3);
    background: rgba(201,168,76,0.07);
  }

  .avatar {
    width: 36px; height: 36px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading);
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--gold-dim);
    flex-shrink: 0;
  }

  .check-badge {
    width: 20px; height: 20px;
    background: var(--gold);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 700; color: var(--bg);
    flex-shrink: 0;
  }

  /* ── Filter bar ───────────────────────────────────────────────────────── */
  .filter-bar {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  .filter-input {
    flex: 1;
    min-width: 120px;
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: 0.4rem 0.6rem;
    font-family: var(--font-body);
    font-size: 0.85rem;
  }
  .filter-input:focus { outline: none; border-color: var(--gold-dim); }

  .filter-select {
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: 0.4rem 0.5rem;
    font-family: var(--font-heading);
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    cursor: pointer;
  }
  .filter-select:focus { outline: none; border-color: var(--gold-dim); }

  /* ── Monster grid ─────────────────────────────────────────────────────── */
  .monster-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    overflow-y: auto;
    max-height: 340px;
    padding-right: 2px;
  }

  .monster-card {
    position: relative;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: 0.6rem 0.75rem;
    transition: border-color 0.2s;
  }
  .monster-card.has-count {
    border-color: var(--gold-dim);
    background: rgba(201,168,76,0.05);
  }

  .count-badge {
    position: absolute;
    top: -6px; right: -6px;
    background: var(--gold);
    color: var(--bg);
    width: 18px; height: 18px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading);
    font-size: 0.65rem;
    font-weight: 700;
  }

  /* ── Stepper ──────────────────────────────────────────────────────────── */
  .stepper {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .step-btn {
    width: 22px; height: 22px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.9rem;
    font-family: var(--font-heading);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s;
    flex-shrink: 0;
  }
  .step-btn:hover:not(:disabled) { border-color: var(--gold-dim); color: var(--gold); }
  .step-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .step-count {
    font-family: var(--font-heading);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--gold);
    width: 18px;
    text-align: center;
  }

  /* ── Encounter summary ────────────────────────────────────────────────── */
  .encounter-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.65rem 1.25rem;
    border-top: 1px solid var(--border-muted);
    background: var(--surface-2);
  }

  .enc-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: var(--surface-3);
    border: 1px solid var(--border-muted);
    border-radius: 999px;
    padding: 0.15rem 0.5rem 0.15rem 0.75rem;
    font-family: var(--font-heading);
    font-size: 0.72rem;
    color: var(--text);
  }
  .enc-remove {
    background: none; border: none; color: var(--text-muted); cursor: pointer;
    font-size: 0.65rem; padding: 0; line-height: 1;
  }
  .enc-remove:hover { color: var(--danger); }
</style>
