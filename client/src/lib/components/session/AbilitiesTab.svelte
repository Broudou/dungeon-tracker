<script>
  import { slide } from 'svelte/transition';

  export let players  = [];   // full player objects with populated knownSpells
  export let myCharId = null;
  export let isDM     = false;

  let selectedCharId = null;
  let expanded       = new Set(); // spell IDs that are expanded

  // DM: default to first character; player: always own character
  $: if (!selectedCharId) {
    selectedCharId = isDM ? (players[0]?._id ?? null) : myCharId;
  }

  $: selectedChar = players.find(p => p._id === selectedCharId) ?? null;

  $: spellGroups = groupByLevel(
    (selectedChar?.knownSpells ?? []).filter(s => s && s.name)
  );

  // ── helpers ──────────────────────────────────────────────────────────────────

  /**
   * Standard D&D 5e full-caster max spell slot level by character level.
   * Half-casters (Paladin, Ranger) and third-casters (Arcane Trickster, Eldritch Knight)
   * are approximated — they still use this for the "preview locked" visual only.
   */
  const HALF_CASTERS   = new Set(['Paladin', 'Ranger']);
  const THIRD_CASTERS  = new Set(['Artificer']);

  function maxSpellLevel(charLevel, charClass) {
    const lvl = Math.min(charLevel ?? 1, 20);
    if (HALF_CASTERS.has(charClass)) {
      const halfTable = [0,0,1,1,2,2,2,3,3,4,4,4,5,5,5,5,5,5,5,5,5];
      return halfTable[lvl] ?? 0;
    }
    if (THIRD_CASTERS.has(charClass)) {
      const thirdTable = [0,1,1,1,1,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3];
      return thirdTable[lvl] ?? 0;
    }
    // Full caster table (Bard, Cleric, Druid, Sorcerer, Warlock, Wizard)
    const fullTable = [0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,9,9];
    return fullTable[lvl] ?? 0;
  }

  function isLocked(spell) {
    if (!selectedChar || spell.level === 0) return false; // cantrips never locked
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
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expanded = next;
  }

  function levelLabel(lvl) {
    return lvl === 0 ? 'Cantrips' : `Level ${lvl} Spells`;
  }

  function spellLevelBadge(lvl) {
    return lvl === 0 ? 'Cantrip' : `Lv ${lvl}`;
  }
</script>

