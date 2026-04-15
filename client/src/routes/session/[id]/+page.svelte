<script>
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { combat, setCombat, pendingActions, currentCombatant } from '$lib/stores/combat';
  import { session, roster, identity, worldRolls } from '$lib/stores/session';
  import { connectSocket, disconnectSocket, getSocket } from '$lib/socket';

  import InitiativeTracker  from '$lib/components/combat/InitiativeTracker.svelte';
  import CombatLog          from '$lib/components/combat/CombatLog.svelte';
  import ActionPanel        from '$lib/components/combat/ActionPanel.svelte';
  import ValidationQueue    from '$lib/components/combat/ValidationQueue.svelte';
  import CombatSetup        from '$lib/components/combat/CombatSetup.svelte';
  import SkillCheckPanel    from '$lib/components/world/SkillCheckPanel.svelte';
  import DiceTray           from '$lib/components/dice/DiceTray.svelte';
  import HpBar              from '$lib/components/ui/HpBar.svelte';
  import AbilitiesTab       from '$lib/components/session/AbilitiesTab.svelte';

  const sessionId = $page.params.id;

  let loading       = true;
  let error         = '';
  let activeTab     = 'combat';
  let diceTrayOpen  = false;
  let sessionData   = null;
  let campaignData  = null;
  let showStartModal= false;
  let monsterList   = [];
  let myCharId      = null;
  let displayName   = '';
  let worldRollFeed = [];
  let toast         = '';
  let allSpells      = [];
  let allAbilities   = [];
  let expandedSpells    = new Set();
  let expandedAbilities = new Set();
  let expandedCreatures = new Set();
  let spellFilter      = '';
  let spellClassFilter = '';
  let creatureFilter   = '';
  let crFilter         = '';
  // Category visibility toggles for Spells tab
  let showSpells     = true;
  let showAbilities  = true;
  let showTraits     = true;

  const SUBCLASSES = {
    Barbarian: { minLevel: 3, options: ['Path of the Berserker', 'Totem Warrior'] },
    Bard:      { minLevel: 3, options: ['College of Lore', 'College of Valor'] },
    Cleric:    { minLevel: 1, options: ['Knowledge', 'Life', 'Light', 'Nature', 'Tempest', 'Trickery', 'War'] },
    Druid:     { minLevel: 2, options: ['Circle of the Land', 'Circle of the Moon'] },
    Fighter:   { minLevel: 3, options: ['Champion', 'Battle Master', 'Eldritch Knight'] },
    Monk:      { minLevel: 3, options: ['Open Hand', 'Shadow', 'Four Elements'] },
    Paladin:   { minLevel: 3, options: ['Devotion', 'Ancients', 'Vengeance'] },
    Ranger:    { minLevel: 3, options: ['Hunter', 'Beast Master'] },
    Rogue:     { minLevel: 3, options: ['Thief', 'Assassin', 'Arcane Trickster'] },
    Sorcerer:  { minLevel: 1, options: ['Draconic Bloodline', 'Wild Magic'] },
    Warlock:   { minLevel: 1, options: ['Archfey', 'Fiend', 'Great Old One'] },
    Wizard:    { minLevel: 2, options: ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'] },
  };

  const CR_VALUES = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'];

  // HP edit modal
  let editingPlayer = null;
  let editForm      = {};
  let editSaving    = false;

  // Character sheet modal
  let sheetChar = null;

  function openSheet(p) { sheetChar = p; }
  function closeSheet() { sheetChar = null; subclassEditing = false; }

  // Subclass inline edit (DM, in character sheet)
  let subclassEditing = false;
  let subclassEditVal = '';

  function startSubclassEdit(p) {
    subclassEditing = true;
    subclassEditVal = p.subclass || '';
  }

  async function saveSubclass(player) {
    try {
      const res = await fetch(
        `/api/campaigns/${sessionData.campaignId}/players/${player._id}`,
        { method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subclass: subclassEditVal }) }
      );
      if (res.ok) {
        const updated = await res.json();
        campaignData = { ...campaignData, players: campaignData.players.map(p =>
          p._id === player._id ? { ...p, subclass: updated.subclass } : p
        )};
        sheetChar = { ...sheetChar, subclass: updated.subclass };
      }
    } catch { /* silent */ }
    subclassEditing = false;
  }

  function spellsByLevel(spells = []) {
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

  $: isDM  = !!$auth?.user;
  $: phase = sessionData?.phase ?? 'open-world';

  $: spellClasses = [...new Set(
    allSpells.flatMap(s => s.classes?.split(/[,\s]+/).map(c => c.trim()) ?? []).filter(Boolean)
  )].sort();

  $: filteredSpells = allSpells
    .filter(s => (!spellClassFilter || (s.classes ?? '').toLowerCase().split(/[,\s]+/).includes(spellClassFilter.toLowerCase())))
    .filter(s => (!spellFilter || s.name.toLowerCase().includes(spellFilter.toLowerCase())));

  function groupBySchool(spells = []) {
    const groups = {};
    for (const s of spells) { const school = s.school ?? 'Unknown'; (groups[school] ??= []).push(s); }
    return Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([school, list]) => ({ school, list }));
  }

  function normalizeCR(cr) {
    const s = String(cr ?? '?');
    if (s === '1/8') return '0.125';
    if (s === '1/4') return '0.25';
    if (s === '1/2') return '0.5';
    return s;
  }

  function parseCRNum(cr) {
    const s = String(cr ?? '0');
    if (s === '1/8') return 0.125;
    if (s === '1/4') return 0.25;
    if (s === '1/2') return 0.5;
    return parseFloat(s) || 0;
  }

  $: filteredCreatures = monsterList.filter(m =>
    (!creatureFilter || m.name.toLowerCase().includes(creatureFilter.toLowerCase())) &&
    (!crFilter || parseCRNum(m.cr) === parseCRNum(crFilter))
  );

  async function handleSpellsUpdate({ detail: { playerId, knownSpells } }) {
    campaignData = { ...campaignData, players: campaignData.players.map(p =>
      p._id === playerId ? { ...p, knownSpells } : p
    )};
    try {
      await fetch(
        `/api/campaigns/${sessionData.campaignId}/players/${playerId}`,
        { method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ knownSpells: knownSpells.map(s => s._id ?? s) }) }
      );
    } catch { /* silent */ }
  }

  function getJwtFromCookie() {
    if (typeof document === 'undefined') return '';
    const m = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  onMount(async () => {
    // Restore player identity from sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(`session_${sessionId}`);
        if (stored) { const p = JSON.parse(stored); myCharId = p.characterId || null; displayName = p.displayName || ''; }
      } catch { /* ignore */ }
    }

    // Load session (public endpoint — no auth required)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error((await res.json()).message);
      sessionData = await res.json();
      session.set(sessionData);
    } catch (e) { error = e.message; loading = false; return; }

    // Load campaign — DM gets full data; players fall back to lobby roster
    try {
      const res = await fetch(`/api/campaigns/${sessionData.campaignId}`, { credentials: 'include' });
      if (res.ok) {
        campaignData = await res.json();
      } else {
        // Player path: use public lobby endpoint for character roster
        const lr = await fetch(`/api/sessions/${sessionId}/lobby`);
        if (lr.ok) {
          const lobby = await lr.json();
          campaignData = { _id: sessionData.campaignId, name: lobby.campaignName, players: lobby.players };
        }
      }
    } catch { /* non-fatal */ }

    // Load monster list and spell list for DM (non-fatal)
    if (isDM) {
      try {
        const res = await fetch('/api/monsters?limit=500', { credentials: 'include' });
        if (res.ok) monsterList = await res.json();
      } catch { /* non-fatal */ }
      try {
        const res = await fetch('/api/spells?limit=500', { credentials: 'include' });
        if (res.ok) allSpells = await res.json();
      } catch { /* non-fatal */ }
      try {
        const res = await fetch('/api/abilities?limit=2000', { credentials: 'include' });
        if (res.ok) allAbilities = await res.json();
      } catch { /* non-fatal */ }
    }

    // Connect socket
    const token = getJwtFromCookie();
    const authPayload = token
      ? { token, sessionId }
      : { displayName: displayName || 'Player', characterId: myCharId, sessionId };

    const socket = connectSocket(sessionId, authPayload);

    socket.on('session:role',   data  => identity.set(data));
    socket.on('session:roster', r     => roster.set(r));
    socket.on('session:phase',  p     => { if (sessionData) { sessionData.phase = p; sessionData = sessionData; }});

    socket.on('combat:state',           s  => setCombat(s));
    socket.on('combat:actionResolved', ({ status, reason }) => {
      if (status === 'rejected' && reason) {
        toast = `Action rejected: ${reason}`;
        setTimeout(() => toast = '', 4000);
      }
    });

    socket.on('world:roll', r => { worldRollFeed = [...worldRollFeed.slice(-50), r]; });

    socket.on('player:updated', ({ playerId, combat: c, conditions }) => {
      if (campaignData) {
        campaignData = {
          ...campaignData,
          players: campaignData.players.map(p => p._id === playerId ? { ...p, combat: c, conditions } : p),
        };
      }
    });

    // Sync HP for all players after combat ends
    socket.on('campaign:playersUpdated', ({ players }) => {
      if (!campaignData) return;
      const map = Object.fromEntries(players.map(p => [p._id, p]));
      campaignData = {
        ...campaignData,
        players: campaignData.players.map(p => map[p._id] ? { ...p, combat: map[p._id].combat } : p),
      };
    });

    socket.emit('combat:getState');
    loading = false;
  });

  onDestroy(() => disconnectSocket());

  // ── HP edit modal ────────────────────────────────────────────────────────────
  function openEdit(player) {
    editingPlayer = player;
    editForm = {
      hpCurrent:     player.combat?.hpCurrent    ?? 0,
      hpMax:         player.combat?.hpMax        ?? 0,
      AC:            player.combat?.AC           ?? 10,
      speed:         player.combat?.speed        ?? 30,
      initiativeMod: player.combat?.initiativeMod ?? 0,
    };
  }

  function closeEdit() { editingPlayer = null; editForm = {}; }

  async function saveEdit() {
    if (!editingPlayer || editSaving) return;
    editSaving = true;
    try {
      if (isDM) {
        const res = await fetch(
          `/api/campaigns/${sessionData.campaignId}/players/${editingPlayer._id}`,
          { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ combat: { ...editingPlayer.combat, ...editForm } }) }
        );
        if (res.ok) {
          const updated = await res.json();
          campaignData = { ...campaignData, players: campaignData.players.map(p => p._id === updated._id ? { ...p, ...updated } : p) };
        }
      } else {
        getSocket()?.emit('player:updateSelf', { hpCurrent: Number(editForm.hpCurrent) });
      }
    } catch { /* silent */ }
    editSaving = false;
    closeEdit();
  }

  // ── Combat control ───────────────────────────────────────────────────────────
  function handleCombatStart(e) {
    const { playerIds, monsters } = e.detail;
    getSocket()?.emit('combat:start', { playerIds, monsters, customIds: [] });
    showStartModal = false;
  }

  function endCombat() {
    if (confirm('End combat and return to the world?')) getSocket()?.emit('combat:end');
  }
