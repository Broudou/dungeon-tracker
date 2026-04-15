<script>
  import { getSocket } from '$lib/socket';

  export let order        = [];
  export let currentIndex = 0;
  export let round        = 0;
  export let isDM         = false;
  export let myCharId     = null;

  const CONDITIONS = [
    'Blinded','Charmed','Deafened','Frightened','Grappled','Incapacitated',
    'Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained',
    'Stunned','Unconscious','Exhaustion 1','Exhaustion 2','Exhaustion 3',
  ];
  const TAG_COLORS = ['red','green','blue','yellow','purple'];

  let expandedId   = null;
  let tagInput     = '';
  let tagColor     = 'yellow';
  let addingTagFor = null;

  function hpPct(c)  { return c.maxHp > 0 ? Math.max(0, c.currentHp / c.maxHp) : 0; }
  function hpColor(c) {
    const p = hpPct(c);
    return p > 0.5 ? 'var(--hp-high)' : p > 0.25 ? 'var(--hp-med)' : 'var(--hp-low)';
  }

  function nextTurn()         { getSocket()?.emit('combat:nextTurn'); }
  function adjustHp(c, delta) { const hp = Math.max(0, Math.min(c.maxHp, c.currentHp + delta)); getSocket()?.emit('combat:setHp', { instanceId: c.instanceId, hp }); }
  function setHpDirect(c, v)  { const hp = parseInt(v, 10); if (!isNaN(hp)) getSocket()?.emit('combat:setHp', { instanceId: c.instanceId, hp }); }
  function toggleCond(c, cond){ const active = !c.conditions.includes(cond); getSocket()?.emit('combat:setCondition', { instanceId: c.instanceId, condition: cond, active }); }
  function addTag(c)           { if (!tagInput.trim()) return; getSocket()?.emit('combat:addTag', { instanceId: c.instanceId, label: tagInput.trim(), color: tagColor }); tagInput = ''; addingTagFor = null; }
  function removeTag(c, i)     { getSocket()?.emit('combat:removeTag', { instanceId: c.instanceId, tagIndex: i }); }
</script>