<div class="abilities-layout">

  <!-- ── DM character selector ─────────────────────────────────────────────── -->
  {#if isDM}
    <div class="char-selector">
      <span class="selector-label">Character</span>
      <div class="selector-pills">
        {#each players as p (p._id)}
          <button
            class="selector-pill"
            class:active={p._id === selectedCharId}
            on:click={() => { selectedCharId = p._id; expanded = new Set(); }}
          >
            <span class="pill-av">{p.name.slice(0, 2).toUpperCase()}</span>
            <span class="pill-name">{p.name}</span>
            <span class="pill-meta">Lv {p.level} {p.class}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── No character found ─────────────────────────────────────────────────── -->
  {#if !selectedChar}
    <div class="empty-state">No character found.</div>

  {:else}

    <!-- ── Character identity bar ─────────────────────────────────────────── -->
    <div class="char-identity">
      <div class="char-av-sm">{selectedChar.name.slice(0, 2).toUpperCase()}</div>
      <div class="char-id-info">
        <span class="char-id-name">{selectedChar.name}</span>
        <span class="char-id-meta text-muted">
          Lv {selectedChar.level}
          {[selectedChar.race, selectedChar.class, selectedChar.subclass].filter(Boolean).join(' · ')}
          — Max spell slot: <strong>
            {#if maxSpellLevel(selectedChar.level, selectedChar.class) === 0}
              None
            {:else}
              {maxSpellLevel(selectedChar.level, selectedChar.class)}
            {/if}
          </strong>
        </span>
      </div>
    </div>

    <!-- ── Spell groups ───────────────────────────────────────────────────── -->
    {#if spellGroups.length === 0}
      <div class="empty-state">This character has no learned spells.</div>
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
                  <!-- Card header (always visible) -->
                  <button
                    class="spell-card-header"
                    on:click={() => toggleSpell(spell._id)}
                    aria-expanded={open}
                  >
                    <div class="spell-card-left">
                      <span class="spell-level-badge">{spellLevelBadge(spell.level)}</span>
                      <span class="spell-name">{spell.name}</span>
                      {#if spell.concentration}
                        <span class="conc-badge" title="Concentration">C</span>
                      {/if}
                      {#if locked}
                        <span class="locked-badge" title="Level too low to cast">🔒</span>
                      {/if}
                    </div>

                    <div class="spell-card-right">
                      <!-- Component pips -->
                      <div class="comp-pips">
                        {#if comps.v}<span class="comp-pip" title="Verbal">V</span>{/if}
                        {#if comps.s}<span class="comp-pip" title="Somatic">S</span>{/if}
                        {#if comps.m}<span class="comp-pip" title="Material">M</span>{/if}
                      </div>
                      <span class="expand-chevron" class:rotated={open}>›</span>
                    </div>
                  </button>

                  <!-- Quick-info row (always visible) -->
                  <div class="spell-meta-row">
                    {#if spell.castingTime}
                      <span class="meta-chip"><span class="meta-chip-label">Cast</span> {spell.castingTime}</span>
                    {/if}
                    {#if spell.range}
                      <span class="meta-chip"><span class="meta-chip-label">Range</span> {spell.range}</span>
                    {/if}
                    {#if spell.duration}
                      <span class="meta-chip"><span class="meta-chip-label">Duration</span> {spell.duration}</span>
                    {/if}
                    {#if spell.school}
                      <span class="meta-chip school-chip">{spell.school}</span>
                    {/if}
                    {#if spell.damageType}
                      <span class="meta-chip dmg-chip">{spell.damageDice ?? ''} {spell.damageType}</span>
                    {/if}
                    {#if spell.healDice}
                      <span class="meta-chip heal-chip">Heal {spell.healDice}</span>
                    {/if}
                    {#if spell.saveAbility}
                      <span class="meta-chip">{spell.saveAbility} save{spell.halfOnSave ? ' (½)' : ''}</span>
                    {/if}
                  </div>

                  <!-- Collapsible description -->
                  {#if open && spell.description}
                    <div class="spell-desc" transition:slide={{ duration: 180 }}>
                      {spell.description}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .abilities-layout {
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
    overflow: hidden;
  }

  /* ── Character selector (DM) ─────────────────────────────────────────────── */
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
  .selector-pills {
    display: flex;
    gap: 0.375rem;
  }
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

  /* ── Character identity bar ──────────────────────────────────────────────── */
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

  /* ── Spell groups ────────────────────────────────────────────────────────── */
  .spell-groups {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .spell-group {}
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

  .spell-cards {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

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

  .spell-card.locked {
    opacity: 0.5;
    filter: grayscale(0.3);
    pointer-events: auto; /* keep visible + expandable for preview */
  }
  .spell-card.locked .spell-card-header { cursor: default; }

  .spell-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    width: 100%;
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

  .spell-card-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
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

  /* Quick-info row */
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
  .meta-chip-label {
    font-weight: 700;
    color: var(--text-faint);
    margin-right: 0.2rem;
  }
  .school-chip { background: #f3e8ff; border-color: #e9d5ff; color: #6b21a8; }
  .dmg-chip    { background: #fee2e2; border-color: #fecaca; color: #991b1b; }
  .heal-chip   { background: #dcfce7; border-color: #bbf7d0; color: #166534; }

  /* Description */
  .spell-desc {
    padding: 0.5rem 0.75rem 0.625rem;
    border-top: 1px solid var(--border);
    font-size: 0.8rem;
    line-height: 1.6;
    color: var(--text-muted);
    background: var(--surface-2);
    white-space: pre-wrap;
  }

  /* Empty / error */
  .empty-state {
    padding: 2.5rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
</style>
