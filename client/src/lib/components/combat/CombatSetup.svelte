<script>
  import { createEventDispatcher } from 'svelte';

  export let players    = [];
  export let monsterList = [];

  const dispatch = createEventDispatcher();

  const CR_OPTIONS = [
    { value:'all', label:'All CR' }, { value:'0', label:'CR 0' },
    { value:'1/8', label:'CR 1/8' }, { value:'1/4', label:'CR 1/4' }, { value:'1/2', label:'CR 1/2' },
    { value:'1', label:'CR 1' }, { value:'2', label:'CR 2' }, { value:'3', label:'CR 3' },
    { value:'4', label:'CR 4' }, { value:'5', label:'CR 5' }, { value:'6-9', label:'CR 6–9' },
    { value:'10-15', label:'CR 10–15' }, { value:'16+', label:'CR 16+' },
  ];
  const TYPE_OPTIONS = ['All','Aberration','Beast','Celestial','Construct','Dragon','Elemental','Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Undead'];
  const ENV_OPTIONS  = ['All','Arctic','Coastal','Desert','Forest','Grassland','Hill','Mountain','Swamp','Underdark','Underwater','Urban'];

  let selectedPlayerIds = players.map(p => p._id);
  let selectedMonsters  = [];
  let searchText        = '';
  let filterCR          = '1/4';
  let filterType        = 'Humanoid';
  let filterEnv         = 'All';

  function parseCR(cr) {
    if (cr === '1/8') return 0.125;
    if (cr === '1/4') return 0.25;
    if (cr === '1/2') return 0.5;
    return parseFloat(cr) || 0;
  }

  function matchesCR(m) {
    if (filterCR === 'all') return true;
    const crNum = parseCR(m.cr?.toString() ?? '');
    if (filterCR === '6-9')  return crNum >= 6  && crNum <= 9;
    if (filterCR === '10-15') return crNum >= 10 && crNum <= 15;
    if (filterCR === '16+')  return crNum >= 16;
    return m.cr?.toString() === filterCR;
  }

  $: filtered = monsterList.filter(m => {
    const matchSearch = !searchText || m.name.toLowerCase().includes(searchText.toLowerCase());
    const matchType   = filterType === 'All' || m.type === filterType;
    const matchEnv    = filterEnv  === 'All' || (m.environments || []).includes(filterEnv);
    return matchSearch && matchesCR(m) && matchType && matchEnv;
  }).slice(0, 40);

  function togglePlayer(id) {
    selectedPlayerIds = selectedPlayerIds.includes(id)
      ? selectedPlayerIds.filter(x => x !== id)
      : [...selectedPlayerIds, id];
  }

  function getCount(m) {
    return selectedMonsters.find(s => s.monster._id === m._id)?.count ?? 0;
  }

  function setCount(m, n) {
    const count = Math.max(0, n);
    if (count === 0) {
      selectedMonsters = selectedMonsters.filter(s => s.monster._id !== m._id);
    } else {
      const existing = selectedMonsters.find(s => s.monster._id === m._id);
      if (existing) existing.count = count;
      else selectedMonsters = [...selectedMonsters, { monster: m, count }];
      selectedMonsters = selectedMonsters; // trigger reactivity
    }
  }

  function startCombat() {
    const monsters = selectedMonsters.flatMap(({ monster, count }) =>
      Array.from({ length: count }, () => ({
        monsterId: monster._id,
        name: monster.name,
        cr: monster.cr,
        hp: monster.hp?.average ?? 10,
        ac: monster.AC ?? monster.ac ?? 10,
        stats: monster.stats,
      }))
    );
    dispatch('start', { playerIds: selectedPlayerIds, monsters });
  }
</script>

