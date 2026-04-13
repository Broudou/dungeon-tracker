<script>
  import { getSocket } from '$lib/socket';

  export let currentCombatant = null;
  export let myCharId         = null;
  export let isDM             = false;
  export let campaign         = null;
  export let combatants       = [];

  let waiting         = false;
  let selected        = null;
  let subForm         = {};
  let freeText        = '';
  let showSpellPicker = false;
  let spellList       = [];
  let spellsLoading   = false;

  const SCHOOL_ABBR = { Abjuration:'Abj', Conjuration:'Con', Divination:'Div', Enchantment:'Enc', Evocation:'Evo', Illusion:'Ill', Necromancy:'Nec', Transmutation:'Tra' };

  const SPELLCASTER_CLASSES = ['Wizard','Sorcerer','Bard','Cleric','Druid','Warlock','Paladin','Ranger','Artificer'];

  const BONUS_ACTIONS = [
    { label:'Second Wind',         type:'heal',        resource:'bonus', isBonus:true, selfOnly:true, healDice:'1d10', sub:'Fighter',    classes:['Fighter'] },
    { label:'Healing Word',        type:'heal',        resource:'bonus', isBonus:true, healDice:'1d4',                sub:'Bard/Cleric', classes:['Bard','Cleric'] },
    { label:'Flurry of Blows',     type:'multiAttack', resource:'bonus', isBonus:true, count:2,                       sub:'Monk',        classes:['Monk'] },
    { label:'Divine Smite',        type:'improvise',   resource:'bonus', isBonus:true,                               sub:'Paladin',     classes:['Paladin'] },
    { label:'Rage',                type:'improvise',   resource:'bonus', isBonus:true,                               sub:'Barbarian',   classes:['Barbarian'] },
    { label:'Cunning Action',      type:'improvise',   resource:'bonus', isBonus:true,                               sub:'Rogue',       classes:['Rogue'] },
    { label:'Misty Step',          type:'improvise',   resource:'bonus', isBonus:true,                               sub:'Warlock/Wiz', classes:['Warlock','Wizard','Sorcerer'] },
    { label:'Wild Shape',          type:'improvise',   resource:'bonus', isBonus:true,                               sub:'Druid',       classes:['Druid'] },
    { label:"Hex / Hunter's Mark", type:'improvise',   resource:'bonus', isBonus:true,                               sub:'Wlk/Rgr',     classes:['Warlock','Ranger'] },
    { label:'Bardic Inspiration',  type:'improvise',   resource:'bonus', isBonus:true,                               sub:'Bard',        classes:['Bard'] },
  ];

  const REACTIONS = [
    { label:'Shield',           type:'improvise', resource:'reaction', isReaction:true, sub:'Wizard',  classes:['Wizard','Sorcerer'] },
    { label:'Hellish Rebuke',   type:'improvise', resource:'reaction', isReaction:true, sub:'Warlock', classes:['Warlock'] },
    { label:'Counterspell',     type:'improvise', resource:'reaction', isReaction:true, sub:'Caster',  classes:['Wizard','Sorcerer','Bard','Cleric','Druid','Warlock'] },
    { label:'Absorb Elements',  type:'improvise', resource:'reaction', isReaction:true, sub:'Various', classes:[] },
    { label:'Opportunity Attack',type:'attack',   resource:'reaction', isReaction:true, sub:'All',     classes:[] },
  ];

  function matchesClass(classes, charClass) {
    if (!classes || classes.length === 0) return true;
    if (!charClass) return true;
    return classes.some(c => c.toLowerCase() === charClass.toLowerCase());
  }

  $: myTurn    = isDM || (currentCombatant && currentCombatant.entityId === myCharId);
  $: myChar    = campaign?.players?.find(p => p._id === myCharId);
  $: isMonster = myTurn && (currentCombatant?.entityType === 'monster' || currentCombatant?.entityType === 'custom');
  $: charClass = currentCombatant?.class ?? myChar?.class ?? '';
  $: canCastSpells = !isMonster && SPELLCASTER_CLASSES.some(c => c.toLowerCase() === charClass.toLowerCase());

  $: filteredBonusActions  = BONUS_ACTIONS.filter(a => matchesClass(a.classes, charClass));
  $: filteredReactions     = REACTIONS.filter(a => matchesClass(a.classes, charClass));

  $: resources = myTurn && currentCombatant ? {
    action:   !currentCombatant.actionSpent,
    bonus:    !currentCombatant.bonusActionSpent,
    reaction: !currentCombatant.reactionSpent,
  } : { action: false, bonus: false, reaction: false };

  $: targetOptions = combatants.filter(c => !c.isDefeated);

  $: spellsByLevel = (() => {
    const g = {};
    for (const s of spellList) { const l = s.level ?? 0; (g[l] ??= []).push(s); }
    return Object.entries(g).sort(([a],[b]) => Number(a) - Number(b));
  })();

  // Monster action lists
  $: monsterActions          = currentCombatant?.actions          ?? [];
  $: monsterReactions        = currentCombatant?.reactions        ?? [];
  $: monsterLegendaryActions = currentCombatant?.legendaryActions ?? [];
  $: monsterTraits           = currentCombatant?.traits           ?? [];

  async function openSpellPicker() {
    showSpellPicker = true;
    if (spellList.length) return;
    spellsLoading = true;
    try {
      const classParam = charClass ? `&class=${encodeURIComponent(charClass)}` : '';
      const res = await fetch(`/api/spells?limit=200${classParam}`, { credentials: 'include' });
      if (res.ok) spellList = await res.json();
    } catch { /* non-fatal */ }
    spellsLoading = false;
  }

  function pickSpell(spell) {
    showSpellPicker = false;
    const s = getSocket();
    if (!s) return;
    const name = currentCombatant?.name ?? 'Unknown';
    const description = `${name} cast ${spell.name}`;
    if (isDM) {
      s.emit('combat:dmNote', { message: `DM: ${description}` });
    } else {
      s.emit('combat:submitAction', { actionType: 'cast', description, params: { spellName: spell.name } });
      waiting = true;
    }
  }

  function announceAction(msg) {
    const s = getSocket();
    if (!s) return;
    const name = currentCombatant?.name ?? 'Unknown';
    const description = `${name} ${msg}`;
    if (isDM) {
      s.emit('combat:dmNote', { message: `DM: ${description}` });
    } else {
      s.emit('combat:submitAction', { actionType: 'improvise', description, params: {} });
      waiting = true;
    }
  }

  function selectMonsterAction(a) {
    if (a.damageDice || a.attackBonus != null) {
      selectAction({
        label:       a.name,
        description: a.description,
        type:        'attack',
        resource:    'action',
        attackBonus: a.attackBonus ?? 0,
        damageDice:  a.damageDice  ?? '1d6',
        damageType:  a.damageType  ?? '',
      });
    } else {
      selectAction({ label: a.name, description: a.description, type: 'improvise', resource: 'action' });
      freeText = a.description ?? a.name;
    }
  }

  function selectMonsterReaction(a) {
    selectAction({ label: a.name, description: a.description, type: 'improvise', resource: 'reaction', isReaction: true });
    freeText = a.description ?? a.name;
  }

  function selectLegendaryAction(a) {
    selectAction({ label: a.name, description: a.description, type: 'improvise', resource: 'legendary' });
    freeText = a.description ?? a.name;
  }

  function selectAction(a) {
    selected = a; subForm = {}; freeText = a.description ? (freeText || '') : '';
    if (a.selfOnly) subForm.targetInstanceId = currentCombatant?.instanceId;
    if (a.attackBonus != null) subForm.attackBonus = a.attackBonus;
    if (a.damageDice)  subForm.damageDice  = a.damageDice;
    if (a.damageType)  subForm.damageType  = a.damageType;
  }

  function cancel() { selected = null; waiting = false; freeText = ''; }

  function submit() {
    const s = getSocket();
    if (!s) return;
    let description = selected.label;
    const params = { ...subForm, isBonus: !!selected.isBonus, isReaction: !!selected.isReaction };

    if (selected.type === 'attack') {
      description = `${selected.label} → ${subForm.targetName || 'target'} (${subForm.damageDice || '1d8'} ${subForm.damageType || ''})`;
    } else if (selected.type === 'heal') {
      description = `${selected.label} → ${subForm.targetName || 'target'} (${selected.healDice || subForm.healDice || '1d8'}+${subForm.healModifier || 0})`;
      params.healDice = selected.healDice || subForm.healDice || '1d8';
    } else if (selected.type === 'help') {
      const name = currentCombatant?.name ?? 'Unknown';
      description = `${name} is helping ${subForm.targetName || 'an ally'}`;
    } else if (selected.type === 'improvise' || selected.type === 'cast' || selected.type === 'legendary') {
      description = freeText || selected.label;
    }

    if (isDM) {
      s.emit('combat:dmNote', { message: `DM: ${description}` });
    } else {
      s.emit('combat:submitAction', { actionType: selected.type, description, params });
      waiting = true;
    }
    selected = null;
    freeText = '';
  }
