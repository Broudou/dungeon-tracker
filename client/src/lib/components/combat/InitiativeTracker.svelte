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

  let expandedId = null;
  let tagInput   = '';
  let tagColor   = 'yellow';
  let addingTagFor = null;

  function hpColor(c) {
    const pct = c.maxHp > 0 ? c.currentHp / c.maxHp : 0;
    return pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#e94560';
  }

  function nextTurn() {
    getSocket()?.emit('combat:nextTurn');
  }

  function adjustHp(c, delta) {
    const hp = Math.max(0, Math.min(c.maxHp, c.currentHp + delta));
    getSocket()?.emit('combat:setHp', { instanceId: c.instanceId, hp });
  }

  function setHpDirect(c, val) {
    const hp = parseInt(val, 10);
    if (isNaN(hp)) return;
    getSocket()?.emit('combat:setHp', { instanceId: c.instanceId, hp });
  }

  function toggleCondition(c, cond) {
    const active = !c.conditions.includes(cond);
    getSocket()?.emit('combat:setCondition', { instanceId: c.instanceId, condition: cond, active });
  }

  function addTag(c) {
    if (!tagInput.trim()) return;
    getSocket()?.emit('combat:addTag', { instanceId: c.instanceId, label: tagInput.trim(), color: tagColor });
    tagInput = ''; addingTagFor = null;
  }

  function removeTag(c, i) {
    getSocket()?.emit('combat:removeTag', { instanceId: c.instanceId, tagIndex: i });
  }
</script>

