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

  function hpColor(c) {
    const pct = c.maxHp > 0 ? c.currentHp / c.maxHp : 0;
    return pct > 0.5 ? 'var(--success)' : pct > 0.25 ? 'var(--warning)' : 'var(--crimson)';
  }

  function nextTurn()         { getSocket()?.emit('combat:nextTurn'); }
  function adjustHp(c, delta) { const hp = Math.max(0, Math.min(c.maxHp, c.currentHp + delta)); getSocket()?.emit('combat:setHp', { instanceId: c.instanceId, hp }); }
  function setHpDirect(c, val){ const hp = parseInt(val, 10); if (!isNaN(hp)) getSocket()?.emit('combat:setHp', { instanceId: c.instanceId, hp }); }
  function toggleCondition(c, cond) { const active = !c.conditions.includes(cond); getSocket()?.emit('combat:setCondition', { instanceId: c.instanceId, condition: cond, active }); }
  function addTag(c)          { if (!tagInput.trim()) return; getSocket()?.emit('combat:addTag', { instanceId: c.instanceId, label: tagInput.trim(), color: tagColor }); tagInput = ''; addingTagFor = null; }
  function removeTag(c, i)    { getSocket()?.emit('combat:removeTag', { instanceId: c.instanceId, tagIndex: i }); }
</script>

<div class="tracker">
  <div class="tracker-header">
    <span class="round-badge">Round {round}</span>
    {#if isDM}
      <button class="btn btn-primary btn-sm" on:click={nextTurn}>Next Turn</button>
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
        <div class="combatant-main"
          on:click={() => expandedId = expandedId === c.instanceId ? null : c.instanceId}>
          <span class="turn-arrow">{isCurrent ? '▶' : ' '}</span>
          <span class="c-name">{c.name}</span>
          {#if c.level}<span class="c-meta">Lv{c.level}</span>{/if}
          {#if c.cr}<span class="c-meta">CR{c.cr}</span>{/if}

          <div class="c-hp-bar" style="background:{hpColor(c)}; width:{c.maxHp > 0 ? Math.max(4, (c.currentHp/c.maxHp)*56) : 4}px"></div>
          <span class="c-hp-num">{c.currentHp}/{c.maxHp}</span>
          <span class="c-init">{c.initiative}</span>
        </div>

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

        {#if isDM && expandedId === c.instanceId}
          <div class="expanded">
            <div class="hp-controls">
              <button class="btn btn-danger btn-sm" on:click={() => adjustHp(c, -5)}>−5</button>
              <button class="btn btn-danger btn-sm" on:click={() => adjustHp(c, -1)}>−1</button>
              <input type="number" class="hp-direct" value={c.currentHp} min="0" max={c.maxHp}
                on:change={e => setHpDirect(c, e.target.value)} />
              <button class="btn btn-secondary btn-sm" on:click={() => adjustHp(c, 1)}>+1</button>
              <button class="btn btn-secondary btn-sm" on:click={() => adjustHp(c, 5)}>+5</button>
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
              <button class="btn btn-ghost btn-sm" style="margin-top:.35rem"
                on:click={() => { addingTagFor = c.instanceId; tagInput = ''; }}>+ Tag</button>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .tracker { display: flex; flex-direction: column; gap: .4rem; }
  .tracker-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .2rem; }
  .round-badge {
    font-family: var(--font-heading);
    font-size: .78rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .order-list { display: flex; flex-direction: column; gap: 2px; }

  .combatant {
    background: var(--surface);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color .2s;
  }
  .combatant.current { border-color: var(--gold); }
  .combatant.defeated { opacity: .35; }
  .combatant.mine { border-color: #3a6b8b; }

  .combatant-main {
    display: flex; align-items: center; gap: .4rem;
    padding: .35rem .5rem;
    cursor: pointer; user-select: none;
  }
  .combatant-main:hover { background: var(--surface-2); }

  .turn-arrow { color: var(--gold); font-size: .85rem; width: 1em; flex-shrink: 0; }
  .c-name { font-family: var(--font-heading); font-weight: 600; font-size: .8rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c-meta { font-family: var(--font-heading); font-size: .65rem; color: var(--text-muted); flex-shrink: 0; }
  .c-hp-bar { height: 3px; border-radius: 2px; flex-shrink: 0; transition: width .4s, background .4s; }
  .c-hp-num { font-family: 'Courier New', monospace; font-size: .68rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
  .c-init { font-family: var(--font-heading); font-size: .72rem; color: var(--gold); font-weight: 700; flex-shrink: 0; width: 2em; text-align: right; }

  .pill-row { display: flex; flex-wrap: wrap; gap: 2px; padding: 0 .5rem .35rem; }

  .expanded { padding: .4rem .5rem; border-top: 1px solid var(--border-muted); display: flex; flex-direction: column; gap: .35rem; }
  .hp-controls { display: flex; gap: .25rem; align-items: center; }
  .hp-direct {
    width: 52px;
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .2rem .35rem;
    text-align: center;
    font-family: var(--font-heading);
    font-size: .8rem;
  }

  .cond-grid { display: flex; flex-wrap: wrap; gap: 2px; }
  .cond-btn {
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: 999px;
    color: var(--text-muted);
    font-family: var(--font-heading);
    font-size: .6rem;
    letter-spacing: .04em;
    padding: 1px 6px;
    cursor: pointer;
    transition: all .1s;
  }
  .cond-btn.active { background: rgba(139,26,26,0.3); border-color: var(--crimson); color: #e8a0a0; }
  .cond-btn:hover { border-color: var(--gold-dim); color: var(--text); }

  .tag-form { display: flex; gap: .25rem; align-items: center; flex-wrap: wrap; }
  .tag-input {
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .2rem .45rem;
    font-size: .78rem;
    font-family: var(--font-body);
    flex: 1; min-width: 90px;
  }
  .tag-color-sel {
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .2rem .35rem;
    font-size: .75rem;
    font-family: var(--font-heading);
  }
</style>
