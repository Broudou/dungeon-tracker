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
  let allSpells     = [];
  let expandedSpells    = new Set();
  let expandedCreatures = new Set();
  let spellFilter   = '';
  let creatureFilter = '';

  // HP edit modal
  let editingPlayer = null;
  let editForm      = {};
  let editSaving    = false;

  // Character sheet modal
  let sheetChar = null;

  function openSheet(p) { sheetChar = p; }
  function closeSheet() { sheetChar = null; }

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

  $: isDM    = !!$auth?.user;
  $: phase   = sessionData?.phase ?? 'open-world';
  $: myCharObj = campaignData?.players?.find(p => p._id === myCharId) ?? null;

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
    />
  </div>
{/if}

<!-- ══════════════════════════════════════════════ SPELLS TAB ══ -->
{#if activeTab === 'spells' && isDM}
  <div class="ref-tab">
    <div class="ref-search-bar">
      <input class="ref-search" type="search" placeholder="Filter spells…" bind:value={spellFilter} />
    </div>
    {#each spellsByLevel(allSpells.filter(s => !spellFilter || s.name.toLowerCase().includes(spellFilter.toLowerCase()))) as group (group.lvl)}
      <div class="ref-group">
        <div class="ref-group-label">{group.lvl === 0 ? 'Cantrips' : `Level ${group.lvl}`}</div>
        {#each group.list as spell (spell._id)}
          {@const open = expandedSpells.has(spell._id)}
          <button class="ref-card" class:ref-open={open} on:click={() => { if (open) expandedSpells.delete(spell._id); else expandedSpells.add(spell._id); expandedSpells = expandedSpells; }}>
            <div class="ref-card-head">
              <span class="ref-card-name">{spell.name}</span>
              <span class="ref-card-meta">{spell.school}</span>
              <span class="ref-chevron">{open ? '▲' : '▼'}</span>
            </div>
            {#if open}
              <div class="ref-card-body">
                <div class="ref-meta-row">
                  {#if spell.castingTime}<span><strong>Cast:</strong> {spell.castingTime}</span>{/if}
                  {#if spell.range}<span><strong>Range:</strong> {spell.range}</span>{/if}
                  {#if spell.concentration}<span class="pill pill-yellow">Concentration</span>{/if}
                </div>
                {#if spell.classes?.length}
                  <div class="ref-classes">{spell.classes.join(', ')}</div>
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

<!-- ══════════════════════════════════════════════ CREATURES TAB ══ -->
{#if activeTab === 'creatures' && isDM}
  <div class="ref-tab">
    <div class="ref-search-bar">
      <input class="ref-search" type="search" placeholder="Filter creatures…" bind:value={creatureFilter} />
    </div>
    {@const filtered = monsterList.filter(m => !creatureFilter || m.name.toLowerCase().includes(creatureFilter.toLowerCase()))}
    {#each filtered as creature (creature._id)}
      {@const open = expandedCreatures.has(creature._id)}
      <button class="ref-card" class:ref-open={open} on:click={() => { if (open) expandedCreatures.delete(creature._id); else expandedCreatures.add(creature._id); expandedCreatures = expandedCreatures; }}>
        <div class="ref-card-head">
          <span class="ref-card-name">{creature.name}</span>
          <div class="ref-card-badges">
            {#if creature.cr != null}<span class="badge">CR {creature.cr}</span>{/if}
            {#if creature.type}<span class="ref-card-meta">{creature.type}</span>{/if}
          </div>
          <span class="ref-chevron">{open ? '▲' : '▼'}</span>
        </div>
        {#if open}
          <div class="ref-card-body">
            <div class="ref-meta-row">
              {#if creature.size}<span><strong>Size:</strong> {creature.size}</span>{/if}
              {#if creature.alignment}<span><strong>Alignment:</strong> {creature.alignment}</span>{/if}
              {#if creature.AC != null}<span><strong>AC:</strong> {creature.AC}</span>{/if}
              {#if creature.hp != null}<span><strong>HP:</strong> {creature.hp}</span>{/if}
              {#if creature.speed}<span><strong>Speed:</strong> {creature.speed}</span>{/if}
            </div>
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
          <button class="btn btn-ghost btn-sm" on:click={closeSheet}>✕</button>
        </div>
      </div>

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
  .ref-search-bar { margin-bottom: 0.75rem; }
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
  .ref-empty { color: var(--text-muted); font-size: 0.875rem; padding: 1rem 0; }
</style>
