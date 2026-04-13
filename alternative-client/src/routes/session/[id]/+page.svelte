<script>
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import { auth } from '$lib/stores/auth';
  import { combat, setCombat, pendingActions, currentCombatant } from '$lib/stores/combat';
  import { session, roster, identity, worldFeed, worldRolls } from '$lib/stores/session';
  import { connectSocket, disconnectSocket, getSocket } from '$lib/socket';

  import InitiativeTracker  from '$lib/components/combat/InitiativeTracker.svelte';
  import CombatLog          from '$lib/components/combat/CombatLog.svelte';
  import ActionPanel        from '$lib/components/combat/ActionPanel.svelte';
  import ValidationQueue    from '$lib/components/combat/ValidationQueue.svelte';
  import CombatSetup        from '$lib/components/combat/CombatSetup.svelte';
  import LoreCardPublisher  from '$lib/components/world/LoreCardPublisher.svelte';
  import LoreCardFeed       from '$lib/components/world/LoreCardFeed.svelte';
  import SkillCheckPanel    from '$lib/components/world/SkillCheckPanel.svelte';
  import DiceTray           from '$lib/components/dice/DiceTray.svelte';
  import HpBar              from '$lib/components/ui/HpBar.svelte';

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

  // HP edit modal
  let editingPlayer = null;
  let editForm      = {};
  let editSaving    = false;

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

    // Load session
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
      sessionData = await res.json();
      session.set(sessionData);
    } catch (e) { error = e.message; loading = false; return; }

    // Load campaign (non-fatal)
    try {
      const res = await fetch(`/api/campaigns/${sessionData.campaignId}`, { credentials: 'include' });
      if (res.ok) campaignData = await res.json();
    } catch { /* non-fatal */ }

    // Load monster list for DM combat setup (non-fatal)
    if (isDM) {
      try {
        const res = await fetch('/api/monsters?limit=500', { credentials: 'include' });
        if (res.ok) monsterList = await res.json();
      } catch { /* non-fatal — CombatSetup uses local data fallback */ }
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

    socket.on('world:loreFeed', cards => worldFeed.set(cards));
    socket.on('world:loreCard', card  => worldFeed.update(f => [...f, card]));
    socket.on('world:roll',     r     => { worldRollFeed = [...worldRollFeed.slice(-50), r]; });

    socket.on('player:updated', ({ playerId, combat: c, conditions }) => {
      if (campaignData) {
        campaignData = {
          ...campaignData,
          players: campaignData.players.map(p => p._id === playerId ? { ...p, combat: c, conditions } : p),
        };
      }
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
  <button class="tab-btn" class:active={activeTab==='world'}      on:click={() => activeTab='world'}>World</button>
  <button class="tab-btn" class:active={activeTab==='characters'} on:click={() => activeTab='characters'}>Characters</button>
  {#if isDM}
    <button class="tab-btn" class:active={activeTab==='lore'} on:click={() => activeTab='lore'}>Lore</button>
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

<!-- ══════════════════════════════════════════════ WORLD TAB ══ -->
{#if activeTab === 'world'}
  <div class="world-layout">
    {#if isDM}
      <div class="world-left">
        <LoreCardPublisher campaignId={sessionData.campaignId} />
      </div>
    {/if}

    <div class="world-feed">
      <!-- Skill check panel for players -->
      {#if !isDM && myCharObj}
        <div class="skill-card">
          <SkillCheckPanel character={myCharObj} />
        </div>
      {/if}

      <!-- World roll feed -->
      {#if worldRollFeed.length}
        <div class="roll-feed">
          {#each [...worldRollFeed].reverse() as r}
            <div class="roll-row">
              <span class="roll-name text-sm font-medium">{r.formula}</span>
              <span class="roll-result text-sm text-muted">{r.context}</span>
              <span class="roll-total">{r.result}</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Lore card feed -->
      <LoreCardFeed cards={$worldFeed} />
    </div>
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
            <div class="char-card" class:char-mine={isMe}>
              <div class="char-head">
                <div class="char-av">{p.name.slice(0,2).toUpperCase()}</div>
                <div>
                  <div class="char-name">{p.name} {#if isMe}<span class="badge">You</span>{/if}</div>
                  <div class="char-meta text-sm text-muted">Lv {p.level} {p.race} {p.class}</div>
                </div>
                {#if isDM || isMe}
                  <button class="btn btn-secondary btn-sm" style="margin-left: auto;" on:click={() => openEdit(p)}>
                    Edit HP
                  </button>
                {/if}
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
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ══════════════════════════════════════════════ LORE TAB (DM only) ══ -->
{#if activeTab === 'lore' && isDM}
  <div class="page-pad">
    <div class="container">
      {#if !campaignData?.lore?.length}
        <div class="empty-card">No lore entries in this campaign.</div>
      {:else}
        <div class="lore-list">
          {#each campaignData.lore as entry (entry._id)}
            <div class="lore-entry">
              <div class="lore-entry-head">
                <span class="lore-entry-title">{entry.title}</span>
                <span class="badge">{entry.category}</span>
                {#if entry.visibleToPlayers}<span class="badge">Public</span>{/if}
              </div>
              {#if entry.body}
                <p class="lore-entry-body text-sm text-muted">{entry.body}</p>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
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
  }
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
</style>
