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

  // Loaded from server
  let sessionData  = null;
  let campaignData = null;

  // Combat start modal state (DM)
  let showStartModal = false;
  let selectedPlayerIds = [];
  let selectedMonsters  = [];  // [{ monsterId, name, count }]
  let monsterSearch = '';
  let monsterList   = [];
  let customCreatures = [];

  // Player identity (from sessionStorage for non-DM)
  let myCharId     = null;
  let myCharObj    = null;
  let displayName  = '';

  // World roll feed
  let worldRollFeed = [];

  $: isDM = !!$auth?.user;
  $: phase = sessionData?.phase ?? 'open-world';
  $: myCharObj = campaignData?.players?.find(p => p._id === myCharId) || null;

  // ── Mount ──────────────────────────────────────────────────────────────────
  onMount(async () => {
    // Load player identity from sessionStorage (players only)
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

    // Fetch session data
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

    // Fetch campaign
    try {
      const res = await fetch(`/api/campaigns/${sessionData.campaignId}`, { credentials: 'include' });
      if (res.ok) campaignData = await res.json();
    } catch { /* non-fatal */ }

    // Fetch monsters and custom creatures for DM start modal
    if (isDM) {
      try {
        const [mRes, cRes] = await Promise.all([
          fetch('/api/monsters?limit=500', { credentials: 'include' }),
          fetch(`/api/custom-creatures?campaignId=${sessionData.campaignId}`, { credentials: 'include' }),
        ]);
        if (mRes.ok)  monsterList     = await mRes.json();
        if (cRes.ok)  customCreatures = await cRes.json();
      } catch { /* non-fatal */ }
    }

    // Connect socket
    const authPayload = isDM
      ? { token: getJwtFromCookie(), sessionId }
      : { displayName: displayName || 'Player', characterId: myCharId, sessionId };

    const socket = connectSocket(sessionId, authPayload);

    socket.on('session:role',       (data) => identity.set(data));
    socket.on('session:roster',     (r)    => roster.set(r));
    socket.on('session:phase',      (p)    => { if (sessionData) sessionData.phase = p; sessionData = sessionData; });

    socket.on('combat:state',       (s)    => setCombat(s));
    socket.on('combat:actionPending', ()   => { /* player sees waiting state via store */ });
    socket.on('combat:actionResolved', ({ status, reason }) => {
      if (status === 'rejected' && reason) {
        toast = `Action rejected: ${reason}`;
        setTimeout(() => toast = '', 4000);
      }
    });

    socket.on('world:loreFeed',     (cards) => worldFeed.set(cards));
    socket.on('world:loreCard',     (card) => worldFeed.update(f => [...f, card]));
    socket.on('world:roll',         (r)    => worldRollFeed = [...worldRollFeed.slice(-50), r]);

    // Request current combat state
    socket.emit('combat:getState');

    loading = false;
  });

  onDestroy(() => disconnectSocket());

  // ── Helpers ────────────────────────────────────────────────────────────────

  function getJwtFromCookie() {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  // ── Combat start ───────────────────────────────────────────────────────────

  function togglePlayer(id) {
    selectedPlayerIds = selectedPlayerIds.includes(id)
      ? selectedPlayerIds.filter(x => x !== id)
      : [...selectedPlayerIds, id];
  }

  function addMonster(m) {
    const existing = selectedMonsters.find(x => x.monsterId === m._id);
    if (existing) existing.count++;
    else selectedMonsters = [...selectedMonsters, { monsterId: m._id, name: m.name, count: 1 }];
  }

  function removeMonster(id) {
    selectedMonsters = selectedMonsters.filter(x => x.monsterId !== id);
  }

  function startCombat() {
    getSocket()?.emit('combat:start', {
      playerIds:  selectedPlayerIds,
      monsters:   selectedMonsters,
      customIds:  [],
    });
    showStartModal = false;
  }

  function endCombat() {
    if (confirm('End combat?')) getSocket()?.emit('combat:end');
  }

  $: filteredMonsters = monsterSearch.length > 1
    ? monsterList.filter(m => m.name.toLowerCase().includes(monsterSearch.toLowerCase())).slice(0, 20)
    : [];

  // Toast notification
  let toast = '';
</script>

<svelte:head>
  <title>{sessionData?.campaignId?.name ?? 'Session'} — D&D Tracker</title>
</svelte:head>

<!-- Toast -->
{#if toast}
  <div class="toast">{toast}</div>
{/if}

{#if loading}
  <div class="loading" style="padding:4rem; text-align:center;">Loading session…</div>
{:else if error}
  <div class="page"><div class="container"><div class="alert alert-error">{error}</div></div></div>
{:else}

<!-- Session nav bar -->
<div class="session-nav">
  <div class="session-nav-left">
    <span class="session-brand">⚔ {campaignData?.name ?? 'Session'}</span>
    <span class="session-code">{sessionData.joinKey}</span>
    <span class="phase-badge phase-{phase}">{phase === 'combat' ? '⚔ Combat' : '🌍 World'}</span>
  </div>
  <div class="session-nav-right">
    <span class="roster-count">● {$roster.length} connected</span>
    {#if isDM && phase !== 'combat'}
      <a href="/campaign/{sessionData.campaignId}" class="btn btn-ghost btn-sm">Edit Campaign</a>
    {/if}
  </div>
</div>

<!-- Tab bar -->
<div class="session-tabs">
  <button class="tab-btn" class:active={activeTab==='combat'}    on:click={() => activeTab='combat'}>⚔ Combat</button>
  <button class="tab-btn" class:active={activeTab==='world'}     on:click={() => activeTab='world'}>🌍 World</button>
  <button class="tab-btn" class:active={activeTab==='characters'} on:click={() => activeTab='characters'}>👤 Characters</button>
  {#if isDM}
    <button class="tab-btn" class:active={activeTab==='lore'}    on:click={() => activeTab='lore'}>📖 Lore</button>
  {/if}
</div>

<!-- ════════════════════════════════════════════════════════════════ COMBAT TAB -->
{#if activeTab === 'combat'}
  <div class="combat-layout">

    <!-- Zone A: monsters (top rail) — only visible during active combat -->
    {#if $combat?.state === 'active'}
      {@const monsters = $combat.initiativeOrder.filter(c => c.entityType !== 'player')}
      {#if monsters.length}
        <div class="monster-rail">
          {#each monsters as c (c.instanceId)}
            <div class="monster-card" class:defeated={c.isDefeated}>
              <div class="mc-header">
                <span class="mc-name">{c.name}</span>
                {#if c.cr}<span class="mc-cr">CR {c.cr}</span>{/if}
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
      <!-- Left: initiative + controls -->
      <div class="engine-left">
        {#if $combat?.state === 'active'}
          <InitiativeTracker
            order={$combat.initiativeOrder}
            currentIndex={$combat.currentTurnIndex}
            round={$combat.round}
            {isDM}
            {myCharId}
          />
        {:else if isDM}
          <div class="idle-combat">
            <p class="text-muted" style="margin-bottom:1rem;">No active combat.</p>
            <button class="btn btn-primary" on:click={() => showStartModal = true}>⚔ Start Combat</button>
          </div>
        {:else}
          <div class="idle-combat text-muted">Waiting for DM to start combat…</div>
        {/if}

        <!-- DM rest controls -->
        {#if isDM && $combat?.state === 'active'}
          <div class="rest-controls">
            <button class="btn btn-ghost btn-sm" on:click={endCombat}>🏁 End Combat</button>
          </div>
        {/if}
      </div>

      <!-- Right: combat log + action panel -->
      <div class="engine-right">
        <div class="log-area">
          <CombatLog
            entries={$combat?.combatLog ?? []}
            {isDM}
          />
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
                <div class="unconscious-overlay">UNCONSCIOUS</div>
              {/if}
              <div class="pc-header">
                <span class="pc-name">{c.name}</span>
                <span class="pc-meta">{c.class} Lv{c.level}</span>
              </div>
              <HpBar current={c.currentHp} max={c.maxHp} />
              <div class="pc-stats">
                <span>AC {c.ac}</span>
                <span>Init +{c.initiative}</span>
              </div>
              {#if c.conditions.length}
                <div class="mc-pills">
                  {#each c.conditions as cond}
                    <span class="pill pill-red">{cond}</span>
                  {/each}
                </div>
              {/if}
              <!-- Resources row -->
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

  <!-- DM validation queue (fixed bottom-left) -->
  {#if isDM}
    <ValidationQueue actions={$pendingActions} />
  {/if}

<!-- ════════════════════════════════════════════════════════════════ WORLD TAB -->
{:else if activeTab === 'world'}
  <div class="world-layout">
    {#if isDM}
      <div class="world-dm-col">
        <LoreCardPublisher campaignId={sessionData.campaignId} />

        <!-- Session push history -->
        <div class="card">
          <div class="card-header"><span class="card-title">Session Feed (DM)</span></div>
          {#if $worldFeed.length === 0}
            <p class="text-muted text-sm">No cards pushed yet.</p>
          {:else}
            {#each [...$worldFeed].reverse() as card}
              <div class="feed-history-item">
                <span class="badge">{card.category}</span>
                <span>{card.title}</span>
                <button class="btn btn-ghost btn-sm" on:click={() => getSocket()?.emit('world:pushLore', card)}>Re-push</button>
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
      <!-- Player world view -->
      <div class="world-player-col" style="max-width:680px; margin:0 auto;">
        <LoreCardFeed cards={$worldFeed} />
        {#if myCharObj}
          <div class="card">
            <div class="card-header"><span class="card-title">Skill Checks</span></div>
            <SkillCheckPanel character={myCharObj} />
            {#if worldRollFeed.length}
              <div style="margin-top:1rem; border-top:1px solid var(--color-border); padding-top:.75rem;">
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

<!-- ══════════════════════════════════════════════════════════ CHARACTERS TAB -->
{:else if activeTab === 'characters'}
  <div class="page"><div class="container">
    {#if campaignData?.players?.length}
      <div class="char-grid">
        {#each campaignData.players as player}
          {@const canView = isDM || player._id === myCharId}
          {#if canView}
            <div class="char-sheet card">
              <div class="char-sheet-header">
                <div>
                  <h2>{player.name}</h2>
                  <p class="text-muted text-sm">{player.race} {player.class} · Level {player.level}</p>
                </div>
              </div>

              <!-- Ability scores -->
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

              <!-- Combat stats -->
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

              <!-- Conditions -->
              {#if player.conditions?.length}
                <div class="mc-pills" style="margin-top:.5rem">
                  {#each player.conditions as cond}
                    <span class="pill pill-red">{cond}</span>
                  {/each}
                </div>
              {/if}

              <!-- Inventory (own char or DM) -->
              {#if player.inventory?.length}
                <details style="margin-top:.75rem">
                  <summary class="text-sm" style="cursor:pointer; color:var(--color-text-muted);">
                    Inventory ({player.inventory.length} items)
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
          {/if}
        {/each}
      </div>
    {:else}
      <p class="text-muted" style="padding:2rem;">No characters in this campaign.</p>
    {/if}
  </div></div>

<!-- ════════════════════════════════════════════════════════════════ LORE TAB -->
{:else if activeTab === 'lore' && isDM}
  <div class="page"><div class="container">
    {#if campaignData?.lore?.length}
      <div style="display:flex; flex-direction:column; gap:.75rem;">
        {#each campaignData.lore as entry}
          <div class="card">
            <div class="flex-between">
              <div class="flex-center gap-1">
                <strong>{entry.title}</strong>
                <span class="badge">{entry.category}</span>
                {#if entry.visibleToPlayers}
                  <span class="badge" style="background:#1a3a1a;color:#8aff8a;">public</span>
                {/if}
              </div>
              <button class="btn btn-secondary btn-sm"
                on:click={() => getSocket()?.emit('world:pushLore', { title: entry.title, category: entry.category, content: entry.body })}>
                ▶ Push
              </button>
            </div>
            {#if entry.body}
              <p class="text-muted text-sm" style="margin-top:.5rem; white-space:pre-wrap; line-height:1.6;">
                {entry.body.length > 300 ? entry.body.slice(0,300) + '…' : entry.body}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-muted" style="padding:2rem;">No lore entries yet. Add them in the Campaign editor.</p>
    {/if}
  </div></div>
{/if}

{/if}<!-- end if !loading -->

<!-- Dice tray (always available) -->
<DiceTray bind:open={diceTrayOpen} />

<!-- ══════════════════════════════════════════ START COMBAT MODAL (DM) -->
{#if showStartModal}
  <div class="modal-backdrop" on:click={() => showStartModal = false}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Start Combat</h2>
        <button class="btn btn-ghost btn-sm" on:click={() => showStartModal = false}>✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-cols">
          <!-- Characters -->
          <div>
            <h3 class="modal-section-title">Characters</h3>
            {#each campaignData?.players ?? [] as p}
              <label class="modal-check">
                <input type="checkbox" checked={selectedPlayerIds.includes(p._id)} on:change={() => togglePlayer(p._id)} />
                {p.name} — Lv {p.level} {p.class}
              </label>
            {/each}
          </div>

          <!-- Monsters -->
          <div>
            <h3 class="modal-section-title">Monsters</h3>
            <input
              class="monster-search"
              bind:value={monsterSearch}
              placeholder="Search monsters…"
            />
            {#if filteredMonsters.length}
              <div class="monster-results">
                {#each filteredMonsters as m}
                  <div class="monster-result-row">
                    <span>{m.name}</span>
                    <span class="text-muted text-sm">CR {m.cr}</span>
                    <button class="btn btn-primary btn-sm" on:click={() => addMonster(m)}>+</button>
                  </div>
                {/each}
              </div>
            {/if}
            {#if selectedMonsters.length}
              <div class="selected-monsters">
                <strong class="text-sm">Selected:</strong>
                {#each selectedMonsters as sm}
                  <div class="selected-monster-row">
                    <span>{sm.name} ×{sm.count}</span>
                    <div class="flex gap-1">
                      <button class="btn btn-ghost btn-sm" on:click={() => sm.count++}>+</button>
                      <button class="btn btn-ghost btn-sm" on:click={() => { if(sm.count > 1) sm.count--; else removeMonster(sm.monsterId); }}>−</button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" on:click={() => showStartModal = false}>Cancel</button>
        <button class="btn btn-primary" on:click={startCombat}
          disabled={selectedPlayerIds.length === 0 && selectedMonsters.length === 0}>
          ⚔ Roll Initiative & Begin
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Session nav ──────────────────────────────────────────────────────────── */
  .session-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: .5rem 1rem;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    gap: 1rem;
  }
  .session-nav-left, .session-nav-right { display: flex; align-items: center; gap: .75rem; }
  .session-brand { font-weight: 700; font-size: .95rem; }
  .session-code { font-size: .8rem; color: var(--color-accent); font-weight: 700; letter-spacing: .12em; background: var(--color-surface-2); padding: 2px 8px; border-radius: var(--radius); }
  .phase-badge { font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .phase-combat { background: #3a1a1a; color: #ff8a8a; }
  .phase-open-world { background: #1a2e1a; color: #8aff8a; }
  .roster-count { font-size: .78rem; color: var(--color-text-muted); }

  /* ── Session tabs ─────────────────────────────────────────────────────────── */
  .session-tabs { display: flex; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }

  /* ── Combat layout ────────────────────────────────────────────────────────── */
  .combat-layout { display: flex; flex-direction: column; height: calc(100vh - 97px); overflow: hidden; }

  /* Monster rail */
  .monster-rail {
    display: flex; gap: .5rem; overflow-x: auto; padding: .5rem 1rem;
    background: var(--color-bg); border-bottom: 1px solid var(--color-border);
    min-height: 110px; flex-shrink: 0;
  }
  .monster-card {
    flex-shrink: 0; width: 180px;
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius); padding: .6rem .75rem;
  }
  .monster-card.defeated { opacity: .4; }
  .mc-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: .35rem; }
  .mc-name { font-size: .82rem; font-weight: 700; }
  .mc-cr   { font-size: .7rem; color: var(--color-text-muted); }
  .mc-stats { font-size: .72rem; color: var(--color-text-muted); margin-top: .2rem; }
  .mc-pills { display: flex; flex-wrap: wrap; gap: 2px; margin-top: .3rem; }

  /* Battle engine */
  .battle-engine {
    display: flex; flex: 1; min-height: 0; gap: 0;
  }
  .engine-left {
    width: 280px; flex-shrink: 0;
    border-right: 1px solid var(--color-border);
    overflow-y: auto; padding: .75rem;
    display: flex; flex-direction: column; gap: .75rem;
  }
  .engine-right {
    flex: 1; display: flex; flex-direction: column; min-width: 0;
  }
  .log-area   { flex: 1; min-height: 0; border-bottom: 1px solid var(--color-border); overflow: hidden; }
  .action-area { height: 260px; flex-shrink: 0; overflow-y: auto; padding: .5rem; }

  .idle-combat { padding: .75rem; color: var(--color-text-muted); font-size: .9rem; }
  .rest-controls { margin-top: auto; padding-top: .5rem; border-top: 1px solid var(--color-border); }

  /* Player rail */
  .player-rail {
    display: flex; gap: .5rem; overflow-x: auto; padding: .5rem 1rem;
    background: var(--color-bg); border-top: 1px solid var(--color-border);
    min-height: 120px; flex-shrink: 0;
  }
  .player-card {
    flex-shrink: 0; width: 190px; position: relative;
    background: var(--color-surface); border: 1px solid var(--color-border);
    border-radius: var(--radius); padding: .6rem .75rem;
    transition: border-color .2s, box-shadow .2s;
  }
  .player-card.active { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); animation: glow 2s infinite; }
  .player-card.mine   { border-color: #5dade2; }
  .player-card.unconscious { border-color: var(--color-danger); }
  @keyframes glow { 0%,100%{box-shadow:0 0 0 1px var(--color-accent)} 50%{box-shadow:0 0 8px 2px var(--color-accent)} }
  .unconscious-overlay {
    position: absolute; inset: 0; background: rgba(233,69,96,.18);
    display: flex; align-items: center; justify-content: center;
    font-size: .75rem; font-weight: 800; color: var(--color-danger); border-radius: var(--radius);
    pointer-events: none;
  }
  .pc-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: .3rem; }
  .pc-name   { font-size: .82rem; font-weight: 700; }
  .pc-meta   { font-size: .68rem; color: var(--color-text-muted); }
  .pc-stats  { font-size: .72rem; color: var(--color-text-muted); display: flex; gap: .5rem; margin-top: .15rem; }
  .resource-pips { display: flex; gap: .3rem; margin-top: .35rem; }
  .res-pip {
    font-size: .65rem; font-weight: 700; width: 18px; height: 18px;
    border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: var(--color-accent); color: #111;
  }
  .res-pip.spent { background: var(--color-border); color: var(--color-text-muted); text-decoration: line-through; }

  /* Pill shared */
  .pill { font-size: .62rem; font-weight: 600; padding: 1px 5px; border-radius: 999px; display: inline-flex; align-items: center; gap: 2px; }
  .pill-red    { background: #3a1a1a; color: #ff8a8a; }
  .pill-green  { background: #1a3a1a; color: #8aff8a; }
  .pill-blue   { background: #1a2a3a; color: #8ab4ff; }
  .pill-yellow { background: #3a2e1a; color: #ffd27a; }
  .pill-purple { background: #2a1a3a; color: #d4a8ff; }

  /* ── World layout ─────────────────────────────────────────────────────────── */
  .world-layout { display: flex; gap: 1.5rem; padding: 1.25rem; max-height: calc(100vh - 97px); overflow: hidden; }
  .world-dm-col { width: 380px; flex-shrink: 0; overflow-y: auto; }
  .world-player-col { flex: 1; overflow-y: auto; }
  .feed-history-item { display: flex; align-items: center; gap: .5rem; padding: .35rem 0; border-bottom: 1px solid var(--color-border); font-size: .82rem; }
  .roll-feed { margin-top: .75rem; }
  .roll-line { font-size: .78rem; color: var(--color-text-muted); font-family: 'Courier New', monospace; padding: .15rem 0; }

  /* ── Characters tab ───────────────────────────────────────────────────────── */
  .char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; padding: 1.25rem; }
  .char-sheet { }
  .char-sheet-header { margin-bottom: .75rem; }
  .char-sheet-header h2 { font-size: 1.1rem; font-weight: 700; }
  .ability-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: .4rem; margin-bottom: .75rem; }
  .ability-block { display: flex; flex-direction: column; align-items: center; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius); padding: .4rem .2rem; }
  .ability-mod   { font-size: 1rem; font-weight: 800; color: var(--color-accent); }
  .ability-score { font-size: .72rem; font-weight: 600; }
  .ability-label { font-size: .6rem; color: var(--color-text-muted); }
  .stat-row { display: flex; gap: .5rem; flex-wrap: wrap; }
  .stat-block { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius); padding: .3rem .6rem; text-align: center; min-width: 50px; }
  .stat-val   { display: block; font-size: .9rem; font-weight: 700; }
  .stat-label { display: block; font-size: .6rem; color: var(--color-text-muted); }
  .inv-table { width: 100%; border-collapse: collapse; font-size: .8rem; margin-top: .4rem; }
  .inv-table th { color: var(--color-text-muted); text-align: left; padding: .2rem .4rem; border-bottom: 1px solid var(--color-border); }
  .inv-table td { padding: .2rem .4rem; border-bottom: 1px solid var(--color-border); }

  /* ── Modal ────────────────────────────────────────────────────────────────── */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.65); z-index: 80; display: flex; align-items: center; justify-content: center; }
  .modal { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); width: 680px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,.7); }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid var(--color-border); }
  .modal-header h2 { font-size: 1.1rem; font-weight: 700; }
  .modal-body { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; }
  .modal-footer { display: flex; justify-content: flex-end; gap: .5rem; padding: .75rem 1.25rem; border-top: 1px solid var(--color-border); }
  .modal-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .modal-section-title { font-size: .85rem; font-weight: 700; margin-bottom: .5rem; color: var(--color-accent); }
  .modal-check { display: flex; align-items: center; gap: .4rem; font-size: .85rem; margin-bottom: .3rem; cursor: pointer; }
  .monster-search { width: 100%; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); color: var(--color-text); padding: .35rem .6rem; font-size: .85rem; margin-bottom: .5rem; }
  .monster-search:focus { outline: none; border-color: var(--color-accent); }
  .monster-results { max-height: 180px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: var(--radius); margin-bottom: .5rem; }
  .monster-result-row { display: flex; align-items: center; gap: .5rem; padding: .3rem .6rem; border-bottom: 1px solid var(--color-border); font-size: .82rem; }
  .monster-result-row:last-child { border-bottom: none; }
  .monster-result-row span:first-child { flex: 1; }
  .selected-monsters { display: flex; flex-direction: column; gap: .25rem; }
  .selected-monster-row { display: flex; align-items: center; justify-content: space-between; font-size: .82rem; padding: .2rem 0; }

  /* ── Toast ────────────────────────────────────────────────────────────────── */
  .toast {
    position: fixed; top: 1rem; right: 1rem; z-index: 100;
    background: #3a1a1a; border: 1px solid var(--color-danger); color: #ff8a8a;
    padding: .6rem 1rem; border-radius: var(--radius); font-size: .85rem;
    box-shadow: 0 4px 12px rgba(0,0,0,.5); animation: slideIn .2s ease-out;
  }
  @keyframes slideIn { from { transform: translateY(-8px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