<div class="tracker">
  <div class="tracker-header">
    <span class="round-badge">Round {round}</span>
    {#if isDM}
      <button class="btn btn-primary btn-sm next-btn" on:click={nextTurn}>▶ Next Turn</button>
    {/if}
  </div>

  <div class="order-list">
    {#each order as c, i (c.instanceId)}
      {@const isCurrent = i === currentIndex}
      {@const isMyChar  = !isDM && c.entityId === myCharId}
      <div
        class="combatant"
        class:current={isCurrent}
        class:defeated={c.isDefeated}
        class:mine={isMyChar}
      >
        <div class="combatant-main" on:click={() => expandedId = expandedId === c.instanceId ? null : c.instanceId}>
          <span class="turn-arrow">{isCurrent ? '▶' : '\u00a0'}</span>
          <span class="c-name">{c.name}</span>
          {#if c.level}<span class="c-meta">Lv{c.level}</span>{/if}
          {#if c.cr}<span class="c-meta">CR{c.cr}</span>{/if}

          <div class="c-hp-bar" style="background:{hpColor(c)}; width:{c.maxHp > 0 ? Math.max(4, (c.currentHp/c.maxHp)*60) : 4}px"></div>
          <span class="c-hp-num">{c.currentHp}/{c.maxHp}</span>

          <span class="c-init">{c.initiative}</span>
        </div>

        <!-- Condition/tag pills -->
        {#if c.conditions.length || c.customTags.length}
          <div class="pill-row">
            {#each c.conditions as cond}
              <span class="pill pill-red">{cond}</span>
            {/each}
            {#each c.customTags as tag, ti}
              <span class="pill pill-{tag.color}">
                {tag.label}
                {#if isDM}<button class="pill-remove" on:click|stopPropagation={() => removeTag(c, ti)}>×</button>{/if}
              </span>
            {/each}
          </div>
        {/if}

        <!-- Expanded DM controls -->
        {#if isDM && expandedId === c.instanceId}
          <div class="expanded">
            <div class="hp-controls">
              <button class="btn btn-danger btn-sm" on:click={() => adjustHp(c, -1)}>−1</button>
              <button class="btn btn-danger btn-sm" on:click={() => adjustHp(c, -5)}>−5</button>
              <input
                type="number"
                class="hp-direct"
                value={c.currentHp}
                min="0"
                max={c.maxHp}
                on:change={e => setHpDirect(c, e.target.value)}
              />
              <button class="btn btn-secondary btn-sm" on:click={() => adjustHp(c, 5)}>+5</button>
              <button class="btn btn-secondary btn-sm" on:click={() => adjustHp(c, 1)}>+1</button>
            </div>

            <div class="cond-grid">
              {#each CONDITIONS as cond}
                <button
                  class="cond-btn"
                  class:active={c.conditions.includes(cond)}
                  on:click={() => toggleCondition(c, cond)}
                >{cond}</button>
              {/each}
            </div>

            {#if addingTagFor === c.instanceId}
              <div class="tag-form">
                <input class="tag-input" bind:value={tagInput} placeholder="Tag label…" maxlength="30" />
                <select class="tag-color-sel" bind:value={tagColor}>
                  {#each TAG_COLORS as col}
                    <option value={col}>{col}</option>
                  {/each}
                </select>
                <button class="btn btn-primary btn-sm" on:click={() => addTag(c)}>Add</button>
                <button class="btn btn-ghost btn-sm" on:click={() => addingTagFor = null}>Cancel</button>
              </div>
            {:else}
              <button class="btn btn-ghost btn-sm" style="margin-top:.5rem" on:click={() => { addingTagFor = c.instanceId; tagInput = ''; }}>+ Tag</button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .tracker { display: flex; flex-direction: column; gap: .5rem; }
  .tracker-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .25rem; }
  .round-badge { font-size: .85rem; font-weight: 700; color: var(--color-accent); letter-spacing: .05em; }
  .next-btn { flex-shrink: 0; }

  .order-list { display: flex; flex-direction: column; gap: 2px; }

  .combatant {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .combatant.current { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }
  .combatant.defeated { opacity: .4; }
  .combatant.mine { border-color: #5dade2; }

  .combatant-main {
    display: flex;
    align-items: center;
    gap: .4rem;
    padding: .4rem .6rem;
    cursor: pointer;
    user-select: none;
  }
  .combatant-main:hover { background: var(--color-surface-2); }

  .turn-arrow { color: var(--color-accent); font-size: .9rem; width: 1em; }
  .c-name { font-weight: 600; font-size: .85rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c-meta { font-size: .7rem; color: var(--color-text-muted); flex-shrink: 0; }
  .c-hp-bar { height: 4px; border-radius: 2px; flex-shrink: 0; transition: width 0.4s, background 0.4s; }
  .c-hp-num { font-size: .72rem; color: var(--color-text-muted); white-space: nowrap; flex-shrink: 0; font-variant-numeric: tabular-nums; }
  .c-init { font-size: .75rem; color: var(--color-accent); font-weight: 700; flex-shrink: 0; width: 2em; text-align: right; }

  .pill-row { display: flex; flex-wrap: wrap; gap: 3px; padding: 0 .6rem .4rem; }
  .pill { font-size: .65rem; font-weight: 600; padding: 1px 6px; border-radius: 999px; display: inline-flex; align-items: center; gap: 3px; }
  .pill-red    { background: #3a1a1a; color: #ff8a8a; }
  .pill-green  { background: #1a3a1a; color: #8aff8a; }
  .pill-blue   { background: #1a2a3a; color: #8ab4ff; }
  .pill-yellow { background: #3a2e1a; color: #ffd27a; }
  .pill-purple { background: #2a1a3a; color: #d4a8ff; }
  .pill-remove { background: none; border: none; cursor: pointer; color: inherit; opacity: .7; padding: 0; font-size: .65rem; line-height: 1; }

  .expanded { padding: .5rem .6rem; border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: .4rem; }
  .hp-controls { display: flex; gap: .3rem; align-items: center; }
  .hp-direct { width: 56px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); color: var(--color-text); padding: .25rem .4rem; text-align: center; font-size: .85rem; }

  .cond-grid { display: flex; flex-wrap: wrap; gap: 3px; }
  .cond-btn { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: 999px; color: var(--color-text-muted); font-size: .65rem; padding: 2px 7px; cursor: pointer; transition: all .1s; }
  .cond-btn.active { background: #3a1a1a; border-color: #e94560; color: #ff8a8a; }
  .cond-btn:hover { border-color: var(--color-text-muted); color: var(--color-text); }

  .tag-form { display: flex; gap: .3rem; align-items: center; flex-wrap: wrap; }
  .tag-input { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); color: var(--color-text); padding: .25rem .5rem; font-size: .8rem; flex: 1; min-width: 100px; }
  .tag-color-sel { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); color: var(--color-text); padding: .25rem .4rem; font-size: .8rem; }
</style>
