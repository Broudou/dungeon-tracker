<script>
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';

  export let players    = [];
  export let myCharId   = null;
  export let isDM       = false;
  export let allSpells  = [];
  export let campaignId = null;

  const dispatch = createEventDispatcher();

  let selectedCharId  = null;
  let expanded        = new Set();
  let editingStats    = false;
  let statsForm       = {};
  let statsSaving     = false;
  let addSpellOpen    = false;
  let spellSearch     = '';

  const STATS = ['STR','DEX','CON','INT','WIS','CHA'];

  $: if (!selectedCharId) {
    selectedCharId = isDM ? (players[0]?._id ?? null) : myCharId;
  }

  $: selectedChar = players.find(p => p._id === selectedCharId) ?? null;

  $: spellGroups = groupByLevel(
    (selectedChar?.knownSpells ?? []).filter(s => s && s.name)
  );

  $: filteredAllSpells = allSpells.filter(s =>
    !spellSearch || s.name.toLowerCase().includes(spellSearch.toLowerCase())
  );

  function groupBySchool(spells) {
    const groups = {};
    for (const s of spells) {
      const school = s.school ?? 'Unknown';
      if (!groups[school]) groups[school] = [];
      groups[school].push(s);
    }
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([school, list]) => ({ school, list }));
  }

  $: knownSpellIds = new Set((selectedChar?.knownSpells ?? []).map(s => s._id ?? s));

  const HALF_CASTERS             = new Set(['Paladin', 'Ranger', 'Artificer']);
  const FULL_CASTER_SLOT_CLASSES = new Set(['Wizard', 'Sorcerer', 'Cleric', 'Druid', 'Bard']);

  // Slot counts [1st…9th] indexed by character level 1–20
  const FULL_CASTER_SLOTS = [
    null,
    [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
    [4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
    [4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],
    [4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],
    [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
  ];
  // Slot counts [1st…5th] indexed by character level 1–20
  const HALF_CASTER_SLOTS = [
    null,
    [0,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],
    [4,2,0,0,0],[4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],
    [4,3,2,0,0],[4,3,2,0,0],[4,3,3,0,0],[4,3,3,0,0],
    [4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],[4,3,3,2,0],
    [4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2],
  ];

  function warlockPactLevel(lvl) {
    if (lvl >= 9) return 5; if (lvl >= 7) return 4;
    if (lvl >= 5) return 3; if (lvl >= 3) return 2;
    return 1;
  }
  function warlockPactCount(lvl) {
    if (lvl >= 17) return 4; if (lvl >= 11) return 3;
    if (lvl >= 2) return 2; return 1;
  }
  function warlockArcanumLevels(lvl) {
    const a = [];
    if (lvl >= 11) a.push(6); if (lvl >= 13) a.push(7);
    if (lvl >= 15) a.push(8); if (lvl >= 17) a.push(9);
    return a;
  }
  function ordinal(n) {
    return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  }

  $: isWarlock     = selectedChar?.class === 'Warlock';
  $: showSpellSlots = FULL_CASTER_SLOT_CLASSES.has(selectedChar?.class ?? '')
                   || HALF_CASTERS.has(selectedChar?.class ?? '')
                   || isWarlock;

  function buildSlots(charClass, charLevel, existingSlots) {
    const lvl = Math.min(Math.max(charLevel ?? 1, 1), 20);
    const existing = Array.isArray(existingSlots) ? existingSlots : [];
    const expected = [];
    if (charClass === 'Warlock') {
      const pLvl = warlockPactLevel(lvl), pCnt = warlockPactCount(lvl);
      for (let i = 0; i < pCnt; i++) expected.push({ level: pLvl, index: i });
      for (const aLvl of warlockArcanumLevels(lvl)) expected.push({ level: aLvl, index: 0 });
    } else {
      const counts = FULL_CASTER_SLOT_CLASSES.has(charClass) ? FULL_CASTER_SLOTS[lvl]
                   : HALF_CASTERS.has(charClass)             ? HALF_CASTER_SLOTS[lvl]
                   : null;
      if (!counts) return [];
      counts.forEach((max, i) => {
        for (let j = 0; j < max; j++) expected.push({ level: i + 1, index: j });
      });
    }
    return expected.map(({ level, index }) => {
      const f = existing.find(s => s.level === level && s.index === index);
      return { level, index, spell: f?.spell ?? null, used: f?.used ?? false };
    });
  }

  $: activeSlots = buildSlots(selectedChar?.class, selectedChar?.level, selectedChar?.spellSlots);
  $: groupedSlots = (() => {
    const map = {};
    for (const s of activeSlots) { if (!map[s.level]) map[s.level] = []; map[s.level].push(s); }
    return Object.entries(map)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([level, slots]) => ({ level: Number(level), slots }));
  })();

  function knownSpellsUpToLevel(level) {
    return (selectedChar?.knownSpells ?? []).filter(s => s && s.name && s.level > 0 && s.level <= level);
  }
  async function saveSlots(updated) {
    if (!selectedChar) return;
    dispatch('slotUpdate', { playerId: selectedChar._id, spellSlots: updated });
    try {
      await fetch(
        `/api/campaigns/${campaignId}/players/${selectedChar._id}`,
        { method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spellSlots: updated }) }
      );
    } catch { /* silent */ }
  }
  function toggleSlotUsed(level, index) {
    saveSlots(activeSlots.map(s =>
      s.level === level && s.index === index ? { ...s, used: !s.used } : s
    ));
  }
  function setSlotSpell(level, index, spellId) {
    saveSlots(activeSlots.map(s =>
      s.level === level && s.index === index ? { ...s, spell: spellId || null } : s
    ));
  }

  function maxSpellLevel(charLevel, charClass) {
    const lvl = Math.min(charLevel ?? 1, 20);
    if (charClass === 'Warlock') {
      if (lvl >= 17) return 9; if (lvl >= 15) return 8;
      if (lvl >= 13) return 7; if (lvl >= 11) return 6;
      return warlockPactLevel(lvl);
    }
    if (HALF_CASTERS.has(charClass)) {
      const t = [0,0,1,1,2,2,2,3,3,4,4,4,5,5,5,5,5,5,5,5,5];
      return t[lvl] ?? 0;
    }
    if (FULL_CASTER_SLOT_CLASSES.has(charClass)) {
      const t = [0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9];
      return t[lvl] ?? 0;
    }
    return 0;
  }

  function isLocked(spell) {
    if (!selectedChar || spell.level === 0) return false;
    return spell.level > maxSpellLevel(selectedChar.level, selectedChar.class);
  }

  function groupByLevel(spells) {
    const groups = {};
    for (const s of spells) {
      const lvl = s.level ?? 0;
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(s);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lvl, list]) => ({ lvl: Number(lvl), list }));
  }

  function parseComponents(components = '') {
    return {
      v: /\bV\b/.test(components),
      s: /\bS\b/.test(components),
      m: /\bM\b/.test(components),
    };
  }

  function toggleSpell(id) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    expanded = next;
  }

  function levelLabel(lvl)      { return lvl === 0 ? 'Cantrips' : `Level ${lvl} Spells`; }
  function spellLevelBadge(lvl) { return lvl === 0 ? 'Cantrip' : `Lv ${lvl}`; }

  function statMod(score) {
    const m = Math.floor((score - 10) / 2);
    return (m >= 0 ? '+' : '') + m;
  }

  function startEditStats() {
    statsForm = { ...selectedChar.stats };
    editingStats = true;
  }

  async function saveStats() {
    if (!selectedChar || statsSaving) return;
    statsSaving = true;
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/players/${selectedChar._id}`,
        { method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stats: statsForm }) }
      );
      if (res.ok) {
        dispatch('statsUpdate', { playerId: selectedChar._id, stats: statsForm });
      }
    } catch { /* silent */ }
    statsSaving = false;
    editingStats = false;
  }

  function addSpell(spell) {
    if (!selectedChar) return;
    const updated = [...(selectedChar.knownSpells ?? []), spell];
    dispatch('spellsUpdate', { playerId: selectedChar._id, knownSpells: updated });
  }

  function removeSpell(spellId) {
    if (!selectedChar) return;
    const updated = (selectedChar.knownSpells ?? []).filter(s => (s._id ?? s) !== spellId);
    dispatch('spellsUpdate', { playerId: selectedChar._id, knownSpells: updated });
  }

  // ── Abilities & Traits section ───────────────────────────────────────────────
  let abilitiesOpen    = false;
  let abilitiesList    = [];
  let abilitiesLoading = false;
  let abilitiesError   = false;

  async function loadAbilities() {
    if (!selectedChar) return;
    abilitiesLoading = true;
    abilitiesError   = false;
    try {
      const cls = encodeURIComponent(selectedChar.class ?? '');
      const res = await fetch(`/api/abilities?class=${cls}`, { credentials: 'include' });
      if (!res.ok) throw new Error('fetch failed');
      abilitiesList = await res.json();
    } catch {
      abilitiesError = true;
    }
    abilitiesLoading = false;
  }

  $: if (selectedChar && abilitiesOpen) loadAbilities();
</script>

<div class="abilities-layout">

  <!-- ── Character selector (DM) ───────────────────────────────────────────── -->
  {#if isDM}
    <div class="char-selector">
      <span class="selector-label">Character</span>
      <div class="selector-pills">
        {#each players as p (p._id)}
          <button
            class="selector-pill"
            class:active={p._id === selectedCharId}
            on:click={() => { selectedCharId = p._id; expanded = new Set(); editingStats = false; addSpellOpen = false; }}
          >
            <span class="pill-av">{p.name.slice(0, 2).toUpperCase()}</span>
            <span class="pill-name">{p.name}</span>
            <span class="pill-meta">Lv {p.level} {p.class}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if !selectedChar}
    <div class="empty-state">No character found.</div>
  {:else}

    <!-- ── Identity bar ─────────────────────────────────────────────────────── -->
    <div class="char-identity">
      <div class="char-av-sm">{selectedChar.name.slice(0, 2).toUpperCase()}</div>
      <div class="char-id-info">
        <span class="char-id-name">{selectedChar.name}</span>
        <span class="char-id-meta text-muted">
          Lv {selectedChar.level}
          {[selectedChar.race, selectedChar.class, selectedChar.subclass].filter(Boolean).join(' · ')}
          — Max spell slot: <strong>
            {maxSpellLevel(selectedChar.level, selectedChar.class) || 'None'}
          </strong>
        </span>
      </div>
    </div>

    <div class="tab-body">

      <!-- ── Ability Scores section ────────────────────────────────────────── -->
      <div class="section-block">
        <div class="section-header-row">
          <span class="section-title">Ability Scores</span>
          {#if isDM && !editingStats}
            <button class="btn-inline" on:click={startEditStats}>Edit</button>
          {/if}
        </div>

        {#if editingStats}
          <div class="stat-edit-grid">
            {#each STATS as s}
              <div class="stat-edit-cell">
                <label class="stat-edit-label">{s}</label>
                <input type="number" min="1" max="30" class="stat-edit-input"
                  bind:value={statsForm[s]} />
              </div>
            {/each}
          </div>
          <div class="edit-actions">
            <button class="btn btn-primary btn-sm" on:click={saveStats} disabled={statsSaving}>
              {statsSaving ? 'Saving…' : 'Save'}
            </button>
            <button class="btn btn-ghost btn-sm" on:click={() => editingStats = false}>Cancel</button>
          </div>
        {:else}
          <div class="stat-view-grid">
            {#each STATS as s}
              {@const val = selectedChar.stats?.[s] ?? 10}
              <div class="stat-view-cell">
                <span class="stat-view-label">{s}</span>
                <span class="stat-view-val">{val}</span>
                <span class="stat-view-mod">{statMod(val)}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- ── Spell Slots section ─────────────────────────────────────────── -->
      {#if showSpellSlots}
        <div class="section-block">
          <div class="section-header-row">
            <span class="section-title">Spell Slots</span>
          </div>

          {#if groupedSlots.length === 0}
            <div class="empty-state" style="padding: 1rem 0; font-size: 0.8rem;">No spell slots at this level.</div>
          {:else}
            <div class="slot-level-groups">
              {#each groupedSlots as { level, slots } (level)}
                {@const isPact    = isWarlock && level <= 5}
                {@const isArcanum = isWarlock && level >= 6}
                <div class="slot-level-group">
                  <div class="slot-group-header">
                    <span class="slot-group-label">
                      {level}{ordinal(level)}-level
                      {#if isPact}<span class="slot-tag pact-tag">Pact Magic</span>{/if}
                      {#if isArcanum}<span class="slot-tag arcanum-tag">Mystic Arcanum</span>{/if}
                    </span>
                    <span class="slot-group-count">{slots.filter(s => !s.used).length}/{slots.length}</span>
                  </div>
                  <div class="slot-cards-grid">
                    {#each slots as slot (slot.index)}
                      {@const opts = knownSpellsUpToLevel(level)}
                      {@const spellId = typeof slot.spell === 'object' && slot.spell !== null ? slot.spell._id : (slot.spell ?? '')}
                      <div class="slot-card" class:slot-used={slot.used}>
                        <div class="slot-card-header">
                          <span class="slot-card-index">Slot {slot.index + 1}</span>
                        </div>
                        <select class="slot-card-select" value={spellId}
                          on:change={e => setSlotSpell(level, slot.index, e.target.value)}>
                          <option value="">— no spell —</option>
                          {#each opts as sp (sp._id)}
                            <option value={sp._id}>{sp.name}</option>
                          {/each}
                        </select>
                        <button class="slot-use-btn" class:used={slot.used}
                          on:click={() => toggleSlotUsed(level, slot.index)}>
                          {slot.used ? 'Expended' : 'Available'}
                        </button>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- ── Known Spells section ──────────────────────────────────────────── -->
      <div class="section-block">
        <div class="section-header-row">
          <span class="section-title">Known Spells</span>
          {#if isDM}
            <button class="btn-inline" on:click={() => { addSpellOpen = !addSpellOpen; spellSearch = ''; }}>
              {addSpellOpen ? 'Close' : '+ Add Spell'}
            </button>
          {/if}
        </div>

        <!-- Add spell panel -->
        {#if addSpellOpen && isDM}
          <div class="add-spell-panel" transition:slide={{ duration: 180 }}>
            <input
              class="spell-search-input"
              type="search"
              placeholder="Search all spells…"
              bind:value={spellSearch}
            />
            {#if filteredAllSpells.length === 0}
              <p class="empty-state" style="padding: 0.75rem 0; font-size: 0.8rem;">
                {allSpells.length === 0 ? 'No spells loaded.' : 'No matches.'}
              </p>
            {:else}
              <div class="add-spell-list">
                {#each groupBySchool(filteredAllSpells) as group (group.school)}
                  <div class="add-spell-group-label">{group.school}</div>
                  {#each group.list as spell (spell._id)}
                    {@const known = knownSpellIds.has(spell._id)}
                    <button
                      class="add-spell-row"
                      class:add-spell-known={known}
                      on:click={() => known ? removeSpell(spell._id) : addSpell(spell)}
                    >
                      <span class="add-spell-name">{spell.name}</span>
                      <span class="add-spell-level">{spell.level === 0 ? 'Cantrip' : `Lv ${spell.level}`}</span>
                      <span class="add-spell-toggle">{known ? '✓ Learned' : '+ Learn'}</span>
                    </button>
                  {/each}
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Spell groups -->
        {#if spellGroups.length === 0}
          <div class="empty-state">No learned spells.</div>
        {:else}
          <div class="spell-groups">
            {#each spellGroups as group (group.lvl)}
              <div class="spell-group">
                <div class="group-header">
                  <span class="group-label">{levelLabel(group.lvl)}</span>
                  <span class="group-count">{group.list.length}</span>
                  {#if group.lvl > 0 && group.lvl > maxSpellLevel(selectedChar.level, selectedChar.class)}
                    <span class="lock-badge">Locked</span>
                  {/if}
                </div>
                <div class="spell-cards">
                  {#each group.list as spell (spell._id)}
                    {@const locked = isLocked(spell)}
                    {@const open   = expanded.has(spell._id)}
                    {@const comps  = parseComponents(spell.components)}
                    <div class="spell-card" class:locked class:open>
                      <div class="spell-card-top">
                        <button class="spell-card-header" on:click={() => toggleSpell(spell._id)} aria-expanded={open}>
                          <div class="spell-card-left">
                            <span class="spell-level-badge">{spellLevelBadge(spell.level)}</span>
                            <span class="spell-name">{spell.name}</span>
                            {#if spell.concentration}<span class="conc-badge" title="Concentration">C</span>{/if}
                            {#if locked}<span class="locked-badge">🔒</span>{/if}
                          </div>
                          <div class="spell-card-right">
                            <div class="comp-pips">
                              {#if comps.v}<span class="comp-pip" title="Verbal">V</span>{/if}
                              {#if comps.s}<span class="comp-pip" title="Somatic">S</span>{/if}
                              {#if comps.m}<span class="comp-pip" title="Material">M</span>{/if}
                            </div>
                            <span class="expand-chevron" class:rotated={open}>›</span>
                          </div>
                        </button>
                        {#if isDM}
                          <button class="remove-spell-btn" title="Remove spell" on:click={() => removeSpell(spell._id)}>✕</button>
                        {/if}
                      </div>

                      <div class="spell-meta-row">
                        {#if spell.castingTime}<span class="meta-chip"><span class="meta-chip-label">Cast</span> {spell.castingTime}</span>{/if}
                        {#if spell.range}<span class="meta-chip"><span class="meta-chip-label">Range</span> {spell.range}</span>{/if}
                        {#if spell.duration}<span class="meta-chip"><span class="meta-chip-label">Duration</span> {spell.duration}</span>{/if}
                        {#if spell.school}<span class="meta-chip school-chip">{spell.school}</span>{/if}
                        {#if spell.damageType}<span class="meta-chip dmg-chip">{spell.damageDice ?? ''} {spell.damageType}</span>{/if}
                        {#if spell.healDice}<span class="meta-chip heal-chip">Heal {spell.healDice}</span>{/if}
                        {#if spell.saveAbility}<span class="meta-chip">{spell.saveAbility} save{spell.halfOnSave ? ' (½)' : ''}</span>{/if}
                      </div>

                      {#if open && spell.description}
                        <div class="spell-desc" transition:slide={{ duration: 180 }}>{spell.description}</div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- ── Abilities & Traits section ────────────────────────────────────── -->
      <div class="section-block">
        <div class="section-header-row">
          <span class="section-title">Abilities & Traits</span>
          <button class="btn-inline" on:click={() => { abilitiesOpen = !abilitiesOpen; }}>
            {abilitiesOpen ? 'Collapse' : 'Show'}
          </button>
        </div>

        {#if abilitiesOpen}
          <div transition:slide={{ duration: 180 }}>
            {#if abilitiesLoading}
              <p class="empty-state" style="font-size: 0.8rem;">Loading…</p>
            {:else if abilitiesError}
              <p class="empty-state" style="color: #ef4444; font-size: 0.8rem;">Failed to load abilities.</p>
            {:else if abilitiesList.length === 0}
              <p class="empty-state" style="font-size: 0.8rem;">No abilities found for {selectedChar?.class ?? 'this class'}.</p>
            {:else}
              <div class="ability-list">
                {#each abilitiesList as ab}
                  <div class="ability-row">
                    <div class="ability-row-head">
                      <span class="ability-name">{ab.name}</span>
                      <span class="ability-type-badge ability-type-{ab.type}">{ab.type}</span>
                      {#if ab.resource && ab.resource !== 'passive'}
                        <span class="ability-resource">{ab.resource}</span>
                      {/if}
                    </div>
                    <p class="ability-desc">{ab.description}</p>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .abilities-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* ── Character selector ──────────────────────────────────────────────────── */
  .char-selector {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1.25rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
  }
  .selector-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    flex-shrink: 0;
  }
  .selector-pills { display: flex; gap: 0.375rem; }
  .selector-pill {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3rem 0.625rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition: border-color 0.1s, background 0.1s;
    white-space: nowrap;
  }
  .selector-pill:hover  { background: var(--surface-3); }
  .selector-pill.active { background: var(--surface-3); border-color: var(--primary, #60a5fa); }
  .pill-av {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 700; color: var(--text-muted);
    flex-shrink: 0;
  }
  .pill-name { font-size: 0.8125rem; font-weight: 600; }
  .pill-meta { font-size: 0.7rem; color: var(--text-muted); }

  /* ── Identity bar ────────────────────────────────────────────────────────── */
  .char-identity {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
    flex-shrink: 0;
  }
  .char-av-sm {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 700; color: var(--text-muted);
    flex-shrink: 0;
  }
  .char-id-info { display: flex; flex-direction: column; gap: 1px; }
  .char-id-name { font-size: 0.9375rem; font-weight: 700; }
  .char-id-meta { font-size: 0.8rem; }

  /* ── Body scroll area ────────────────────────────────────────────────────── */
  .tab-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Section blocks ──────────────────────────────────────────────────────── */
  .section-block { display: flex; flex-direction: column; gap: 0.5rem; }

  /* ── Abilities & Traits ──────────────────────────────────────────────────── */
  .ability-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .ability-row {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md, 8px);
    padding: 0.5rem 0.75rem;
  }
  .ability-row-head { display: flex; align-items: center; gap: 0.375rem; margin-bottom: 0.25rem; flex-wrap: wrap; }
  .ability-name { font-size: 0.875rem; font-weight: 600; flex: 1; }
  .ability-type-badge {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    border-radius: 99px; padding: 1px 0.4rem; border: 1px solid;
  }
  .ability-type-ability { background: #dbeafe; border-color: #bfdbfe; color: #1e40af; }
  .ability-type-trait   { background: #f3e8ff; border-color: #e9d5ff; color: #6b21a8; }
  .ability-resource {
    font-size: 0.65rem; color: var(--text-faint);
    background: var(--surface-3); border: 1px solid var(--border);
    border-radius: 99px; padding: 1px 0.4rem;
  }
  .ability-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; margin: 0; }
  .section-header-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid var(--border);
  }
  .section-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    flex: 1;
  }
  .btn-inline {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--primary, #60a5fa);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .btn-inline:hover { text-decoration: underline; }

  /* ── Ability score view ──────────────────────────────────────────────────── */
  .stat-view-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.375rem;
  }
  .stat-view-cell {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.375rem 0.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .stat-view-label { font-size: 0.65rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; }
  .stat-view-val   { font-size: 1rem; font-weight: 700; line-height: 1.2; }
  .stat-view-mod   { font-size: 0.75rem; color: var(--text-muted); }

  /* ── Ability score edit ──────────────────────────────────────────────────── */
  .stat-edit-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.375rem;
  }
  .stat-edit-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }
  .stat-edit-label { font-size: 0.65rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; }
  .stat-edit-input {
    width: 100%;
    text-align: center;
    padding: 0.25rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
  }
  .edit-actions { display: flex; gap: 0.375rem; margin-top: 0.375rem; }

  /* ── Add spell panel ─────────────────────────────────────────────────────── */
  .add-spell-panel {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 260px;
    overflow: hidden;
  }
  .spell-search-input {
    width: 100%;
    padding: 0.3rem 0.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.8rem;
    font-family: inherit;
  }
  .add-spell-list { overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
  .add-spell-group-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-faint);
    padding: 0.25rem 0.375rem 0.125rem;
  }
  .add-spell-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: none;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
    transition: background 0.1s;
  }
  .add-spell-row:hover { background: var(--surface-3); }
  .add-spell-row.add-spell-known { background: #dcfce7; border: 1px solid #86efac; border-radius: var(--radius); }
  .add-spell-row.add-spell-known:hover { background: #bbf7d0; }
  .add-spell-name  { font-size: 0.8125rem; font-weight: 500; flex: 1; }
  .add-spell-level { font-size: 0.7rem; color: var(--text-faint); }
  .add-spell-toggle {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--primary, #60a5fa);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .add-spell-row.add-spell-known .add-spell-toggle { color: #166534; }

  /* ── Spell groups ────────────────────────────────────────────────────────── */
  .spell-groups { display: flex; flex-direction: column; gap: 1.25rem; }
  .group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid var(--border);
  }
  .group-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
  }
  .group-count {
    font-size: 0.7rem;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: 99px;
    padding: 0 0.375rem;
    color: var(--text-muted);
  }
  .lock-badge {
    font-size: 0.65rem;
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 99px;
    padding: 0 0.4rem;
    color: #92400e;
    margin-left: auto;
  }

  .spell-cards { display: flex; flex-direction: column; gap: 0.375rem; }

  /* ── Spell card ──────────────────────────────────────────────────────────── */
  .spell-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .spell-card:not(.locked):hover { border-color: var(--primary, #60a5fa); }
  .spell-card.open { border-color: var(--primary, #60a5fa); }
  .spell-card.locked { opacity: 0.5; filter: grayscale(0.3); }

  .spell-card-top {
    display: flex;
    align-items: stretch;
  }
  .spell-card-header {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-align: left;
  }
  .spell-card-header:hover { background: var(--surface-2); }
  .spell-card-left {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1;
    min-width: 0;
  }
  .spell-level-badge {
    font-size: 0.65rem;
    font-weight: 700;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.1rem 0.35rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .spell-name {
    font-size: 0.875rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .conc-badge {
    font-size: 0.65rem;
    font-weight: 700;
    background: #dbeafe;
    border: 1px solid #bfdbfe;
    border-radius: 99px;
    padding: 0 0.35rem;
    color: #1e40af;
    flex-shrink: 0;
  }
  .locked-badge { font-size: 0.7rem; flex-shrink: 0; }
  .spell-card-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .comp-pips { display: flex; gap: 2px; }
  .comp-pip {
    font-size: 0.6rem;
    font-weight: 700;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
  }
  .expand-chevron {
    font-size: 1rem;
    color: var(--text-faint);
    display: inline-block;
    transition: transform 0.18s;
    line-height: 1;
  }
  .expand-chevron.rotated { transform: rotate(90deg); }

  .remove-spell-btn {
    padding: 0.5rem 0.625rem;
    background: none;
    border: none;
    border-left: 1px solid var(--border);
    color: var(--text-faint);
    cursor: pointer;
    font-size: 0.75rem;
    flex-shrink: 0;
    line-height: 1;
    transition: color 0.1s, background 0.1s;
  }
  .remove-spell-btn:hover { color: #ef4444; background: #fee2e2; }

  .spell-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0 0.75rem 0.5rem;
  }
  .meta-chip {
    font-size: 0.7rem;
    padding: 0.1rem 0.45rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 99px;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .meta-chip-label { font-weight: 700; color: var(--text-faint); margin-right: 0.2rem; }
  .school-chip { background: #f3e8ff; border-color: #e9d5ff; color: #6b21a8; }
  .dmg-chip    { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
  .heal-chip   { background: #dcfce7; border-color: #bbf7d0; color: #166534; }

  .spell-desc {
    padding: 0.5rem 0.75rem 0.625rem;
    border-top: 1px solid var(--border);
    font-size: 0.8rem;
    line-height: 1.6;
    color: var(--text-muted);
    background: var(--surface-2);
    white-space: pre-wrap;
  }

  .empty-state {
    padding: 2.5rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  /* ── Spell Slot Cards ────────────────────────────────────────────────────── */
  .slot-level-groups { display: flex; flex-direction: column; gap: 1rem; }
  .slot-level-group  { display: flex; flex-direction: column; gap: 0.5rem; }
  .slot-group-header {
    display: flex; align-items: center; gap: 0.5rem;
    padding-bottom: 0.25rem; border-bottom: 1px solid var(--border);
  }
  .slot-group-label {
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--text-muted); flex: 1;
    display: flex; align-items: center; gap: 0.4rem;
  }
  .slot-group-count { font-size: 0.7rem; color: var(--text-faint); }
  .slot-tag {
    font-size: 0.6rem; font-weight: 700; border-radius: 99px;
    padding: 1px 0.4rem; border: 1px solid; text-transform: none; letter-spacing: 0;
  }
  .pact-tag    { background: #ede9fe; border-color: #ddd6fe; color: #5b21b6; }
  .arcanum-tag { background: #fef3c7; border-color: #fde68a; color: #92400e; }
  .slot-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 0.5rem;
  }
  .slot-card {
    display: flex; flex-direction: column; gap: 0.35rem;
    background: var(--surface-2);
    border: 2px solid var(--primary, #60a5fa);
    border-radius: var(--radius-md, 8px);
    padding: 0.45rem 0.5rem 0.4rem;
    transition: opacity 0.15s, border-color 0.15s;
  }
  .slot-card.slot-used {
    border-color: var(--border);
    opacity: 0.5;
  }
  .slot-card-header { display: flex; align-items: center; }
  .slot-card-index {
    font-size: 0.65rem; font-weight: 700;
    color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em;
  }
  .slot-card-select {
    width: 100%; font-size: 0.7rem; font-family: inherit;
    color: var(--text); background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 0.15rem 0.25rem;
  }
  .slot-use-btn {
    font-size: 0.65rem; font-weight: 700; border: none;
    border-radius: var(--radius); padding: 0.2rem 0.375rem;
    cursor: pointer; font-family: inherit;
    text-transform: uppercase; letter-spacing: 0.04em;
    transition: background 0.1s, color 0.1s;
  }
  .slot-use-btn:not(.used) { background: #dcfce7; color: #166534; }
  .slot-use-btn.used       { background: var(--surface-3); color: var(--text-faint); }
  .slot-use-btn:not(.used):hover { background: #bbf7d0; }
  .slot-use-btn.used:hover       { background: #dcfce7; color: #166534; }
</style>