<div class="setup">
  <h2 class="setup-title">Begin Encounter</h2>

  <!-- Player selection -->
  <section class="setup-section">
    <p class="setup-label">Players</p>
    <div class="player-list">
      {#each players as p (p._id)}
        <label class="player-row">
          <input type="checkbox" checked={selectedPlayerIds.includes(p._id)}
            on:change={() => togglePlayer(p._id)} />
          <span>{p.name}</span>
          <span class="text-faint text-xs">Lv {p.level} {p.class}</span>
        </label>
      {/each}
    </div>
  </section>

  <!-- Monster selection -->
  <section class="setup-section">
    <p class="setup-label">Monsters</p>
    <div class="filter-row">
      <input bind:value={searchText} placeholder="Search monsters…" class="search-input" />
      <select bind:value={filterCR} class="filter-sel">
        {#each CR_OPTIONS as o}<option value={o.value}>{o.label}</option>{/each}
      </select>
      <select bind:value={filterType} class="filter-sel">
        {#each TYPE_OPTIONS as t}<option value={t}>{t}</option>{/each}
      </select>
      <select bind:value={filterEnv} class="filter-sel">
        {#each ENV_OPTIONS as e}<option value={e}>{e}</option>{/each}
      </select>
    </div>

    <div class="monster-list">
      {#each filtered as m (m._id ?? m.name)}
        {@const count = getCount(m)}
        <div class="monster-row" class:selected={count > 0}>
          <span class="m-name">{m.name}</span>
          <span class="m-meta text-faint text-xs">{m.type ?? ''} CR {m.cr ?? '?'}</span>
          <div class="m-counter">
            <button class="count-btn" on:click={() => setCount(m, count - 1)} disabled={count === 0}>−</button>
            <span class="count-val">{count}</span>
            <button class="count-btn" on:click={() => setCount(m, count + 1)}>+</button>
          </div>
        </div>
      {/each}
      {#if filtered.length === 0}
        <p class="text-faint text-sm" style="padding: 0.75rem; text-align: center;">No monsters match the filters.</p>
      {/if}
    </div>
  </section>

  <!-- Selected monsters summary -->
  {#if selectedMonsters.length}
    <div class="selected-summary">
      {#each selectedMonsters as { monster, count }}
        <span class="badge">{count}× {monster.name}</span>
      {/each}
    </div>
  {/if}

  <button
    class="btn btn-primary btn-full"
    on:click={startCombat}
    disabled={selectedPlayerIds.length === 0}
  >
    Roll Initiative
  </button>
</div>

<style>
  .setup { display: flex; flex-direction: column; gap: 1rem; }

  .setup-title {
    font-size: 1rem;
    font-weight: 700;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .setup-section { display: flex; flex-direction: column; gap: 0.5rem; }

  .setup-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .player-list { display: flex; flex-direction: column; gap: 0.25rem; }
  .player-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .player-row:hover { background: var(--surface-2); }
  .player-row input[type="checkbox"] { accent-color: var(--accent); }
  .player-row span:last-child { margin-left: auto; }

  .filter-row { display: flex; gap: 0.375rem; flex-wrap: wrap; }
  .search-input { flex: 1; min-width: 140px; font-size: 0.8125rem; }
  .filter-sel   { flex: 0 1 auto; font-size: 0.8125rem; min-width: 80px; }

  .monster-list {
    max-height: 280px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .monster-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.625rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .monster-row:last-child { border-bottom: none; }
  .monster-row.selected { background: var(--surface-2); }

  .m-name { flex: 1; font-size: 0.8125rem; font-weight: 500; }
  .m-meta { flex-shrink: 0; }

  .m-counter { display: flex; align-items: center; gap: 0.25rem; }
  .count-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 22px; height: 22px;
    font-size: 0.875rem;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .count-btn:hover:not(:disabled) { border-color: var(--border-strong); }
  .count-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .count-val { font-size: 0.8125rem; font-weight: 600; min-width: 1.25em; text-align: center; }

  .selected-summary { display: flex; flex-wrap: wrap; gap: 0.375rem; }
</style>
