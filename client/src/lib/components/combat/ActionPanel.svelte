<script>
  import { getSocket } from '$lib/socket';

  export let currentCombatant = null;  // full combatant object
  export let myCharId         = null;
  export let isDM             = false;
  export let campaign         = null;  // for player list / spell list
  export let sessionId        = null;

  let waiting    = false;
  let selected   = null;   // 'attack' | 'heal' | 'cast' | 'item' | 'improvise' | bonus/reaction variants
  let subForm    = {};
  let freeText   = '';

  // Derived: is it my turn?
  $: myTurn = isDM || (currentCombatant && currentCombatant.entityId === myCharId);

  // My character data
  $: myChar = campaign?.players?.find(p => p._id === myCharId);

  // Combat resource state (from currentCombatant if it's mine)
  $: resources = myTurn && currentCombatant ? {
    action:   !currentCombatant.actionSpent,
    bonus:    !currentCombatant.bonusActionSpent,
    reaction: !currentCombatant.reactionSpent,
  } : { action: false, bonus: false, reaction: false };

  const ATTACKS = [
    { label: 'Attack', type: 'attack', resource: 'action' },
    { label: 'Offhand Attack', type: 'attack', resource: 'bonus', isBonus: true },
    { label: 'Opportunity Attack', type: 'attack', resource: 'reaction', isReaction: true },
  ];
  const BONUS_ACTIONS = [
    { label: 'Second Wind', type: 'heal', resource: 'bonus', isBonus: true, selfOnly: true, healDice: '1d10', label2: 'Fighter only' },
    { label: 'Healing Word', type: 'heal', resource: 'bonus', isBonus: true, healDice: '1d4', label2: 'Bard/Cleric' },
    { label: 'Flurry of Blows', type: 'multiAttack', resource: 'bonus', isBonus: true, count: 2, label2: 'Monk' },
    { label: 'Divine Smite', type: 'improvise', resource: 'bonus', isBonus: true, label2: 'Paladin (post-hit)' },
    { label: 'Rage', type: 'improvise', resource: 'bonus', isBonus: true, label2: 'Barbarian' },
    { label: 'Cunning Action', type: 'improvise', resource: 'bonus', isBonus: true, label2: 'Rogue' },
    { label: 'Misty Step', type: 'improvise', resource: 'bonus', isBonus: true, label2: 'Warlock/Wizard' },
    { label: 'Wild Shape', type: 'improvise', resource: 'bonus', isBonus: true, label2: 'Druid' },
    { label: 'Hex / Hunter\'s Mark', type: 'improvise', resource: 'bonus', isBonus: true, label2: 'Warlock/Ranger' },
    { label: 'Bardic Inspiration', type: 'improvise', resource: 'bonus', isBonus: true, label2: 'Bard' },
  ];
  const REACTIONS = [
    { label: 'Shield', type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Wizard' },
    { label: 'Hellish Rebuke', type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Warlock' },
    { label: 'Counterspell', type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Caster' },
    { label: 'Absorb Elements', type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Various' },
  ];

  function selectAction(a) {
    selected = a;
    subForm  = {};
    freeText = '';
    if (a.selfOnly) subForm.targetInstanceId = currentCombatant?.instanceId;
  }

  function cancel() { selected = null; waiting = false; }

  function submit() {
    const s = getSocket();
    if (!s) return;

    let description = selected.label;
    const params = {
      ...subForm,
      isBonus:    !!selected.isBonus,
      isReaction: !!selected.isReaction,
    };

    if (selected.type === 'attack') {
      description = `${selected.label} → ${subForm.targetName || 'target'} (${subForm.damageDice || '1d8'} ${subForm.damageType || ''})`;
    } else if (selected.type === 'heal') {
      description = `${selected.label} → ${subForm.targetName || 'target'} (${selected.healDice || subForm.healDice || '1d8'} + ${subForm.healModifier || 0})`;
      params.healDice = selected.healDice || subForm.healDice || '1d8';
    } else if (selected.type === 'improvise' || selected.type === 'cast') {
      description = freeText || selected.label;
    }

    if (isDM) {
      // DM resolves immediately
      s.emit('combat:approveAction', {
        actionId: 'dm-' + Date.now(),
        override: { ...params, description, submitterName: 'DM' },
      });
      // Actually DM uses direct emits for most things — submit as pending + auto approve
      s.emit('combat:dmNote', { message: `DM: ${description}` });
    } else {
      s.emit('combat:submitAction', {
        actionType:  selected.type,
        description,
        params,
      });
      waiting = true;
    }
    selected = null;
  }

  // All combatants for target selection
  export let combatants = [];
  $: targetOptions = combatants.filter(c => !c.isDefeated);
</script>

<div class="panel">
  {#if !myTurn}
    <div class="waiting-state">
      <span class="wait-dot">◌</span>
      Waiting for {currentCombatant?.name ?? '…'}
    </div>

  {:else if waiting}
    <div class="waiting-state">
      <span class="wait-dot">◌</span>
      Waiting for DM approval…
      <button class="btn btn-ghost btn-sm" on:click={cancel}>Cancel</button>
    </div>

  {:else if selected}
    <!-- Sub-form -->
    <div class="sub-form">
      <div class="sub-form-header">
        <strong>{selected.label}</strong>
        <button class="btn btn-ghost btn-sm" on:click={cancel}>✕</button>
      </div>

      {#if selected.type === 'attack'}
        <div class="field-row">
          <label>Target</label>
          <select bind:value={subForm.targetInstanceId}
            on:change={e => { const t = targetOptions.find(c => c.instanceId === e.target.value); subForm.targetName = t?.name; }}>
            <option value="">— select —</option>
            {#each targetOptions as c}
              <option value={c.instanceId}>{c.name}</option>
            {/each}
          </select>
        </div>
        {#if myChar?.attackSummary?.length}
          <div class="field-row">
            <label>Weapon</label>
            <select on:change={e => {
              const atk = myChar.attackSummary[e.target.value];
              if (atk) { subForm.attackBonus = atk.attackBonus; subForm.damageDice = atk.damageDice; subForm.damageType = atk.damageType; }
            }}>
              <option value="">— select or fill below —</option>
              {#each myChar.attackSummary as atk, i}
                <option value={i}>{atk.name} (+{atk.attackBonus} / {atk.damageDice})</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="field-row">
          <label>Attack Bonus</label>
          <input type="number" bind:value={subForm.attackBonus} placeholder="+5" />
        </div>
        <div class="field-row">
          <label>Damage Dice</label>
          <input bind:value={subForm.damageDice} placeholder="1d8" />
        </div>
        <div class="field-row">
          <label>Damage Bonus</label>
          <input type="number" bind:value={subForm.damageBonus} placeholder="0" />
        </div>
        <div class="field-row">
          <label>Damage Type</label>
          <input bind:value={subForm.damageType} placeholder="slashing" />
        </div>

      {:else if selected.type === 'heal'}
        {#if !selected.selfOnly}
          <div class="field-row">
            <label>Target</label>
            <select bind:value={subForm.targetInstanceId}
              on:change={e => { const t = targetOptions.find(c => c.instanceId === e.target.value); subForm.targetName = t?.name; }}>
              <option value="">— select —</option>
              {#each targetOptions as c}
                <option value={c.instanceId}>{c.name}</option>
              {/each}
            </select>
          </div>
        {/if}
        <div class="field-row">
          <label>Heal Dice</label>
          <input bind:value={subForm.healDice} placeholder={selected.healDice || '1d8'} />
        </div>
        <div class="field-row">
          <label>Modifier</label>
          <input type="number" bind:value={subForm.healModifier} placeholder="0" />
        </div>

      {:else if selected.type === 'cast'}
        <div class="field-row">
          <label>Spell</label>
          <input bind:value={freeText} placeholder="Spell name + details…" />
        </div>
        <div class="field-row">
          <label>Slot Level</label>
          <select bind:value={subForm.slotLevel}>
            {#each [1,2,3,4,5,6,7,8,9] as l}
              <option value={l}>{l}</option>
            {/each}
          </select>
        </div>

      {:else}
        <!-- Improvise / bonus / reaction -->
        <div class="field-row">
          <label>Description</label>
          <input bind:value={freeText} placeholder="Describe the action…" />
        </div>
      {/if}

      <button class="btn btn-primary btn-sm sub-submit" on:click={submit}>
        {isDM ? 'Resolve' : 'Submit to DM'}
      </button>
    </div>

  {:else}
    <!-- Main action chooser -->
    <div class="action-chooser">
      <div class="resource-row">
        <span class="res" class:spent={!resources.action}>Action</span>
        <span class="res" class:spent={!resources.bonus}>Bonus</span>
        <span class="res" class:spent={!resources.reaction}>Reaction</span>
      </div>

      <div class="action-section">
        <p class="section-label">ACTIONS</p>
        <div class="btn-grid">
          <button class="action-btn" class:disabled={!resources.action} on:click={() => selectAction({ label:'Attack', type:'attack', resource:'action' })}>⚔ Attack</button>
          <button class="action-btn" on:click={() => selectAction({ label:'Cast Spell', type:'cast', resource:'action' })}>✨ Cast Spell</button>
          <button class="action-btn" on:click={() => selectAction({ label:'Heal (Cure Wounds)', type:'heal', resource:'action', healDice:'1d8' })}>❤ Heal</button>
          <button class="action-btn" on:click={() => selectAction({ label:'Dodge', type:'improvise', resource:'action' })}>🛡 Dodge</button>
          <button class="action-btn" on:click={() => selectAction({ label:'Help', type:'improvise', resource:'action' })}>🤝 Help</button>
          <button class="action-btn" on:click={() => selectAction({ label:'Use Item', type:'improvise', resource:'action' })}>🎒 Use Item</button>
          <button class="action-btn" on:click={() => selectAction({ label:'Improvise', type:'improvise', resource:'action' })}>✎ Improvise</button>
        </div>
      </div>

      <div class="action-section">
        <p class="section-label">BONUS ACTIONS</p>
        <div class="btn-grid">
          {#each BONUS_ACTIONS as a}
            <button class="action-btn action-btn--small" class:disabled={!resources.bonus} on:click={() => selectAction(a)}>
              {a.label}
              <span class="action-source">{a.label2}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="action-section">
        <p class="section-label">REACTIONS</p>
        <div class="btn-grid">
          {#each REACTIONS as a}
            <button class="action-btn action-btn--small" class:disabled={!resources.reaction} on:click={() => selectAction(a)}>
              {a.label}
              <span class="action-source">{a.label2}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .panel { height: 100%; overflow-y: auto; padding: .5rem; }

  .waiting-state {
    display: flex;
    align-items: center;
    gap: .5rem;
    color: var(--color-text-muted);
    font-size: .85rem;
    padding: .75rem;
    justify-content: center;
  }
  .wait-dot { animation: pulse 1.5s infinite; color: var(--color-accent); }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }

  .resource-row { display: flex; gap: .5rem; margin-bottom: .75rem; }
  .res { font-size: .72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--color-accent); color: #111; }
  .res.spent { background: var(--color-border); color: var(--color-text-muted); text-decoration: line-through; }

  .action-section { margin-bottom: .75rem; }
  .section-label { font-size: .65rem; font-weight: 700; letter-spacing: .1em; color: var(--color-text-muted); margin-bottom: .35rem; }
  .btn-grid { display: flex; flex-wrap: wrap; gap: .3rem; }
  .action-btn {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    padding: .35rem .7rem;
    font-size: .8rem;
    cursor: pointer;
    transition: border-color .1s, background .1s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }
  .action-btn:hover:not(.disabled) { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-surface); }
  .action-btn.disabled { opacity: .4; cursor: not-allowed; }
  .action-btn--small { font-size: .72rem; padding: .25rem .5rem; }
  .action-source { font-size: .6rem; color: var(--color-text-muted); }

  .sub-form { display: flex; flex-direction: column; gap: .5rem; }
  .sub-form-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .25rem; font-size: .9rem; }
  .field-row { display: flex; flex-direction: column; gap: .2rem; }
  .field-row label { font-size: .75rem; color: var(--color-text-muted); }
  .field-row input, .field-row select {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    padding: .3rem .5rem;
    font-size: .82rem;
  }
  .field-row input:focus, .field-row select:focus { outline: none; border-color: var(--color-accent); }
  .sub-submit { margin-top: .25rem; }
</style>