</script>

<div class="panel">

  {#if !myTurn}
    <div class="idle-msg">
      <span class="idle-dot" aria-hidden="true">○</span>
      Waiting for {currentCombatant?.name ?? '…'}
    </div>

  {:else if waiting}
    <div class="idle-msg">
      <span class="idle-dot" aria-hidden="true">◉</span>
      Awaiting DM approval…
      <button class="btn btn-ghost btn-sm" on:click={cancel}>Cancel</button>
    </div>

  {:else if selected}
    <!-- Sub-form for chosen action -->
    <div class="sub-form">
      <div class="sub-form-head">
        <strong style="font-size: 0.875rem;">{selected.label}</strong>
        <button class="btn btn-ghost btn-sm" on:click={cancel}>✕</button>
      </div>

      {#if selected.description}
        <p class="action-desc">{selected.description}</p>
      {/if}

      {#if selected.type === 'attack'}
        <div class="field-sm">
          <label>Target</label>
          <select bind:value={subForm.targetInstanceId}
            on:change={e => { const t = targetOptions.find(c => c.instanceId === e.target.value); subForm.targetName = t?.name; }}>
            <option value="">— select target —</option>
            {#each targetOptions as c}<option value={c.instanceId}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="field-row-2">
          <div class="field-sm"><label>Attack Bonus</label><input type="number" bind:value={subForm.attackBonus} placeholder="+5" /></div>
          <div class="field-sm"><label>Damage Dice</label><input bind:value={subForm.damageDice} placeholder="1d8" /></div>
          <div class="field-sm"><label>Damage Bonus</label><input type="number" bind:value={subForm.damageBonus} placeholder="0" /></div>
          <div class="field-sm"><label>Damage Type</label><input bind:value={subForm.damageType} placeholder="slashing" /></div>
        </div>

      {:else if selected.type === 'heal'}
        {#if !selected.selfOnly}
          <div class="field-sm">
            <label>Target</label>
            <select bind:value={subForm.targetInstanceId}
              on:change={e => { const t = targetOptions.find(c => c.instanceId === e.target.value); subForm.targetName = t?.name; }}>
              <option value="">— select target —</option>
              {#each targetOptions as c}<option value={c.instanceId}>{c.name}</option>{/each}
            </select>
          </div>
        {/if}
        <div class="field-row-2">
          <div class="field-sm"><label>Heal Dice</label><input bind:value={subForm.healDice} placeholder={selected.healDice || '1d8'} /></div>
          <div class="field-sm"><label>Modifier</label><input type="number" bind:value={subForm.healModifier} placeholder="0" /></div>
        </div>

      {:else if selected.type === 'help'}
        <div class="field-sm">
          <label>Helping</label>
          <select bind:value={subForm.targetInstanceId}
            on:change={e => { const t = targetOptions.find(c => c.instanceId === e.target.value); subForm.targetName = t?.name; }}>
            <option value="">— select ally —</option>
            {#each targetOptions as c}<option value={c.instanceId}>{c.name}</option>{/each}
          </select>
        </div>

      {:else if selected.type === 'cast'}
        <div class="field-sm">
          <label>Spell name</label>
          <input bind:value={freeText} placeholder="Spell name…" />
        </div>
        {#if canCastSpells}
          <button class="btn btn-ghost btn-sm" on:click={openSpellPicker} style="align-self: flex-start;">Browse spells</button>
        {/if}

      {:else}
        <div class="field-sm"><label>Description</label><input bind:value={freeText} placeholder="Describe the action…" /></div>
      {/if}

      <button class="btn btn-primary btn-sm" on:click={submit} style="margin-top: 0.25rem;">
        {isDM ? 'Resolve' : 'Submit to DM'}
      </button>
    </div>

  {:else if isMonster}
    <!-- Monster / custom creature action chooser -->
    <div class="chooser">
      <div class="resource-row">
        <span class="res" class:spent={!resources.action}>Action</span>
        <span class="res" class:spent={!resources.reaction}>Reaction</span>
      </div>

      {#if monsterActions.length}
        <div class="action-section">
          <p class="section-head">Actions</p>
          <div class="action-grid">
            {#each monsterActions as a}
              <button class="action-btn" class:has-attack={!!(a.damageDice || a.attackBonus != null)}
                on:click={() => selectMonsterAction(a)}>
                {a.name}
                {#if a.damageDice}<span class="action-sub">{a.damageDice} {a.damageType || ''}</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if monsterReactions.length}
        <div class="action-section">
          <p class="section-head">Reactions</p>
          <div class="action-grid">
            {#each monsterReactions as a}
              <button class="action-btn action-btn-sm" class:disabled={!resources.reaction}
                on:click={() => selectMonsterReaction(a)}>
                {a.name}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if monsterLegendaryActions.length}
        <div class="action-section">
          <p class="section-head">Legendary Actions</p>
          <div class="action-grid">
            {#each monsterLegendaryActions as a}
              <button class="action-btn action-btn-sm" on:click={() => selectLegendaryAction(a)}>
                {a.name}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if monsterTraits.length}
        <div class="action-section">
          <p class="section-head">Traits</p>
          <div class="trait-list">
            {#each monsterTraits as t}
              <div class="trait-row">
                <span class="trait-name">{t.name}.</span>
                <span class="trait-desc">{t.description ?? ''}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if !monsterActions.length && !monsterTraits.length}
        <p class="text-faint text-sm" style="padding: 0.5rem 0;">No actions stored for this creature.</p>
      {/if}
    </div>

  {:else}
    <!-- Player action chooser -->
    <div class="chooser">
      <div class="resource-row">
        <span class="res" class:spent={!resources.action}>Action</span>
        <span class="res" class:spent={!resources.bonus}>Bonus</span>
        <span class="res" class:spent={!resources.reaction}>Reaction</span>
      </div>

      <div class="action-section">
        <p class="section-head">Actions</p>
        <div class="action-grid">
          <button class="action-btn" class:disabled={!resources.action}
            on:click={() => selectAction({ label:'Attack', type:'attack', resource:'action' })}>Attack</button>
          <button class="action-btn"
            on:click={() => selectAction({ label:'Cast Spell', type:'cast', resource:'action' })}>Cast Spell</button>
          <button class="action-btn"
            on:click={() => announceAction('is disengaging')}>Disengage</button>
          <button class="action-btn"
            on:click={() => announceAction('is dodging')}>Dodge</button>
          <button class="action-btn"
            on:click={() => selectAction({ label:'Help', type:'help', resource:'action' })}>Help</button>
          <button class="action-btn"
            on:click={() => announceAction('is trying to hide')}>Hide</button>
          <button class="action-btn"
            on:click={() => announceAction('is readying an action')}>Ready</button>
          <button class="action-btn"
            on:click={() => announceAction('is searching')}>Search</button>
        </div>
      </div>

      {#if filteredBonusActions.length}
        <div class="action-section">
          <p class="section-head">Bonus Actions</p>
          <div class="action-grid">
            {#each filteredBonusActions as a}
              <button class="action-btn action-btn-sm" class:disabled={!resources.bonus} on:click={() => selectAction(a)}>
                {a.label}
                <span class="action-sub">{a.sub}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if filteredReactions.length}
        <div class="action-section">
          <p class="section-head">Reactions</p>
          <div class="action-grid">
            {#each filteredReactions as a}
              <button class="action-btn action-btn-sm" class:disabled={!resources.reaction} on:click={() => selectAction(a)}>
                {a.label}
                <span class="action-sub">{a.sub}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Spell picker overlay -->
{#if showSpellPicker}
  <div class="overlay-backdrop" on:click={() => showSpellPicker = false} role="presentation"></div>
  <div class="spell-panel">
    <div class="spell-head">
      <span>{myChar?.name ?? currentCombatant?.name ?? 'Spellbook'}</span>
      <button class="btn btn-ghost btn-sm" on:click={() => showSpellPicker = false}>✕</button>
    </div>
    {#if spellsLoading}
      <p class="text-muted text-sm" style="padding: 1rem;">Loading spells…</p>
    {:else if spellList.length === 0}
      <p class="text-muted text-sm" style="padding: 1rem;">No spells found for this character.</p>
    {:else}
      <div class="spell-scroll">
        {#each spellsByLevel as [level, spells]}
          <p class="spell-level">{Number(level) === 0 ? 'Cantrips' : `Level ${level}`}</p>
          <div class="spell-grid">
            {#each spells as spell}
              <button class="spell-tile" on:click={() => pickSpell(spell)}>
                <span class="spell-school">{SCHOOL_ABBR[spell.school] ?? spell.school?.slice(0,3) ?? '?'}</span>
                <span class="spell-name">{spell.name}</span>
                <span class="spell-cast">{spell.castingTime ?? '1 action'}</span>
                {#if spell.concentration}<span class="spell-conc" title="Concentration">C</span>{/if}
              </button>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .panel { height: 100%; overflow-y: auto; padding: 0.5rem; }

  .idle-msg {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    color: var(--text-muted);
    font-size: 0.875rem;
    justify-content: center;
  }

  .idle-dot { animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .resource-row { display: flex; gap: 0.375rem; margin-bottom: 0.75rem; }
  .res {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--text);
    color: #fff;
    border: 1px solid var(--text);
  }
  .res.spent {
    background: var(--surface-2);
    color: var(--text-faint);
    border-color: var(--border);
    text-decoration: line-through;
  }

  .chooser { display: flex; flex-direction: column; gap: 0.75rem; }
  .action-section {}
  .section-head {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    margin-bottom: 0.3rem;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid var(--border);
  }

  .action-grid { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .action-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.3rem 0.7rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    transition: all 0.1s;
  }
  .action-btn:hover:not(.disabled) { border-color: var(--border-strong); background: var(--surface); }
  .action-btn.disabled { opacity: 0.35; cursor: not-allowed; }
  .action-btn.has-attack { border-color: var(--accent, #7c6af7); }
  .action-btn-sm { font-size: 0.75rem; padding: 0.2rem 0.55rem; }
  .action-sub { font-size: 0.65rem; color: var(--text-faint); font-style: italic; }

  /* Traits */
  .trait-list { display: flex; flex-direction: column; gap: 0.375rem; }
  .trait-row { font-size: 0.8rem; line-height: 1.4; }
  .trait-name { font-weight: 600; margin-right: 0.25rem; }
  .trait-desc { color: var(--text-muted); }

  /* Action description in sub-form */
  .action-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    line-height: 1.4;
    padding: 0.375rem 0.5rem;
    background: var(--surface-2);
    border-radius: var(--radius);
    border-left: 2px solid var(--border-strong);
    margin-bottom: 0.25rem;
  }

  /* Sub-form */
  .sub-form { display: flex; flex-direction: column; gap: 0.5rem; }
  .sub-form-head { display: flex; align-items: center; justify-content: space-between; }
  .field-sm { display: flex; flex-direction: column; gap: 0.2rem; }
  .field-sm label { font-size: 0.75rem; font-weight: 500; color: var(--text-muted); }
  .field-sm input, .field-sm select { font-size: 0.8125rem; }
  .field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; }

  /* Spell picker */
  .overlay-backdrop { position: fixed; inset: 0; z-index: 200; }
  .spell-panel {
    position: fixed;
    bottom: 0;
    right: 0;
    width: min(480px, 100vw);
    max-height: 68vh;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    box-shadow: var(--shadow-md);
    z-index: 201;
    display: flex;
    flex-direction: column;
  }
  .spell-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.875rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  .spell-scroll { overflow-y: auto; padding: 0.5rem 0.75rem 1rem; flex: 1; }
  .spell-level {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-faint);
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.15rem;
    margin: 0.75rem 0 0.375rem;
  }
  .spell-level:first-child { margin-top: 0; }
  .spell-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 0.3rem; }
  .spell-tile {
    position: relative;
    aspect-ratio: 1;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.375rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    text-align: center;
    transition: all 0.1s;
  }
  .spell-tile:hover { border-color: var(--border-strong); background: var(--surface); }
  .spell-school { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-faint); }
  .spell-name   { font-size: 0.72rem; font-weight: 600; color: var(--text); line-height: 1.2; word-break: break-word; }
  .spell-cast   { font-size: 0.62rem; color: var(--text-muted); font-style: italic; }
  .spell-conc   {
    position: absolute; top: 3px; right: 4px;
    font-size: 0.6rem; font-weight: 700;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 2px; padding: 0 3px; line-height: 1.4;
    color: var(--text-muted);
  }
</style>
