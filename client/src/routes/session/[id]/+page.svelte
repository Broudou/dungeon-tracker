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

  let loading  = true;
  let error    = '';
  let activeTab = 'combat';
  let diceTrayOpen = false;

  let sessionData  = null;
  let campaignData = null;

  let showStartModal = false;
  let monsterList    = [];

  let myCharId    = null;
  let myCharObj   = null;
  let displayName = '';
  let worldRollFeed = [];
  let toast = '';

  let editingPlayer = null;
  let editForm = {};
  let editSaving = false;

  $: isDM = !!$auth?.user;
  $: phase = sessionData?.phase ?? 'open-world';
  $: myCharObj = campaignData?.players?.find(p => p._id === myCharId) || null;

  onMount(async () => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(`session_${sessionId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          myCharId    = parsed.characterId || null;
          displayName = parsed.displayName || '';
        } catch { /* ignore */ }
      }
    }

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json()).message);
      sessionData = await res.json();
      session.set(sessionData);
    } catch (e) {
      error = e.message;
      loading = false;
      return;
    }

    try {
      const res = await fetch(`/api/campaigns/${sessionData.campaignId}`, { credentials: 'include' });
      if (res.ok) campaignData = await res.json();
    } catch { /* non-fatal */ }

    if (isDM) {
      try {
        const mRes = await fetch('/api/monsters?limit=500', { credentials: 'include' });
        if (mRes.ok) monsterList = await mRes.json();
      } catch { /* non-fatal — CombatSetup falls back to local data */ }
    }

    // Read the cookie directly — $auth may still be loading at this point
    // so the isDM reactive variable cannot be trusted here.
    const token = getJwtFromCookie();
    const authPayload = token
      ? { token, sessionId }
      : { displayName: displayName || 'Player', characterId: myCharId, sessionId };

    const socket = connectSocket(sessionId, authPayload);

    socket.on('session:role',         (data) => identity.set(data));
    socket.on('session:roster',       (r)    => roster.set(r));
    socket.on('session:phase',        (p)    => { if (sessionData) sessionData.phase = p; sessionData = sessionData; });

    socket.on('combat:state',         (s)    => setCombat(s));
    socket.on('combat:actionPending', ()     => { /* handled via store */ });
    socket.on('combat:actionResolved', ({ status, reason }) => {
      if (status === 'rejected' && reason) {
        toast = `Action rejected: ${reason}`;
        setTimeout(() => toast = '', 4000);
      }
    });

    socket.on('world:loreFeed',       (cards) => worldFeed.set(cards));
    socket.on('world:loreCard',       (card)  => worldFeed.update(f => [...f, card]));
    socket.on('world:roll',           (r)     => worldRollFeed = [...worldRollFeed.slice(-50), r]);

    socket.on('player:updated', ({ playerId, combat, conditions }) => {
      if (campaignData) {
        campaignData = {
          ...campaignData,
          players: campaignData.players.map(p =>
            p._id === playerId ? { ...p, combat, conditions } : p
          ),
        };
      }
    });

    socket.emit('combat:getState');

    loading = false;
  });

  onDestroy(() => disconnectSocket());

  function getJwtFromCookie() {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function openEdit(player) {
    editingPlayer = player;
    editForm = {
      hpCurrent:    player.combat?.hpCurrent    ?? 0,
      hpMax:        player.combat?.hpMax        ?? 0,
      AC:           player.combat?.AC           ?? 10,
      speed:        player.combat?.speed        ?? 30,
      initiativeMod:player.combat?.initiativeMod ?? 0,
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
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ combat: { ...editingPlayer.combat, ...editForm } }),
          }
        );
        if (res.ok) {
          const updated = await res.json();
          campaignData = {
            ...campaignData,
            players: campaignData.players.map(p => p._id === updated._id ? { ...p, ...updated } : p),
          };
        }
      } else {
        getSocket()?.emit('player:updateSelf', { hpCurrent: Number(editForm.hpCurrent) });
      }
    } catch { /* silent */ }
    editSaving = false;
    closeEdit();
  }

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

{#if toast}
  <div class="toast">{toast}</div>
{/if}

{#if loading}
  <div class="loading" style="padding:4rem; text-align:center;">Loading session</div>
{:else if error}
  <div class="page"><div class="container"><div class="alert alert-error">{error}</div></div></div>
{:else}

<!-- Session nav bar -->
<div class="session-nav">
  <div class="session-nav-left">
    <span class="session-brand">{campaignData?.name ?? 'Session'}</span>
    <span class="session-key">{sessionData.joinKey}</span>
    <span class="phase-badge phase-{phase}">
      {phase === 'combat' ? 'Combat' : 'World'}
    </span>
  </div>
  <div class="session-nav-right">
    <span class="roster-count">{$roster.length} connected</span>
    {#if isDM && phase !== 'combat'}
      <a href="/campaign/{sessionData.campaignId}" class="btn btn-ghost btn-sm">Edit Campaign</a>
    {/if}
  </div>
</div>

<!-- Tab bar -->
<div class="session-tabs">
  <button class="tab-btn" class:active={activeTab==='combat'} on:click={() => activeTab='combat'}>
    Combat
  </button>
  <button class="tab-btn" class:active={activeTab==='world'} on:click={() => activeTab='world'}>
    World
  </button>
  <button class="tab-btn" class:active={activeTab==='characters'} on:click={() => activeTab='characters'}>
    Characters
  </button>
  {#if isDM}
    <button class="tab-btn" class:active={activeTab==='lore'} on:click={() => activeTab='lore'}>
      Lore
    </button>
  {/if}
</div>

<!-- ════════════════════════════════════════════════════════ COMBAT TAB -->
{#if activeTab === 'combat'}
  <div class="combat-layout">

    <!-- Zone A: monsters (top rail) -->
    {#if $combat?.state === 'active'}
      {@const monsters = $combat.initiativeOrder.filter(c => c.entityType !== 'player')}
      {#if monsters.length}
        <div class="monster-rail">
          {#each monsters as c (c.instanceId)}
            <div class="monster-card" class:defeated={c.isDefeated}>
              <div class="mc-header">
                <span class="mc-name">{c.name}</span>
                {#if c.cr}<span class="badge badge-gold" style="font-size:0.6rem;">CR {c.cr}</span>{/if}
              </div>
              <HpBar current={c.currentHp} max={c.maxHp} />
              <div class="mc-stats">AC {c.ac}</div>
              {#if c.conditions.length}
                <div class="mc-pills">
                  {#each c.conditions as cond}
                    <span class="pill pill-red">{cond}</span>
                  {/each}
                </div>
              {/if}
              {#each c.customTags as tag}
                <span class="pill pill-{tag.color}">{tag.label}</span>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Zone B: battle engine (middle) -->
    <div class="battle-engine">
      <!-- Left: initiative tracker -->
      <div class="engine-left">
        {#if $combat?.state === 'active'}
          <InitiativeTracker
            order={$combat.initiativeOrder}
            currentIndex={$combat.currentTurnIndex}
            round={$combat.round}
            {isDM}
            {myCharId}
          />
          {#if campaignData?.players?.length}
            <div class="party-sidebar">
              <p class="party-sidebar-label">Party</p>
              {#each campaignData.players as p (p._id)}
                {@const isMe = p._id === myCharId}
                <div class="party-sidebar-row" class:sidebar-mine={isMe}>
                  <span class="party-sidebar-av">{p.name.slice(0,2).toUpperCase()}</span>
                  <div class="party-sidebar-info">
                    <span class="party-sidebar-name">{p.name}</span>
                    <span class="party-sidebar-hp">HP {p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0} · AC {p.combat?.AC ?? 10}</span>
                  </div>
                  {#if isDM || isMe}
                    <button class="party-sidebar-edit" on:click={() => openEdit(p)} title="Edit">✎</button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {:else if isDM}
          <div class="idle-combat">
            {#if campaignData?.players?.length}
              <p style="font-family:var(--font-heading); font-size:0.68rem; letter-spacing:0.1em;
                text-transform:uppercase; color:var(--gold); margin-bottom:0.6rem;">
                Party Roster
              </p>
              <div class="roster-grid">
                {#each campaignData.players as p (p._id)}
                  <div class="roster-card">
                    <div class="roster-avatar">{p.name.slice(0,2).toUpperCase()}</div>
                    <div class="roster-name">{p.name}</div>
                    <div class="roster-meta">Lv {p.level} {p.class}</div>
                    <div class="roster-hp">
                      <span style="color:var(--text-muted); font-size:0.65rem;">HP</span>
                      {p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0}
                    </div>
                    <div class="roster-hp">
                      <span style="color:var(--text-muted); font-size:0.65rem;">AC</span>
                      {p.combat?.AC ?? 10}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
            <button class="btn btn-primary" style="margin-top:1rem;" on:click={() => showStartModal = true}>
              Begin Encounter
            </button>
          </div>
        {:else}
          <div class="idle-combat">
            {#if campaignData?.players?.length}
              <p style="font-family:var(--font-heading); font-size:0.68rem; letter-spacing:0.1em;
                text-transform:uppercase; color:var(--gold); margin-bottom:0.6rem;">
                Party Roster
              </p>
              <div class="roster-grid">
                {#each campaignData.players as p (p._id)}
                  {@const isMe = p._id === myCharId}
                  <div class="roster-card" class:roster-mine={isMe}>
                    <div class="roster-avatar">{p.name.slice(0,2).toUpperCase()}</div>
                    <div class="roster-name">{p.name}</div>
                    <div class="roster-meta">Lv {p.level} {p.class}</div>
                    <div class="roster-hp">
                      <span style="color:var(--text-muted); font-size:0.65rem;">HP</span>
                      {p.combat?.hpCurrent ?? 0}/{p.combat?.hpMax ?? 0}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
            <p class="text-muted" style="font-family:var(--font-body); font-style:italic; margin-top:1rem; font-size:0.85rem;">
              Awaiting the Dungeon Master to call for arms…
            </p>
          </div>
        {/if}

        {#if isDM && $combat?.state === 'active'}
          <div class="rest-controls">
            <button class="btn btn-ghost btn-sm" on:click={endCombat}>End Combat</button>
          </div>
        {/if}
      </div>

      <!-- Right: combat log + action panel -->
      <div class="engine-right">
        <div class="log-area">
          <CombatLog entries={$combat?.combatLog ?? []} {isDM} />
        </div>
        <div class="action-area">
          <ActionPanel
            currentCombatant={$currentCombatant}
            {myCharId}
            {isDM}
            campaign={campaignData}
            {sessionId}
            combatants={$combat?.initiativeOrder ?? []}
          />
        </div>
      </div>
    </div>

    <!-- Zone C: player characters (bottom rail) -->
    {#if $combat?.state === 'active'}
      {@const players = $combat.initiativeOrder.filter(c => c.entityType === 'player')}
      {#if players.length}
        <div class="player-rail">
          {#each players as c (c.instanceId)}
            {@const isActive = $combat.currentTurnIndex === $combat.initiativeOrder.findIndex(x => x.instanceId === c.instanceId)}
            {@const isMe     = c.entityId === myCharId}
            <div class="player-card" class:active={isActive} class:mine={isMe} class:unconscious={c.currentHp === 0}>
              {#if c.currentHp === 0}
                <div class="unconscious-overlay">FALLEN</div>
              {/if}
              <div class="pc-header">
                <span class="pc-name">{c.name}</span>
                <span class="pc-meta">{c.class} Lv{c.level}</span>
              </div>
              <HpBar current={c.currentHp} max={c.maxHp} />
              <div class="pc-stats">
                <span>AC {c.ac}</span>
                <span>Init {c.initiative >= 0 ? '+' : ''}{c.initiative}</span>
              </div>
              {#if c.conditions.length}
                <div class="mc-pills">
                  {#each c.conditions as cond}
                    <span class="pill pill-red">{cond}</span>
                  {/each}
                </div>
              {/if}
              <div class="resource-pips">
                <span class="res-pip" class:spent={c.actionSpent} title="Action">A</span>
                <span class="res-pip" class:spent={c.bonusActionSpent} title="Bonus Action">B</span>
                <span class="res-pip" class:spent={c.reactionSpent} title="Reaction">R</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#if isDM}
    <ValidationQueue actions={$pendingActions} />
  {/if}

<!-- ════════════════════════════════════════════════════════ WORLD TAB -->
{:else if activeTab === 'world'}
  <div class="world-layout">
    {#if isDM}
      <div class="world-dm-col">
        <LoreCardPublisher campaignId={sessionData.campaignId} />

        <div class="card" style="margin-top:1rem;">
          <div class="card-header"><span class="card-title">Session Feed</span></div>
          {#if $worldFeed.length === 0}
            <p class="text-muted text-sm" style="font-style:italic;">No cards pushed yet.</p>
          {:else}
            {#each [...$worldFeed].reverse() as card}
              <div class="feed-history-item">
                <span class="badge">{card.category}</span>
                <span style="font-size:0.88rem; flex:1;">{card.title}</span>
                <button class="btn btn-ghost btn-sm" on:click={() => getSocket()?.emit('world:pushLore', card)}>
                  Re-push
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <div class="world-player-col">
        <LoreCardFeed cards={$worldFeed} />
        {#if worldRollFeed.length}
          <div class="roll-feed card">
            <div class="card-header"><span class="card-title">Roll Feed</span></div>
            {#each [...worldRollFeed].reverse().slice(0, 15) as r}
              <p class="roll-line">{r.message}</p>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="world-player-col" style="max-width:680px; margin:0 auto;">
        <LoreCardFeed cards={$worldFeed} />
        {#if myCharObj}
          <div class="card">
            <div class="card-header"><span class="card-title">Skill Checks</span></div>
            <SkillCheckPanel character={myCharObj} />
            {#if worldRollFeed.length}
              <div style="margin-top:1rem; border-top:1px solid var(--border-muted); padding-top:.75rem;">
                {#each [...worldRollFeed].reverse().slice(0, 10) as r}
                  <p class="roll-line">{r.message}</p>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

<!-- ════════════════════════════════════════════════════════ CHARACTERS TAB -->
{:else if activeTab === 'characters'}
  <div class="page"><div class="container">
    {#if campaignData?.players?.length}
      <div class="char-grid">
        {#each campaignData.players as player}
          {@const canEdit = isDM || player._id === myCharId}
          <div class="char-sheet card">
            <div class="char-sheet-header">
              <div>
                <h2 style="font-size:1.1rem;">{player.name}</h2>
                <p class="text-muted text-sm" style="font-family:var(--font-body); font-style:italic;">
                  {player.race} {player.class} · Level {player.level}
                </p>
              </div>
              {#if canEdit}
                <button class="btn btn-ghost btn-sm" on:click={() => openEdit(player)}>Edit</button>
              {/if}
            </div>

              <div class="ability-grid">
                {#each ['STR','DEX','CON','INT','WIS','CHA'] as ab}
                  {@const score = player.stats?.[ab] ?? 10}
                  {@const mod   = Math.floor((score - 10) / 2)}
                  <div class="ability-block">
                    <span class="ability-mod">{mod >= 0 ? '+' : ''}{mod}</span>
                    <span class="ability-score">{score}</span>
                    <span class="ability-label">{ab}</span>
                  </div>
                {/each}
              </div>

              <div class="stat-row">
                <div class="stat-block">
                  <span class="stat-val">{player.combat?.hpCurrent ?? 0}/{player.combat?.hpMax ?? 0}</span>
                  <span class="stat-label">HP</span>
                </div>
                <div class="stat-block">
                  <span class="stat-val">{player.combat?.AC ?? 10}</span>
                  <span class="stat-label">AC</span>
                </div>
                <div class="stat-block">
                  <span class="stat-val">{player.combat?.speed ?? 30}</span>
                  <span class="stat-label">Speed</span>
                </div>
                <div class="stat-block">
                  <span class="stat-val">{player.combat?.initiativeMod >= 0 ? '+' : ''}{player.combat?.initiativeMod ?? 0}</span>
                  <span class="stat-label">Init</span>
                </div>
              </div>

              {#if player.conditions?.length}
                <div class="mc-pills" style="margin-top:.5rem">
                  {#each player.conditions as cond}
                    <span class="pill pill-red">{cond}</span>
                  {/each}
                </div>
              {/if}

              {#if player.inventory?.length}
                <details style="margin-top:.75rem">
                  <summary class="text-sm" style="cursor:pointer; color:var(--text-muted); font-family:var(--font-heading); font-size:0.72rem; letter-spacing:0.06em; text-transform:uppercase;">
                    Inventory ({player.inventory.length})
                  </summary>
                  <table class="inv-table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Weight</th></tr></thead>
                    <tbody>
                      {#each player.inventory as item}
                        <tr>
                          <td title={item.description}>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>{item.weight ?? '—'}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </details>
              {/if}
            </div>
        {/each}
      </div>
    {:else}
      <p class="text-muted" style="padding:2rem; font-family:var(--font-body); font-style:italic;">
        No characters in this campaign.
      </p>
    {/if}
  </div></div>

<!-- ════════════════════════════════════════════════════════ LORE TAB -->
{:else if activeTab === 'lore' && isDM}
  <div class="page"><div class="container">
    {#if campaignData?.lore?.length}
      <div style="display:flex; flex-direction:column; gap:.75rem;">
        {#each campaignData.lore as entry}
          <div class="card">
            <div class="flex-between">
              <div class="flex-center gap-1">
                <strong style="font-family:var(--font-heading);">{entry.title}</strong>
                <span class="badge">{entry.category}</span>
                {#if entry.visibleToPlayers}
                  <span class="badge badge-green">public</span>
                {/if}
              </div>
              <button class="btn btn-secondary btn-sm"
                on:click={() => getSocket()?.emit('world:pushLore', { title: entry.title, category: entry.category, content: entry.body })}>
                Push to Players
              </button>
            </div>
            {#if entry.body}
              <p class="text-muted text-sm" style="margin-top:.5rem; font-family:var(--font-body); font-style:italic; line-height:1.6; white-space:pre-wrap;">
                {entry.body.length > 300 ? entry.body.slice(0,300) + '…' : entry.body}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-muted" style="padding:2rem; font-family:var(--font-body); font-style:italic;">
        No lore entries yet. Add them in the Campaign editor.
      </p>
    {/if}
  </div></div>
{/if}

{/if}<!-- end if !loading -->

<!-- Dice tray -->
<DiceTray bind:open={diceTrayOpen} />

<!-- Combat Setup Modal -->
{#if showStartModal}
  <CombatSetup
    players={campaignData?.players ?? []}
    {monsterList}
    on:start={handleCombatStart}
    on:close={() => showStartModal = false}
  />
{/if}

{#if editingPlayer}
  <div class="edit-overlay" on:click|self={closeEdit}>
    <div class="edit-modal card">
      <div class="edit-modal-header">
        <h3 style="font-family:var(--font-heading); font-size:1rem; margin:0; color:var(--gold);">
          {editingPlayer.name}
        </h3>
        <button class="btn btn-ghost btn-sm" on:click={closeEdit}>✕</button>
      </div>
      <div class="edit-modal-body">
        <div class="edit-field">
          <label>HP Current</label>
          <input type="number" bind:value={editForm.hpCurrent} min="0" />
        </div>
        {#if isDM}
          <div class="edit-field">
            <label>HP Max</label>
            <input type="number" bind:value={editForm.hpMax} min="0" />
          </div>
          <div class="edit-field">
            <label>AC</label>
            <input type="number" bind:value={editForm.AC} min="1" />
          </div>
          <div class="edit-field">
            <label>Speed (ft)</label>
            <input type="number" bind:value={editForm.speed} min="0" />
          </div>
          <div class="edit-field">
            <label>Initiative Modifier</label>
            <input type="number" bind:value={editForm.initiativeMod} />
          </div>
        {/if}
      </div>
      <div class="edit-modal-footer">
        <button class="btn btn-ghost btn-sm" on:click={closeEdit}>Cancel</button>
        <button class="btn btn-primary btn-sm" on:click={saveEdit} disabled={editSaving}>
          {editSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Session nav ──────────────────────────────────────────────────────── */
  .session-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: .45rem 1rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    gap: 1rem;
    height: 46px;
  }
  .session-nav-left { display: flex; align-items: center; gap: .75rem; }
  .session-nav-right { display: flex; align-items: center; gap: .75rem; }

  .session-brand {
    font-family: var(--font-heading);
    font-size: .9rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: .05em;
  }
  .session-key {
    font-family: var(--font-heading);
    font-size: .72rem;
    letter-spacing: .2em;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: .1rem .4rem;
  }
  .phase-badge {
    font-family: var(--font-heading);
    font-size: .68rem;
    letter-spacing: .08em;
    text-transform: uppercase;
    padding: .15rem .55rem;
    border-radius: 999px;
    border: 1px solid var(--border-muted);
  }
  .phase-combat { border-color: var(--crimson); color: #e89090; background: rgba(139,26,26,0.2); }
  .phase-open-world { border-color: var(--gold-dim); color: var(--gold); background: rgba(124,106,62,0.15); }

  .roster-count {
    font-family: var(--font-heading);
    font-size: .7rem;
    letter-spacing: .05em;
    color: var(--text-muted);
  }
  .roster-count::before { content: '⬤ '; color: var(--success); font-size: .6rem; }

  /* ── Session tabs ─────────────────────────────────────────────────────── */
  .session-tabs {
    display: flex;
    background: var(--surface);
    border-bottom: 1px solid var(--border-muted);
    padding: 0 .5rem;
    gap: .25rem;
  }

  /* ── Combat layout (three-zone) ───────────────────────────────────────── */
  .combat-layout {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 96px);
    overflow: hidden;
  }

  /* Zone A: monster rail */
  .monster-rail {
    display: flex;
    gap: .5rem;
    padding: .5rem .75rem;
    overflow-x: auto;
    background: var(--bg-2);
    border-bottom: 1px solid var(--border-muted);
    flex-shrink: 0;
  }
  .monster-card {
    min-width: 110px;
    max-width: 140px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .5rem .6rem;
    flex-shrink: 0;
    transition: opacity .3s;
  }
  .monster-card.defeated { opacity: .35; }
  .mc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .3rem; }
  .mc-name { font-family: var(--font-heading); font-size: .78rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-stats { font-family: var(--font-heading); font-size: .68rem; color: var(--text-muted); margin-top: .2rem; }
  .mc-pills { display: flex; flex-wrap: wrap; gap: 2px; margin-top: .3rem; }

  /* Zone B: battle engine */
  .battle-engine {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .engine-left {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid var(--border-muted);
    overflow-y: auto;
    padding: .5rem;
    display: flex;
    flex-direction: column;
    gap: .5rem;
  }
  .engine-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .log-area {
    flex: 1;
    min-height: 0;
    border-bottom: 1px solid var(--border-muted);
    overflow: hidden;
  }
  .action-area {
    flex-shrink: 0;
    max-height: 260px;
    overflow-y: auto;
    border-top: 1px solid var(--border-muted);
  }

  .idle-combat {
    padding: 1rem .5rem;
    text-align: center;
  }

  .roster-grid {
    display: flex;
    flex-wrap: wrap;
    gap: .4rem;
    justify-content: center;
  }
  .roster-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .15rem;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: .5rem .55rem;
    min-width: 72px;
    max-width: 90px;
    transition: border-color .2s;
  }
  .roster-card:hover { border-color: var(--gold-dim); }
  .roster-mine { border-color: #3a6b8b; }
  .roster-avatar {
    width: 32px; height: 32px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading);
    font-size: .7rem; font-weight: 700;
    color: var(--gold-dim);
  }
  .roster-name {
    font-family: var(--font-heading);
    font-size: .72rem; font-weight: 600;
    color: var(--text);
    text-align: center;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 80px;
  }
  .roster-meta {
    font-family: var(--font-body);
    font-size: .65rem;
    color: var(--text-muted);
    text-align: center;
  }
  .roster-hp {
    font-family: var(--font-heading);
    font-size: .68rem;
    color: var(--text);
    display: flex; gap: .2rem; align-items: center;
  }
  .rest-controls {
    margin-top: auto;
    padding-top: .5rem;
    border-top: 1px solid var(--border-muted);
  }

  /* Zone C: player rail */
  .player-rail {
    display: flex;
    gap: .5rem;
    padding: .5rem .75rem;
    overflow-x: auto;
    background: var(--bg-2);
    border-top: 1px solid var(--border-muted);
    flex-shrink: 0;
  }
  .player-card {
    min-width: 130px;
    max-width: 170px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: .5rem .6rem;
    flex-shrink: 0;
    position: relative;
    transition: border-color .2s;
  }
  .player-card.active { border-color: var(--gold); animation: glow 2s infinite; }
  .player-card.mine   { border-color: #3a6b8b; }
  .player-card.unconscious { opacity: .5; }
  .unconscious-overlay {
    position: absolute; inset: 0;
    background: rgba(139,26,26,0.7);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading);
    font-size: .7rem;
    font-weight: 700;
    letter-spacing: .12em;
    color: #e8a0a0;
    border-radius: var(--radius);
  }
  .pc-header { display: flex; flex-direction: column; margin-bottom: .3rem; }
  .pc-name { font-family: var(--font-heading); font-size: .82rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pc-meta { font-family: var(--font-body); font-size: .72rem; color: var(--text-muted); }
  .pc-stats { display: flex; gap: .5rem; font-family: var(--font-heading); font-size: .7rem; color: var(--text-muted); margin-top: .2rem; }
  .resource-pips { display: flex; gap: .25rem; margin-top: .3rem; }
  .res-pip {
    font-family: var(--font-heading);
    font-size: .62rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 999px;
    background: var(--gold-dim);
    color: var(--bg);
    border: 1px solid var(--gold);
  }
  .res-pip.spent { background: var(--border-muted); color: var(--text-dim); border-color: var(--border-muted); text-decoration: line-through; }

  /* ── World layout ─────────────────────────────────────────────────────── */
  .world-layout {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    height: calc(100vh - 96px);
    overflow: hidden;
  }
  .world-dm-col {
    width: 380px;
    flex-shrink: 0;
    overflow-y: auto;
  }
  .world-player-col { flex: 1; overflow-y: auto; }

  .feed-history-item {
    display: flex;
    align-items: center;
    gap: .5rem;
    padding: .4rem 0;
    border-bottom: 1px solid var(--border-muted);
    font-size: .88rem;
  }
  .feed-history-item:last-child { border-bottom: none; }

  .roll-feed { margin-top: .75rem; }
  .roll-line {
    font-family: 'Courier New', monospace;
    font-size: .78rem;
    color: var(--text-muted);
    padding: .15rem 0;
    border-bottom: 1px solid var(--border-muted);
  }

  /* ── Character sheet ──────────────────────────────────────────────────── */
  .char-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
    padding-top: 1rem;
  }
  .char-sheet { min-width: 0; }
  .char-sheet-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: .75rem; }

  .ability-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: .3rem; margin-bottom: .75rem; }
  .ability-block {
    display: flex; flex-direction: column; align-items: center;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: .4rem .2rem;
    gap: .1rem;
  }
  .ability-mod { font-family: var(--font-heading); font-size: .9rem; font-weight: 700; color: var(--gold); }
  .ability-score { font-family: var(--font-heading); font-size: .72rem; color: var(--text-muted); }
  .ability-label { font-family: var(--font-heading); font-size: .6rem; letter-spacing: .06em; color: var(--text-dim); text-transform: uppercase; }

  .stat-row { display: flex; gap: .5rem; }
  .stat-block {
    flex: 1;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: .35rem .4rem;
    display: flex; flex-direction: column; align-items: center;
  }
  .stat-val { font-family: var(--font-heading); font-size: .88rem; font-weight: 700; color: var(--text); }
  .stat-label { font-family: var(--font-heading); font-size: .6rem; letter-spacing: .06em; color: var(--text-dim); text-transform: uppercase; }

  .inv-table { width: 100%; border-collapse: collapse; margin-top: .5rem; font-size: .82rem; }
  .inv-table th {
    font-family: var(--font-heading);
    font-size: .65rem;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: var(--text-muted);
    text-align: left;
    padding: .25rem .4rem;
    border-bottom: 1px solid var(--border-muted);
  }
  .inv-table td {
    font-family: var(--font-body);
    padding: .2rem .4rem;
    border-bottom: 1px solid var(--border-muted);
    color: var(--text);
  }

  /* ── Party sidebar (combat left panel) ───────────────────────────────────── */
  .party-sidebar {
    border-top: 1px solid var(--border-muted);
    padding-top: .5rem;
    display: flex;
    flex-direction: column;
    gap: .2rem;
  }
  .party-sidebar-label {
    font-family: var(--font-heading);
    font-size: .65rem;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--gold-dim);
    margin: 0 0 .25rem 0;
  }
  .party-sidebar-row {
    display: flex;
    align-items: center;
    gap: .45rem;
    padding: .25rem .35rem;
    border-radius: var(--radius);
    border: 1px solid transparent;
    transition: background .15s;
  }
  .party-sidebar-row:hover { background: var(--surface-2); }
  .sidebar-mine { border-color: #3a6b8b !important; }
  .party-sidebar-av {
    width: 26px; height: 26px;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-heading);
    font-size: .62rem; font-weight: 700;
    color: var(--gold-dim);
    flex-shrink: 0;
  }
  .party-sidebar-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .party-sidebar-name {
    font-family: var(--font-heading);
    font-size: .73rem; font-weight: 600;
    color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .party-sidebar-hp {
    font-family: var(--font-heading);
    font-size: .62rem;
    color: var(--text-muted);
  }
  .party-sidebar-edit {
    background: none; border: none;
    color: var(--text-muted); cursor: pointer;
    font-size: .78rem; padding: 2px 4px;
    border-radius: var(--radius); flex-shrink: 0;
    line-height: 1;
  }
  .party-sidebar-edit:hover { color: var(--gold); background: var(--surface-2); }

  /* ── Character edit modal ─────────────────────────────────────────────────── */
  .edit-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.65);
    display: flex; align-items: center; justify-content: center;
    z-index: 200;
  }
  .edit-modal { width: 300px; max-width: 90vw; }
  .edit-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1rem;
  }
  .edit-modal-body {
    display: flex; flex-direction: column; gap: .6rem;
    margin-bottom: 1rem;
  }
  .edit-field { display: flex; flex-direction: column; gap: .2rem; }
  .edit-field label {
    font-family: var(--font-heading);
    font-size: .65rem; letter-spacing: .06em; text-transform: uppercase;
    color: var(--text-muted);
  }
  .edit-field input {
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .35rem .5rem;
    font-family: var(--font-heading);
    font-size: .88rem;
    width: 100%;
    box-sizing: border-box;
  }
  .edit-field input:focus { outline: none; border-color: var(--gold-dim); }
  .edit-modal-footer {
    display: flex; justify-content: flex-end; gap: .5rem;
  }
</style>