</script>

<svelte:head>
  <title>{campaignData?.name ?? 'Session'} — Dungeon Tracker</title>
</svelte:head>

<!-- Toast notification -->
{#if toast}
  <div class="toast" role="alert">{toast}</div>
{/if}

{#if loading}
  <div class="loading" style="padding: 4rem; text-align: center;">Loading session…</div>

{:else if error}
  <div class="page"><div class="container"><div class="alert alert-error">{error}</div></div></div>

{:else}

<!-- Session top bar -->
<div class="session-bar">
  <div class="session-bar-left">
    <span class="session-name">{campaignData?.name ?? 'Session'}</span>
    <span class="session-key">{sessionData.joinKey}</span>
    <span class="phase-badge phase-{phase}">
      {phase === 'combat' ? 'Combat' : 'World'}
    </span>
  </div>
  <div class="session-bar-right">
    <span class="text-muted text-sm">{$roster.length} connected</span>
    {#if isDM && phase !== 'combat'}
      <a href="/campaign/{sessionData.campaignId}" class="btn btn-ghost btn-sm">Edit Campaign</a>
    {/if}
    {#if isDM && phase === 'combat' && $combat?.state === 'active'}
      <button class="btn btn-danger btn-sm" on:click={endCombat}>End Combat</button>
    {/if}
  </div>
</div>

<!-- Tab bar -->
<div class="tabs" style="padding: 0 1.25rem; margin-bottom: 0;">
  <button class="tab-btn" class:active={activeTab==='combat'}     on:click={() => activeTab='combat'}>Combat</button>
  <button class="tab-btn" class:active={activeTab==='characters'} on:click={() => activeTab='characters'}>Characters</button>
  <button class="tab-btn" class:active={activeTab==='abilities'}  on:click={() => activeTab='abilities'}>Abilities</button>
  {#if isDM}
    <button class="tab-btn" class:active={activeTab==='spells'}    on:click={() => activeTab='spells'}>Spells</button>
    <button class="tab-btn" class:active={activeTab==='creatures'}  on:click={() => activeTab='creatures'}>Creatures</button>
  {/if}
</div>

<!-- ══════════════════════════════════════════════ COMBAT TAB ══ -->
{#if activeTab === 'combat'}
  <div class="combat-layout">

    <!-- Monster rail (top, active combat only) -->
    {#if $combat?.state === 'active'}
      {@const monsters = $combat.initiativeOrder.filter(c => c.entityType !== 'player')}
      {#if monsters.length}
        <div class="monster-rail">
          {#each monsters as c (c.instanceId)}
            <div class="monster-card" class:defeated={c.isDefeated}>
              <div class="mc-head">
                <span class="mc-name">{c.name}</span>
                {#if c.cr}<span class="badge">CR {c.cr}</span>{/if}
              </div>
              <HpBar current={c.currentHp} max={c.maxHp} />
              <div class="mc-sub text-xs text-muted">AC {c.ac} · {c.currentHp}/{c.maxHp} HP</div>
              {#if c.conditions.length}
                <div class="pill-row-sm">
                  {#each c.conditions as cond}<span class="pill pill-red">{cond}</span>{/each}
                </div>
              {/if}
              {#if c.customTags.length}
                <div class="pill-row-sm">
                  {#each c.customTags as tag}<span class="pill pill-{tag.color}">{tag.label}</span>{/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Main combat area -->
    <div class="battle-engine">

      <!-- Left: initiative tracker + party sidebar -->
      <div class="engine-left">
        {#if $combat?.state === 'active'}
          <InitiativeTracker
            order={$combat.initiativeOrder}
            currentIndex={$combat.currentTurnIndex}
            round={$combat.round}
            {isDM}
            {myCharId}
          />

          <!-- Party sidebar (HP quick view) -->
          {#if campaignData?.players?.length}
            <div class="party-sidebar">
              <p class="sidebar-label">Party</p>
              {#each campaignData.players as p (p._id)}
                {@const isMe = p._id === myCharId}
                <div class="sidebar-row" class:sidebar-mine={isMe}>
                  <span class="sidebar-av" aria-hidden="true">{p.name.slice(0,2).toUpperCase()}</span>
                  <div class="sidebar-info">
                    <span class="sidebar-name">{p.name}</span>
                    <span class="sidebar-hp text-xs text-muted">HP {p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0} · AC {p.combat?.AC ?? 10}</span>
                  </div>
                  {#if isDM || isMe}
                    <button class="edit-btn" on:click={() => openEdit(p)} title="Edit HP" aria-label="Edit HP">✎</button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

        {:else}
          <!-- Idle state — party roster cards + begin button -->
          <div class="idle-state">
            {#if campaignData?.players?.length}
              <p class="idle-label">Party Roster</p>
              <div class="roster-grid">
                {#each campaignData.players as p (p._id)}
                  {@const isMe = p._id === myCharId}
                  <div class="roster-card" class:roster-mine={isMe}>
                    <div class="roster-av">{p.name.slice(0,2).toUpperCase()}</div>
                    <div class="roster-name">{p.name}</div>
                    <div class="roster-meta text-xs text-muted">Lv {p.level} {p.class}</div>
                    <div class="roster-stat text-xs">
                      <span class="text-faint">HP</span> {p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0}
                    </div>
                    <div class="roster-stat text-xs">
                      <span class="text-faint">AC</span> {p.combat?.AC ?? 10}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}

            {#if isDM}
              <button class="btn btn-primary" style="margin-top: 1rem;" on:click={() => showStartModal = true}>
                Begin Encounter
              </button>
            {:else}
              <p class="text-muted text-sm" style="margin-top: 1rem; font-style: italic;">
                Awaiting the Dungeon Master to begin combat…
              </p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Right: action panel + combat log -->
      {#if $combat?.state === 'active'}
        <div class="engine-right">
          <div class="action-section">
            <p class="section-heading">Actions</p>
            <ActionPanel
              currentCombatant={$currentCombatant}
              {myCharId}
              {isDM}
              campaign={campaignData}
              sessionId={sessionId}
              combatants={$combat?.initiativeOrder ?? []}
            />
          </div>
          <div class="log-section">
            <p class="section-heading">Combat Log</p>
            <CombatLog entries={$combat?.combatLog ?? []} {isDM} />
          </div>
        </div>
      {/if}

    </div>

    <!-- DM Validation Queue (fixed, bottom-left) -->
    {#if isDM}
      <ValidationQueue actions={$pendingActions} />
    {/if}
  </div>
{/if}

<!-- ══════════════════════════════════════════════ CHARACTERS TAB ══ -->
{#if activeTab === 'characters'}
  <div class="page-pad">
    <div class="container">
      {#if !campaignData?.players?.length}
        <div class="empty-card">No characters in this campaign.</div>
      {:else}
        <div class="char-grid">
          {#each campaignData.players as p (p._id)}
            {@const isMe = p._id === myCharId}
            <button class="char-card" class:char-mine={isMe} on:click={() => openSheet(p)}>
              <div class="char-head">
                <div class="char-av">{p.name.slice(0,2).toUpperCase()}</div>
                <div>
                  <div class="char-name">{p.name} {#if isMe}<span class="badge">You</span>{/if}</div>
                  <div class="char-meta text-sm text-muted">Lv {p.level} {p.race} {p.class}</div>
                </div>
              </div>

              <!-- Ability scores -->
              {#if p.stats}
                <div class="stat-row">
                  {#each ['STR','DEX','CON','INT','WIS','CHA'] as s}
                    {@const val = p.stats[s] ?? 10}
                    {@const mod = Math.floor((val - 10) / 2)}
                    <div class="stat-box">
                      <span class="stat-label">{s}</span>
                      <span class="stat-val">{val}</span>
                      <span class="stat-mod text-xs text-muted">{mod >= 0 ? '+' : ''}{mod}</span>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Combat stats -->
              <div class="combat-stats">
                <div class="cstat">
                  <span class="cstat-label">HP</span>
                  <span class="cstat-val">{p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0}</span>
                </div>
                <div class="cstat">
                  <span class="cstat-label">AC</span>
                  <span class="cstat-val">{p.combat?.AC ?? 10}</span>
                </div>
                <div class="cstat">
                  <span class="cstat-label">Speed</span>
                  <span class="cstat-val">{p.combat?.speed ?? 30}ft</span>
                </div>
                <div class="cstat">
                  <span class="cstat-label">Init</span>
                  <span class="cstat-val">{p.combat?.initiativeMod >= 0 ? '+' : ''}{p.combat?.initiativeMod ?? 0}</span>
                </div>
              </div>

              <HpBar current={p.combat?.hpCurrent ?? 0} max={p.combat?.hpMax ?? 1} />
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ══════════════════════════════════════════════ ABILITIES TAB ══ -->
{#if activeTab === 'abilities'}
  <div class="abilities-tab-wrap">
    <AbilitiesTab
      players={campaignData?.players ?? []}
      {myCharId}
      {isDM}
      {allSpells}
      campaignId={sessionData?.campaignId}
      on:spellsUpdate={handleSpellsUpdate}
      on:statsUpdate={({ detail: { playerId, stats } }) => {
        campaignData = { ...campaignData, players: campaignData.players.map(p =>
          p._id === playerId ? { ...p, stats } : p
        )};
      }}
    />
  </div>
{/if}

<!-- ══════════════════════════════════════════════ SPELLS TAB ══ -->
{#if activeTab === 'spells' && isDM}
  <div class="ref-tab">

    <!-- Category toggle pills -->
    <div class="spell-category-filters">
      <button class="spell-cat-btn" class:active={showSpells}    on:click={() => showSpells    = !showSpells}>Spells</button>
      <button class="spell-cat-btn" class:active={showAbilities} on:click={() => showAbilities = !showAbilities}>Abilities</button>
      <button class="spell-cat-btn" class:active={showTraits}    on:click={() => showTraits    = !showTraits}>Traits</button>
    </div>

    <!-- ── SPELLS ── -->
    {#if showSpells}
      <div class="ref-section-block">
        <div class="ref-block-header">Spells</div>
        <div class="ref-search-bar">
          <input class="ref-search" type="search" placeholder="Filter spells…" bind:value={spellFilter} />
        </div>
        <div class="spell-class-filters">
          <button class="spell-class-btn" class:active={spellClassFilter === ''} on:click={() => spellClassFilter = ''}>All</button>
          {#each spellClasses as cls}
            <button class="spell-class-btn" class:active={spellClassFilter === cls} on:click={() => spellClassFilter = cls}>{cls}</button>
          {/each}
        </div>
        {#each groupBySchool(filteredSpells) as group (group.school)}
          <div class="ref-group">
            <div class="ref-group-label">{group.school}</div>
            {#each group.list as spell (spell._id)}
              {@const open = expandedSpells.has(spell._id)}
              <button class="ref-card" class:ref-open={open} on:click={() => { if (open) expandedSpells.delete(spell._id); else expandedSpells.add(spell._id); expandedSpells = expandedSpells; }}>
                <div class="ref-card-head">
                  <span class="ref-card-name">{spell.name}</span>
                  <span class="ref-card-meta">{spell.level === 0 ? 'Cantrip' : `Lv ${spell.level}`}</span>
                  {#if spell.concentration}<span class="pill pill-yellow" style="margin-left:auto;margin-right:.5rem;">Conc.</span>{/if}
                  <span class="ref-chevron">{open ? '▲' : '▼'}</span>
                </div>
                {#if open}
                  <div class="ref-card-body">
                    <div class="ref-meta-row">
                      {#if spell.castingTime}<span><strong>Cast:</strong> {spell.castingTime}</span>{/if}
                      {#if spell.range}<span><strong>Range:</strong> {spell.range}</span>{/if}
                      {#if spell.duration}<span><strong>Duration:</strong> {spell.duration}</span>{/if}
                      {#if spell.components}<span><strong>Components:</strong> {spell.components}</span>{/if}
                    </div>
                    {#if spell.damageDice || spell.damageType || spell.healDice || spell.saveAbility}
                      <div class="ref-meta-row" style="margin-top: 0.25rem;">
                        {#if spell.damageDice}<span><strong>Damage:</strong> {spell.damageDice}{spell.damageType ? ` ${spell.damageType}` : ''}</span>{/if}
                        {#if spell.healDice}<span><strong>Heal:</strong> {spell.healDice}</span>{/if}
                        {#if spell.saveAbility}<span><strong>Save:</strong> {spell.saveAbility}{spell.halfOnSave ? ' (half on save)' : ''}</span>{/if}
                      </div>
                    {/if}
                    {#if spell.description}
                      <p class="ref-description">{spell.description}</p>
                    {/if}
                    {#if spell.classes}
                      <div class="ref-classes">{spell.classes}</div>
                    {/if}
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {/each}
        {#if allSpells.length === 0}
          <p class="ref-empty">No spells loaded.</p>
        {/if}
      </div>
    {/if}

    <!-- ── ABILITIES ── -->
    {#if showAbilities}
      {@const abilityList = allAbilities.filter(a => a.type === 'ability')}
      <div class="ref-section-block">
        <div class="ref-block-header">Abilities</div>
        {#if abilityList.length === 0}
          <p class="ref-empty">No abilities loaded.</p>
        {:else}
          {#each abilityList as ab (ab._id)}
            {@const open = expandedAbilities.has(ab._id)}
            <button class="ref-card" class:ref-open={open} on:click={() => { if (open) expandedAbilities.delete(ab._id); else expandedAbilities.add(ab._id); expandedAbilities = expandedAbilities; }}>
              <div class="ref-card-head">
                <span class="ref-card-name">{ab.name}</span>
                {#if ab.classes?.length}<span class="ref-card-meta">{ab.classes.join(', ')}</span>{/if}
                {#if ab.level > 1}<span class="badge" style="margin-left:.25rem;">Lv {ab.level}</span>{/if}
                <span class="ref-chevron">{open ? '▲' : '▼'}</span>
              </div>
              {#if open && ab.description}
                <div class="ref-card-body">
                  <p class="ref-description">{ab.description}</p>
                </div>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    {/if}

    <!-- ── TRAITS ── -->
    {#if showTraits}
      {@const traitList = allAbilities.filter(a => a.type === 'trait')}
      <div class="ref-section-block">
        <div class="ref-block-header">Traits</div>
        {#if traitList.length === 0}
          <p class="ref-empty">No traits loaded.</p>
        {:else}
          {#each traitList as tr (tr._id)}
            {@const open = expandedAbilities.has(tr._id)}
            <button class="ref-card" class:ref-open={open} on:click={() => { if (open) expandedAbilities.delete(tr._id); else expandedAbilities.add(tr._id); expandedAbilities = expandedAbilities; }}>
              <div class="ref-card-head">
                <span class="ref-card-name">{tr.name}</span>
                <span class="ref-chevron">{open ? '▲' : '▼'}</span>
              </div>
              {#if open && tr.description}
                <div class="ref-card-body">
                  <p class="ref-description">{tr.description}</p>
                </div>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    {/if}

  </div>
{/if}

<!-- ══════════════════════════════════════════════ CREATURES TAB ══ -->
{#if activeTab === 'creatures' && isDM}
  <div class="ref-tab">
    <div class="ref-search-bar creature-filters">
      <input class="ref-search" type="search" placeholder="Filter by name…" bind:value={creatureFilter} />
      <select class="ref-filter-select" bind:value={crFilter}>
        <option value="">All CRs</option>
        {#each CR_VALUES as cr}<option value={cr}>CR {normalizeCR(cr)}</option>{/each}
      </select>
    </div>
    {#each filteredCreatures as creature (creature._id)}
      {@const open = expandedCreatures.has(creature._id)}
      <button class="ref-card" class:ref-open={open} on:click={() => { if (open) expandedCreatures.delete(creature._id); else expandedCreatures.add(creature._id); expandedCreatures = expandedCreatures; }}>
        <div class="ref-card-head">
          <span class="ref-card-name">{creature.name}</span>
          <div class="ref-card-badges">
            {#if creature.cr != null}<span class="badge">CR {normalizeCR(creature.cr)}</span>{/if}
            {#if creature.type}<span class="ref-card-meta">{creature.type}</span>{/if}
          </div>
          <span class="ref-chevron">{open ? '▲' : '▼'}</span>
        </div>
        {#if open}
          <div class="ref-card-body">
            <!-- Core stats -->
            <div class="ref-meta-row">
              {#if creature.size}<span><strong>Size:</strong> {creature.size}</span>{/if}
              {#if creature.alignment}<span><strong>Alignment:</strong> {creature.alignment}</span>{/if}
              {#if creature.AC != null}<span><strong>AC:</strong> {creature.AC}</span>{/if}
              {#if creature.hp?.average != null}<span><strong>HP:</strong> {creature.hp.average}{creature.hp.diceExpression ? ` (${creature.hp.diceExpression})` : ''}</span>{/if}
              {#if creature.speed}<span><strong>Speed:</strong> {creature.speed}</span>{/if}
              {#if creature.senses}<span><strong>Senses:</strong> {creature.senses}</span>{/if}
              {#if creature.languages}<span><strong>Languages:</strong> {creature.languages}</span>{/if}
            </div>

            <!-- Ability scores -->
            {#if creature.stats}
              <div class="ref-stat-row">
                {#each ['STR','DEX','CON','INT','WIS','CHA'] as s}
                  {@const val = creature.stats[s] ?? 10}
                  {@const mod = Math.floor((val - 10) / 2)}
                  <div class="ref-stat-box">
                    <span class="ref-stat-label">{s}</span>
                    <span class="ref-stat-val">{val}</span>
                    <span class="ref-stat-mod">{mod >= 0 ? '+' : ''}{mod}</span>
                  </div>
                {/each}
              </div>
            {/if}

            <!-- Saving throws & skills -->
            {#if creature.savingThrows && Object.keys(creature.savingThrows).length}
              <div class="ref-meta-row" style="margin-top:0.25rem;">
                <span><strong>Saves:</strong> {Object.entries(creature.savingThrows).map(([k,v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')}</span>
              </div>
            {/if}
            {#if creature.skills && Object.keys(creature.skills).length}
              <div class="ref-meta-row">
                <span><strong>Skills:</strong> {Object.entries(creature.skills).map(([k,v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(', ')}</span>
              </div>
            {/if}

            <!-- Resistances / immunities / vulnerabilities -->
            {#if creature.resistances?.length}
              <div class="ref-meta-row"><span><strong>Resistances:</strong> {creature.resistances.join(', ')}</span></div>
            {/if}
            {#if creature.immunities?.length}
              <div class="ref-meta-row"><span><strong>Immunities:</strong> {creature.immunities.join(', ')}</span></div>
            {/if}
            {#if creature.vulnerabilities?.length}
              <div class="ref-meta-row"><span><strong>Vulnerabilities:</strong> {creature.vulnerabilities.join(', ')}</span></div>
            {/if}

            <!-- Traits -->
            {#if creature.traits?.length}
              <div class="ref-section-title">Traits</div>
              {#each creature.traits as t}
                <div class="ref-action"><strong>{t.name}.</strong> {t.description}</div>
              {/each}
            {/if}

            <!-- Actions -->
            {#if creature.actions?.length}
              <div class="ref-section-title">Actions</div>
              {#each creature.actions as a}
                <div class="ref-action">
                  <strong>{a.name}.</strong> {a.description}
                  {#if a.attackBonus != null || a.damageDice}
                    <span class="ref-action-stats">
                      {#if a.attackBonus != null}+{a.attackBonus} to hit{/if}
                      {#if a.damageDice} · {a.damageDice}{a.damageType ? ` ${a.damageType}` : ''}{/if}
                      {#if a.saveDC} · DC {a.saveDC} {a.saveAbility}{/if}
                    </span>
                  {/if}
                </div>
              {/each}
            {/if}

            <!-- Reactions -->
            {#if creature.reactions?.length}
              <div class="ref-section-title">Reactions</div>
              {#each creature.reactions as r}
                <div class="ref-action"><strong>{r.name}.</strong> {r.description}</div>
              {/each}
            {/if}

            <!-- Legendary Actions -->
            {#if creature.legendaryActions?.length}
              <div class="ref-section-title">Legendary Actions</div>
              {#each creature.legendaryActions as la}
                <div class="ref-action"><strong>{la.name}.</strong> {la.description}</div>
              {/each}
            {/if}
          </div>
        {/if}
      </button>
    {/each}
    {#if monsterList.length === 0}
      <p class="ref-empty">No creatures loaded.</p>
    {/if}
  </div>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════ -->

<!-- Combat Setup Modal -->
{#if showStartModal}
  <div class="modal-backdrop" on:click|self={() => showStartModal = false} role="presentation">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Combat Setup">
      <CombatSetup
        players={campaignData?.players ?? []}
        {monsterList}
        on:start={handleCombatStart}
      />
      <button class="btn btn-ghost btn-sm" style="margin-top: 1rem;" on:click={() => showStartModal = false}>
        Cancel
      </button>
    </div>
  </div>
{/if}

<!-- Character Sheet Modal -->
{#if sheetChar}
  {@const p = sheetChar}
  {@const isMe = p._id === myCharId}
  <div class="modal-backdrop" on:click|self={closeSheet} role="presentation">
    <div class="modal modal-sheet" role="dialog" aria-modal="true" aria-label="Character Sheet">

      <!-- Header -->
      <div class="sheet-header">
        <div class="char-av char-av-lg">{p.name.slice(0,2).toUpperCase()}</div>
        <div class="sheet-identity">
          <h2 class="sheet-name">{p.name} {#if isMe}<span class="badge">You</span>{/if}</h2>
          <div class="sheet-meta">
            Lv {p.level} · {[p.race, p.class, p.subclass].filter(Boolean).join(' ')}
            {#if p.background} · {p.background}{/if}
            {#if p.alignment} · {p.alignment}{/if}
          </div>
        </div>
        <div class="sheet-header-actions">
          {#if isDM || isMe}
            <button class="btn btn-secondary btn-sm" on:click|stopPropagation={() => { closeSheet(); openEdit(p); }}>
              Edit HP
            </button>
          {/if}
          {#if isDM && !subclassEditing}
            <button class="btn btn-ghost btn-sm" on:click|stopPropagation={() => startSubclassEdit(p)}>
              Edit Subclass
            </button>
          {/if}
          <button class="btn btn-ghost btn-sm" on:click={closeSheet}>✕</button>
        </div>
      </div>

      <!-- Subclass inline edit (DM only) -->
      {#if subclassEditing && isDM}
        <div class="subclass-edit-row">
          <span class="sheet-section-title" style="margin:0;">Subclass</span>
          {#if SUBCLASSES[p.class]}
            <select class="subclass-select" bind:value={subclassEditVal}>
              <option value="">— none —</option>
              {#each SUBCLASSES[p.class].options as sub}<option value={sub}>{sub}</option>{/each}
            </select>
          {:else}
            <input class="subclass-input" bind:value={subclassEditVal} placeholder="Enter subclass" />
          {/if}
          <button class="btn btn-primary btn-sm" on:click={() => saveSubclass(p)}>Save</button>
          <button class="btn btn-ghost btn-sm" on:click={() => subclassEditing = false}>Cancel</button>
        </div>
      {/if}

      <!-- Ability scores -->
      {#if p.stats}
        <div class="sheet-section-title">Ability Scores</div>
        <div class="stat-row">
          {#each ['STR','DEX','CON','INT','WIS','CHA'] as s}
            {@const val = p.stats[s] ?? 10}
            {@const mod = Math.floor((val - 10) / 2)}
            <div class="stat-box">
              <span class="stat-label">{s}</span>
              <span class="stat-val">{val}</span>
              <span class="stat-mod text-xs text-muted">{mod >= 0 ? '+' : ''}{mod}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Combat stats -->
      <div class="sheet-section-title">Combat</div>
      <div class="sheet-combat-grid">
        <div class="cstat">
          <span class="cstat-label">HP</span>
          <span class="cstat-val">{p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0}</span>
        </div>
        {#if p.combat?.tempHp > 0}
          <div class="cstat">
            <span class="cstat-label">Temp HP</span>
            <span class="cstat-val">{p.combat.tempHp}</span>
          </div>
        {/if}
        <div class="cstat">
          <span class="cstat-label">AC</span>
          <span class="cstat-val">{p.combat?.AC ?? 10}</span>
        </div>
        <div class="cstat">
          <span class="cstat-label">Speed</span>
          <span class="cstat-val">{p.combat?.speed ?? 30}ft</span>
        </div>
        <div class="cstat">
          <span class="cstat-label">Initiative</span>
          <span class="cstat-val">{p.combat?.initiativeMod >= 0 ? '+' : ''}{p.combat?.initiativeMod ?? 0}</span>
        </div>
        {#if p.combat?.hitDice}
          <div class="cstat">
            <span class="cstat-label">Hit Dice</span>
            <span class="cstat-val">{p.combat.hitDice}</span>
          </div>
        {/if}
      </div>
      <HpBar current={p.combat?.hpCurrent ?? 0} max={p.combat?.hpMax ?? 1} />

      <!-- Conditions -->
      {#if p.conditions?.length}
        <div class="sheet-section-title">Conditions</div>
        <div class="pill-row-sm" style="margin-bottom: 0.25rem;">
          {#each p.conditions as cond}
            <span class="pill pill-red">{cond}</span>
          {/each}
        </div>
      {/if}

      <!-- Spell slots -->
      {#if p.spellSlots && Object.keys(p.spellSlots).length}
        {@const slotEntries = Object.entries(p.spellSlots).filter(([,v]) => v?.max > 0).sort(([a],[b]) => Number(a)-Number(b))}
        {#if slotEntries.length}
          <div class="sheet-section-title">Spell Slots</div>
          <div class="slot-grid">
            {#each slotEntries as [lvl, slot]}
              <div class="slot-box">
                <span class="slot-label">Lv {lvl}</span>
                <span class="slot-val">{(slot.max - (slot.used ?? 0))}/{slot.max}</span>
              </div>
            {/each}
          </div>
        {/if}
      {/if}

      <!-- Known spells -->
      {#if p.knownSpells?.length}
        <div class="sheet-section-title">Known Spells</div>
        {#each spellsByLevel(p.knownSpells) as group}
          <div class="spell-group-label">
            {group.lvl === 0 ? 'Cantrips' : `Level ${group.lvl}`}
          </div>
          <div class="spell-list">
            {#each group.list as spell}
              <div class="spell-row">
                <div class="spell-row-top">
                  <span class="spell-name">{spell.name}</span>
                  <span class="spell-tags">
                    {#if spell.school}<span class="spell-tag">{spell.school}</span>{/if}
                    {#if spell.concentration}<span class="spell-tag spell-tag-conc">C</span>{/if}
                  </span>
                </div>
                <div class="spell-row-meta text-xs text-muted">
                  {#if spell.castingTime}{spell.castingTime}{/if}
                  {#if spell.range} · {spell.range}{/if}
                  {#if spell.duration} · {spell.duration}{/if}
                  {#if spell.components} · {spell.components}{/if}
                </div>
                {#if spell.damageType || spell.damageDice || spell.healDice || spell.saveAbility}
                  <div class="spell-row-effect text-xs">
                    {#if spell.damageDice}{spell.damageDice}{/if}
                    {#if spell.damageType} {spell.damageType}{/if}
                    {#if spell.healDice}Heal {spell.healDice}{/if}
                    {#if spell.saveAbility} · {spell.saveAbility} save{/if}
                    {#if spell.halfOnSave} (half){/if}
                  </div>
                {/if}
                {#if spell.description}
                  <div class="spell-desc text-xs text-muted">{spell.description}</div>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      {:else}
        <div class="sheet-section-title">Known Spells</div>
        <p class="text-muted text-sm" style="margin: 0.25rem 0 0.5rem;">No spells learned.</p>
      {/if}

    </div>
  </div>
{/if}

<!-- HP Edit Modal -->
{#if editingPlayer}
  <div class="modal-backdrop" on:click|self={closeEdit} role="presentation">
    <div class="modal modal-sm" role="dialog" aria-modal="true" aria-label="Edit HP">
      <h3 class="modal-title">Edit — {editingPlayer.name}</h3>
      <div class="grid-2">
        <div class="field"><label>HP Current</label><input type="number" bind:value={editForm.hpCurrent} /></div>
        <div class="field"><label>HP Max</label><input type="number" bind:value={editForm.hpMax} /></div>
        {#if isDM}
          <div class="field"><label>AC</label><input type="number" bind:value={editForm.AC} /></div>
          <div class="field"><label>Speed (ft)</label><input type="number" bind:value={editForm.speed} /></div>
          <div class="field"><label>Initiative Mod</label><input type="number" bind:value={editForm.initiativeMod} /></div>
        {/if}
      </div>
      <div class="flex-center gap-sm" style="margin-top: 0.875rem;">
        <button class="btn btn-primary" on:click={saveEdit} disabled={editSaving}>
          {editSaving ? 'Saving…' : 'Save'}
        </button>
        <button class="btn btn-ghost" on:click={closeEdit}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- Dice Tray (floating, always accessible) -->
<DiceTray bind:open={diceTrayOpen} />

{/if}

<style>
  /* ── Combat layout ──────────────────────────────────────────────────────────── */
  .combat-layout {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 96px); /* subtract nav + session-bar + tabs */
    overflow: hidden;
  }

  /* Monster cards rail */
  .monster-rail {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding: 0.625rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .monster-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.625rem;
    min-width: 120px;
    max-width: 150px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .monster-card.defeated { opacity: 0.4; }
  .mc-head { display: flex; align-items: baseline; gap: 0.375rem; }
  .mc-name { font-size: 0.8125rem; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-sub  { margin-top: 0.125rem; }
  .pill-row-sm { display: flex; flex-wrap: wrap; gap: 2px; }

  /* Main engine row */
  .battle-engine {
    flex: 1;
    display: flex;
    gap: 0;
    overflow: hidden;
  }

  .engine-left {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .engine-right {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .action-section {
    width: 260px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .log-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .section-heading {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    padding: 0.4rem 0.625rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface-2);
    flex-shrink: 0;
  }

  /* Party sidebar */
  .party-sidebar {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .sidebar-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    padding: 0.375rem 0.625rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .sidebar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.625rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .sidebar-row:last-child { border-bottom: none; }
  .sidebar-row.sidebar-mine { background: #eff6ff; }
  .sidebar-av {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .sidebar-info { flex: 1; min-width: 0; }
  .sidebar-name { font-size: 0.8125rem; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sidebar-hp   { display: block; }
  .edit-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    cursor: pointer;
    flex-shrink: 0;
  }
  .edit-btn:hover { background: var(--surface-3); }

  /* Idle state */
  .idle-state { display: flex; flex-direction: column; }
  .idle-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    margin-bottom: 0.5rem;
  }
  .roster-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }
  .roster-card {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    text-align: center;
  }
  .roster-card.roster-mine { background: #eff6ff; border-color: #bfdbfe; }
  .roster-av {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted);
  }
  .roster-name { font-size: 0.8125rem; font-weight: 600; }
  .roster-meta { font-size: 0.7rem; }
  .roster-stat { font-size: 0.7rem; }

  /* ── World layout ─────────────────────────────────────────────────────────── */
  .world-layout {
    display: flex;
    gap: 0;
    height: calc(100vh - 96px);
    overflow: hidden;
  }

  .world-left {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 1rem;
  }

  .world-feed {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .skill-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1rem;
    box-shadow: var(--shadow-sm);
  }

  .roll-feed {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }
  .roll-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.8125rem;
  }
  .roll-row:last-child { border-bottom: none; }
  .roll-name   { flex-shrink: 0; font-weight: 600; }
  .roll-result { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .roll-total  { font-weight: 700; min-width: 2em; text-align: right; }

  /* ── Abilities tab ─────────────────────────────────────────────────────────── */
  .abilities-tab-wrap {
    height: calc(100vh - 96px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  /* ── Characters tab ────────────────────────────────────────────────────────── */
  .page-pad { padding: 1.25rem; }

  .char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.875rem; }

  .char-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .char-card:hover { border-color: var(--primary, #60a5fa); box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, #60a5fa) 20%, transparent); }
  .char-card.char-mine { border-color: #93c5fd; }

  .char-head { display: flex; align-items: flex-start; gap: 0.625rem; }
  .char-av {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.75rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .char-name { font-weight: 700; font-size: 0.9375rem; display: flex; align-items: center; gap: 0.375rem; }
  .char-meta { font-size: 0.8125rem; }

  .stat-row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.25rem;
  }
  .stat-box {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.3rem 0.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .stat-label { font-size: 0.65rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; }
  .stat-val   { font-size: 0.875rem; font-weight: 700; }
  .stat-mod   {}

  .combat-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.25rem;
  }
  .cstat {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.35rem 0.375rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .cstat-label { font-size: 0.65rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; }
  .cstat-val   { font-size: 0.875rem; font-weight: 700; }

  /* ── Lore tab ─────────────────────────────────────────────────────────────── */
  .lore-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .lore-entry {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    box-shadow: var(--shadow-sm);
  }
  .lore-entry-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.375rem; }
  .lore-entry-title { font-weight: 600; font-size: 0.9rem; flex: 1; }
  .lore-entry-body { line-height: 1.6; }

  /* ── Modals ────────────────────────────────────────────────────────────────── */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    max-width: 640px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: var(--shadow-md);
  }

  .modal-sm { max-width: 420px; }
  .modal-title { font-size: 1rem; font-weight: 700; margin-bottom: 1rem; }

  /* ── Character Sheet Modal ────────────────────────────────────────────────── */
  .modal-sheet { max-width: 680px; display: flex; flex-direction: column; gap: 0.75rem; }

  .sheet-header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border);
  }
  .char-av-lg {
    width: 52px; height: 52px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 0.875rem;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .sheet-identity { flex: 1; min-width: 0; }
  .sheet-name { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem; display: flex; align-items: center; gap: 0.375rem; }
  .sheet-meta { font-size: 0.8125rem; color: var(--text-muted); }
  .sheet-header-actions { display: flex; gap: 0.375rem; flex-shrink: 0; }

  .sheet-section-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    margin-bottom: 0.375rem;
  }

  .sheet-combat-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  .sheet-combat-grid .cstat { min-width: 70px; flex: 1; }

  /* Spell slots */
  .slot-grid { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .slot-box {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.3rem 0.5rem;
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    min-width: 52px;
  }
  .slot-label { font-size: 0.65rem; font-weight: 600; color: var(--text-faint); text-transform: uppercase; }
  .slot-val   { font-size: 0.875rem; font-weight: 700; }

  /* Spells */
  .spell-group-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-muted);
    margin: 0.5rem 0 0.25rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }
  .spell-list { display: flex; flex-direction: column; gap: 0.375rem; }
  .spell-row {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .spell-row-top { display: flex; align-items: baseline; gap: 0.5rem; }
  .spell-name { font-weight: 600; font-size: 0.875rem; }
  .spell-tags { display: flex; gap: 0.25rem; margin-left: auto; }
  .spell-tag {
    font-size: 0.65rem;
    padding: 0 0.375rem;
    border-radius: 99px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    color: var(--text-muted);
  }
  .spell-tag-conc { background: #fef3c7; border-color: #fde68a; color: #92400e; }
  .spell-row-meta  { }
  .spell-row-effect { font-weight: 600; color: var(--text); }
  .spell-desc {
    margin-top: 0.125rem;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ── Empty state ────────────────────────────────────────────────────────────── */
  .empty-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 2.5rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
    box-shadow: var(--shadow-sm);
  }

  /* ── Responsive ────────────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .battle-engine { flex-direction: column; }
    .engine-left  { width: 100%; border-right: none; border-bottom: 1px solid var(--border); max-height: 240px; }
    .engine-right { flex: 1; }
    .action-section { width: 220px; }
    .world-layout { flex-direction: column; }
    .world-left { width: 100%; border-right: none; border-bottom: 1px solid var(--border); max-height: 320px; }
    .char-grid { grid-template-columns: 1fr; }
    .roster-grid { grid-template-columns: repeat(3, 1fr); }
    .stat-row { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 600px) {
    .combat-stats { grid-template-columns: repeat(2, 1fr); }
    .stat-row { grid-template-columns: repeat(3, 1fr); }
    .roster-grid { grid-template-columns: 1fr 1fr; }
  }

  /* ── Reference tabs (Spells / Creatures) ───────────────────────────────────── */
  .ref-tab {
    padding: 0.75rem 1.25rem;
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .ref-search-bar { margin-bottom: 0.5rem; }
  .creature-filters { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .spell-class-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.75rem;
  }
  .spell-class-btn {
    padding: 0.2rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    color: var(--text-muted);
    font-family: inherit;
    transition: all 0.1s;
  }
  .spell-class-btn:hover { background: var(--surface-3); }
  .spell-class-btn.active { background: var(--primary, #60a5fa); border-color: var(--primary, #60a5fa); color: #fff; }
  /* Category toggle pills */
  .spell-category-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.75rem 1rem 0;
  }
  .spell-cat-btn {
    padding: 0.3rem 0.85rem;
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    cursor: pointer;
    color: var(--text-muted);
    font-family: inherit;
    transition: all 0.1s;
    opacity: 0.55;
  }
  .spell-cat-btn:hover { opacity: 0.85; background: var(--surface-3); }
  .spell-cat-btn.active { background: var(--primary, #60a5fa); border-color: var(--primary, #60a5fa); color: #fff; opacity: 1; }
  .ref-section-block { margin-bottom: 1.5rem; }
  .ref-block-header {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    padding: 0.5rem 1rem 0.25rem;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.25rem;
  }
  .ref-filter-select {
    padding: 0.375rem 0.625rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
  }
  .subclass-edit-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .subclass-select, .subclass-input {
    flex: 1;
    min-width: 160px;
    padding: 0.3rem 0.5rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.875rem;
    font-family: inherit;
  }
  .ref-search {
    width: 100%;
    max-width: 360px;
    padding: 0.375rem 0.625rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 0.875rem;
  }
  .ref-group { margin-bottom: 0.5rem; }
  .ref-group-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.25rem;
  }
  .ref-card {
    display: block;
    width: 100%;
    text-align: left;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.25rem;
    cursor: pointer;
    transition: background 0.1s;
    color: var(--text);
    font-size: 0.875rem;
  }
  .ref-card:hover { background: var(--surface-2); }
  .ref-card.ref-open { background: var(--surface-2); border-color: var(--border-strong, var(--border)); }
  .ref-card-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ref-card-name { font-weight: 600; flex: 1; }
  .ref-card-meta { font-size: 0.75rem; color: var(--text-muted); }
  .ref-card-badges { display: flex; align-items: center; gap: 0.25rem; }
  .ref-chevron { font-size: 0.65rem; color: var(--text-faint); margin-left: auto; flex-shrink: 0; }
  .ref-card-body { padding-top: 0.5rem; }
  .ref-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .ref-classes {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--text-faint);
    font-style: italic;
  }
  .ref-description {
    margin: 0.375rem 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.5;
  }
  .ref-section-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-faint);
    margin: 0.5rem 0 0.2rem;
    padding-bottom: 0.15rem;
    border-bottom: 1px solid var(--border);
  }
  .ref-action {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 0.25rem;
    line-height: 1.45;
  }
  .ref-action-stats {
    font-size: 0.75rem;
    color: var(--text-faint);
    margin-left: 0.25rem;
  }
  .ref-stat-row {
    display: flex;
    gap: 0.375rem;
    margin: 0.375rem 0 0.25rem;
  }
  .ref-stat-box {
    flex: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.25rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .ref-stat-label { font-size: 0.6rem; font-weight: 700; color: var(--text-faint); text-transform: uppercase; }
  .ref-stat-val   { font-size: 0.875rem; font-weight: 700; }
  .ref-stat-mod   { font-size: 0.7rem; color: var(--text-muted); }
  .ref-empty { color: var(--text-muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