<div class="tracker">
  <div class="tracker-head">
    <span class="round-label">Round {round}</span>
    {#if isDM}
      <button class="btn btn-primary btn-sm" on:click={nextTurn}>Next Turn →</button>
    {/if}
  </div>

  <div class="order-list">
    {#each order as c, i (c.instanceId)}
      {@const isCurrent = i === currentIndex}
      {@const isMe      = !isDM && c.entityId === myCharId}
      <div
        class="combatant"
        class:current={isCurrent}
        class:defeated={c.isDefeated}
        class:mine={isMe}
      >
        <!-- Summary row — click to expand (DM only) -->
        <div
          class="c-row"
          on:click={() => isDM && (expandedId = expandedId === c.instanceId ? null : c.instanceId)}
          role={isDM ? 'button' : undefined}
          tabindex={isDM ? 0 : undefined}
          on:keydown={e => isDM && e.key === 'Enter' && (expandedId = expandedId === c.instanceId ? null : c.instanceId)}
        >
          <span class="c-arrow" aria-hidden="true">{isCurrent ? '▶' : ' '}</span>
          <span class="c-name">{c.name}</span>
          {#if c.level}<span class="c-tag">Lv{c.level}</span>{/if}
          {#if c.cr}<span class="c-tag">CR{c.cr}</span>{/if}

          <div class="c-hp-track">
            <div class="c-hp-fill" style="width:{Math.max(4, hpPct(c)*100)}%; background:{hpColor(c)};"></div>
          </div>
          <span class="c-hp-num">{c.currentHp}/{c.maxHp}</span>
          <span class="c-init">{c.initiative}</span>
          {#if c.dotEffects?.length > 0}
            <span class="dot-badge" title="{c.dotEffects.length} DoT effect(s)">🔥{c.dotEffects.length}</span>
          {/if}
        </div>

        <!-- Conditions & tags row -->
        {#if c.conditions.length || c.customTags.length}
          <div class="pill-row">
            {#each c.conditions as cond}
              <span class="pill pill-red">{cond}</span>
            {/each}
            {#each c.customTags as tag, ti}
              <span class="pill pill-{tag.color}">
                {tag.label}
                {#if isDM}
                  <button class="pill-remove" on:click|stopPropagation={() => removeTag(c, ti)} aria-label="Remove tag">×</button>
                {/if}
              </span>
            {/each}
          </div>
        {/if}

        <!-- Expanded DM controls -->
        {#if isDM && expandedId === c.instanceId}
          <div class="expanded">
            <!-- HP controls -->
            <div class="hp-controls">
              <button class="btn btn-danger btn-sm" on:click={() => adjustHp(c, -5)}>−5</button>
              <button class="btn btn-danger btn-sm" on:click={() => adjustHp(c, -1)}>−1</button>
              <input
                type="number"
                class="hp-direct"
                value={c.currentHp}
                min="0" max={c.maxHp}
                on:change={e => setHpDirect(c, e.target.value)}
              />
              <button class="btn btn-secondary btn-sm" on:click={() => adjustHp(c, 1)}>+1</button>
              <button class="btn btn-secondary btn-sm" on:click={() => adjustHp(c, 5)}>+5</button>
            </div>

            <!-- Conditions grid -->
            <div class="cond-grid">
              {#each CONDITIONS as cond}
                <button
                  class="cond-btn"
                  class:active={c.conditions.includes(cond)}
                  on:click={() => toggleCond(c, cond)}
                >{cond}</button>
              {/each}
            </div>

            <!-- Custom tag form -->
            {#if addingTagFor === c.instanceId}
              <div class="tag-form">
                <input bind:value={tagInput} placeholder="Tag label…" maxlength="30" class="tag-input" />
                <select bind:value={tagColor} class="tag-sel">
                  {#each TAG_COLORS as col}<option value={col}>{col}</option>{/each}
                </select>
                <button class="btn btn-primary btn-sm" on:click={() => addTag(c)}>Add</button>
                <button class="btn btn-ghost btn-sm" on:click={() => addingTagFor = null}>Cancel</button>
              </div>
            {:else}
              <button class="btn btn-ghost btn-sm" style="margin-top: 0.25rem;"
                on:click={() => { addingTagFor = c.instanceId; tagInput = ''; }}>+ Tag</button>
            {/if}

            <!-- DoT effects (DM can remove) -->
            {#if c.dotEffects?.length > 0}
              <div class="dot-section">
                <span class="dot-section-label">Active DoTs</span>
                {#each c.dotEffects as dot}
                  <div class="dot-row">
                    <span class="dot-name">{dot.spellName}</span>
                    <span class="dot-dice">{dot.damageDice} {dot.damageType}</span>
                    <span class="dot-round">R{dot.appliedRound}</span>
                    <button class="btn btn-ghost btn-sm dot-remove"
                      on:click|stopPropagation={() => getSocket()?.emit('combat:removeDot', { instanceId: c.instanceId, effectId: dot.effectId })}>
                      Remove
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .tracker { display: flex; flex-direction: column; gap: 0.25rem; }

  .tracker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
  }

  .round-label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .order-list { display: flex; flex-direction: column; gap: 2px; }

  .combatant {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.15s;
  }
  .combatant.current { border-color: var(--text); }
  .combatant.defeated { opacity: 0.35; }
  .combatant.mine { border-color: #3b82f6; }

  .c-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.35rem 0.5rem;
    cursor: pointer;
    user-select: none;
    min-height: 32px;
  }
  .c-row:hover { background: var(--surface-2); }

  .c-arrow { color: var(--text); font-size: 0.75rem; width: 1em; flex-shrink: 0; }
  .c-name  { font-weight: 600; font-size: 0.8125rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c-tag   { font-size: 0.7rem; color: var(--text-faint); flex-shrink: 0; }

  .c-hp-track {
    width: 48px;
    height: 3px;
    background: var(--border);
    border-radius: 2px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .c-hp-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s, background 0.3s;
  }

  .c-hp-num { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
  .c-init   { font-size: 0.75rem; font-weight: 700; color: var(--text); min-width: 1.5em; text-align: right; flex-shrink: 0; }

  .dot-badge { font-size: 0.7rem; color: #f97316; flex-shrink: 0; cursor: default; }
  .dot-section { display: flex; flex-direction: column; gap: 2px; margin-top: 0.375rem; }
  .dot-section-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--text-faint); }
  .dot-row { display: flex; align-items: center; gap: 0.375rem; font-size: 0.78rem; }
  .dot-name { font-weight: 600; flex: 1; }
  .dot-dice { color: #ef4444; font-size: 0.72rem; }
  .dot-round { color: var(--text-faint); font-size: 0.7rem; }
  .dot-remove { margin-left: auto; }

  .pill-row { display: flex; flex-wrap: wrap; gap: 2px; padding: 0 0.5rem 0.35rem; }

  .expanded {
    padding: 0.4rem 0.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    background: var(--surface-2);
  }

  .hp-controls { display: flex; gap: 0.25rem; align-items: center; }
  .hp-direct {
    width: 52px;
    text-align: center;
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 0.8125rem;
    padding: 0.2rem 0.35rem;
  }

  .cond-grid { display: flex; flex-wrap: wrap; gap: 2px; }
  .cond-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.7rem;
    padding: 1px 7px;
    cursor: pointer;
    transition: all 0.1s;
  }
  .cond-btn:hover { border-color: var(--border-strong); color: var(--text); }
  .cond-btn.active { background: var(--danger-bg); border-color: #fca5a5; color: var(--danger); font-weight: 600; }

  .tag-form { display: flex; gap: 0.25rem; align-items: center; flex-wrap: wrap; }
  .tag-input { flex: 1; min-width: 90px; font-size: 0.8125rem; }
  .tag-sel   { width: auto; font-size: 0.8125rem; }
</style>
