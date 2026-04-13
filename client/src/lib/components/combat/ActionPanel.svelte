<script>
  import { getSocket } from '$lib/socket';

  export let currentCombatant = null;
  export let myCharId         = null;
  export let isDM             = false;
  export let campaign         = null;
  export let sessionId        = null;
  export let combatants       = [];

  let waiting  = false;
  let selected = null;
  let subForm  = {};
  let freeText = '';

  // Spell picker
  let showSpellPicker = false;
  let spellList = [];
  let spellsLoading = false;

  async function openSpellPicker() {
    showSpellPicker = true;
    if (spellList.length) return;
    spellsLoading = true;
    try {
      const classParam = myChar?.class ? `&class=${encodeURIComponent(myChar.class)}` : '';
      const res = await fetch(`/api/spells?limit=200${classParam}`, { credentials: 'include' });
      if (res.ok) spellList = await res.json();
    } catch { /* non-fatal */ }
    spellsLoading = false;
  }

  function pickSpell(spell) {
    showSpellPicker = false;
    selectAction({
      label: spell.name,
      type: 'cast',
      resource: 'action',
      spell,
    });
    freeText = spell.name;
  }

  $: spellsByLevel = (() => {
    const groups = {};
    for (const s of spellList) {
      const lvl = s.level ?? 0;
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b));
  })();

  const SCHOOL_ABBR = {
    Abjuration: 'Abj', Conjuration: 'Con', Divination: 'Div',
    Enchantment: 'Enc', Evocation: 'Evo', Illusion: 'Ill',
    Necromancy: 'Nec', Transmutation: 'Tra',
  };

  $: myTurn = isDM || (currentCombatant && currentCombatant.entityId === myCharId);
  $: myChar = campaign?.players?.find(p => p._id === myCharId);
  $: resources = myTurn && currentCombatant ? {
    action:   !currentCombatant.actionSpent,
    bonus:    !currentCombatant.bonusActionSpent,
    reaction: !currentCombatant.reactionSpent,
  } : { action: false, bonus: false, reaction: false };

  $: targetOptions = combatants.filter(c => !c.isDefeated);

  const BONUS_ACTIONS = [
    { label: 'Second Wind',       type: 'heal',      resource: 'bonus', isBonus: true, selfOnly: true, healDice: '1d10', label2: 'Fighter' },
    { label: 'Healing Word',      type: 'heal',      resource: 'bonus', isBonus: true, healDice: '1d4',  label2: 'Bard/Cleric' },
    { label: 'Flurry of Blows',   type: 'multiAttack',resource:'bonus', isBonus: true, count: 2,         label2: 'Monk' },
    { label: 'Divine Smite',      type: 'improvise', resource: 'bonus', isBonus: true,                   label2: 'Paladin' },
    { label: 'Rage',              type: 'improvise', resource: 'bonus', isBonus: true,                   label2: 'Barbarian' },
    { label: 'Cunning Action',    type: 'improvise', resource: 'bonus', isBonus: true,                   label2: 'Rogue' },
    { label: 'Misty Step',        type: 'improvise', resource: 'bonus', isBonus: true,                   label2: 'Warlock/Wizard' },
    { label: 'Wild Shape',        type: 'improvise', resource: 'bonus', isBonus: true,                   label2: 'Druid' },
    { label: "Hex / Hunter's Mark",type:'improvise', resource: 'bonus', isBonus: true,                   label2: 'Warlock/Ranger' },
    { label: 'Bardic Inspiration',type: 'improvise', resource: 'bonus', isBonus: true,                   label2: 'Bard' },
  ];
  const REACTIONS = [
    { label: 'Shield',           type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Wizard' },
    { label: 'Hellish Rebuke',   type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Warlock' },
    { label: 'Counterspell',     type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Caster' },
    { label: 'Absorb Elements',  type: 'improvise', resource: 'reaction', isReaction: true, label2: 'Various' },
  ];

  function selectAction(a) { selected = a; subForm = {}; freeText = ''; if (a.selfOnly) subForm.targetInstanceId = currentCombatant?.instanceId; }
  function cancel() { selected = null; waiting = false; }

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
    } else if (selected.type === 'improvise' || selected.type === 'cast') {
      description = freeText || selected.label;
    }

    if (isDM) {
      s.emit('combat:dmNote', { message: `DM: ${description}` });
    } else {
      s.emit('combat:submitAction', { actionType: selected.type, description, params });
      waiting = true;
    }
    selected = null;
  }
</script>

<div class="panel">
  {#if !myTurn}
    <div class="waiting-state">
      <span class="wait-dot">◌</span>
      Awaiting {currentCombatant?.name ?? '…'}
    </div>

  {:else if waiting}
    <div class="waiting-state">
      <span class="wait-dot">◌</span>
      Awaiting DM approval…
      <button class="btn btn-ghost btn-sm" on:click={cancel}>Cancel</button>
    </div>

  {:else if selected}
    <div class="sub-form">
      <div class="sub-form-header">
        <strong style="font-family:var(--font-heading); font-size:.88rem;">{selected.label}</strong>
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
          <label>Spell Description</label>
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
    <div class="action-chooser">
      <div class="resource-row">
        <span class="res" class:spent={!resources.action}>Action</span>
        <span class="res" class:spent={!resources.bonus}>Bonus</span>
        <span class="res" class:spent={!resources.reaction}>Reaction</span>
      </div>

      <div class="action-section">
        <p class="section-label">Actions</p>
        <div class="btn-grid">
          <button class="action-btn" class:disabled={!resources.action}
            on:click={() => selectAction({ label:'Attack', type:'attack', resource:'action' })}>Attack</button>
          <button class="action-btn"
            on:click={openSpellPicker}>Cast Spell</button>
          <button class="action-btn"
            on:click={() => selectAction({ label:'Heal', type:'heal', resource:'action', healDice:'1d8' })}>Heal</button>
          <button class="action-btn"
            on:click={() => selectAction({ label:'Dodge', type:'improvise', resource:'action' })}>Dodge</button>
          <button class="action-btn"
            on:click={() => selectAction({ label:'Help', type:'improvise', resource:'action' })}>Help</button>
          <button class="action-btn"
            on:click={() => selectAction({ label:'Use Item', type:'improvise', resource:'action' })}>Use Item</button>
          <button class="action-btn"
            on:click={() => selectAction({ label:'Improvise', type:'improvise', resource:'action' })}>Improvise</button>
        </div>
      </div>

      <div class="action-section">
        <p class="section-label">Bonus Actions</p>
        <div class="btn-grid">
          {#each BONUS_ACTIONS as a}
            <button class="action-btn action-btn--small" class:disabled={!resources.bonus}
              on:click={() => selectAction(a)}>
              {a.label}
              <span class="action-source">{a.label2}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="action-section">
        <p class="section-label">Reactions</p>
        <div class="btn-grid">
          {#each REACTIONS as a}
            <button class="action-btn action-btn--small" class:disabled={!resources.reaction}
              on:click={() => selectAction(a)}>
              {a.label}
              <span class="action-source">{a.label2}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Spell Picker Overlay -->
{#if showSpellPicker}
  <div class="spell-overlay" on:click={() => showSpellPicker = false}>
    <div class="spell-panel" on:click|stopPropagation>
      <div class="spell-panel-header">
        <span>Spellbook — {myChar?.name ?? 'Character'}</span>
        <button class="btn btn-ghost btn-sm" on:click={() => showSpellPicker = false}>✕</button>
      </div>

      {#if spellsLoading}
        <p class="text-muted" style="padding:.75rem; font-style:italic; font-size:.82rem;">Loading spells…</p>
      {:else if spellList.length === 0}
        <p class="text-muted" style="padding:.75rem; font-style:italic; font-size:.82rem;">
          No spells found. Add them to the character sheet in the Campaign editor.
        </p>
      {:else}
        <div class="spell-scroll">
          {#each spellsByLevel as [level, spells]}
            <p class="spell-level-label">
              {Number(level) === 0 ? 'Cantrips' : `Level ${level}`}
            </p>
            <div class="spell-grid">
              {#each spells as spell}
                <button class="spell-card" on:click={() => pickSpell(spell)}>
                  <div class="spell-school">{SCHOOL_ABBR[spell.school] ?? spell.school?.slice(0,3) ?? '?'}</div>
                  <div class="spell-name">{spell.name}</div>
                  <div class="spell-cast">{spell.castingTime ?? '1 action'}</div>
                  {#if spell.concentration}
                    <div class="spell-conc" title="Concentration">C</div>
                  {/if}
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .panel { height: 100%; overflow-y: auto; padding: .45rem; }

  .waiting-state {
    display: flex; align-items: center; gap: .5rem;
    font-family: var(--font-body); font-style: italic;
    color: var(--text-muted); font-size: .88rem;
    padding: .65rem; justify-content: center;
  }
  .wait-dot { animation: pulse 1.5s infinite; color: var(--gold); }

  .resource-row { display: flex; gap: .4rem; margin-bottom: .6rem; }
  .res {
    font-family: var(--font-heading); font-size: .68rem; font-weight: 700;
    letter-spacing: .06em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 999px;
    background: var(--gold-dim); color: var(--bg);
    border: 1px solid var(--gold);
  }
  .res.spent {
    background: var(--border-muted); color: var(--text-dim);
    border-color: var(--border-muted); text-decoration: line-through;
  }

  .action-section { margin-bottom: .65rem; }
  .section-label {
    font-family: var(--font-heading); font-size: .62rem; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase;
    color: var(--gold-dim); margin-bottom: .3rem;
    border-bottom: 1px solid var(--border-muted); padding-bottom: .15rem;
  }
  .btn-grid { display: flex; flex-wrap: wrap; gap: .25rem; }
  .action-btn {
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-heading);
    font-size: .75rem;
    letter-spacing: .03em;
    padding: .3rem .65rem;
    cursor: pointer;
    transition: border-color .1s, background .1s;
    display: flex; flex-direction: column; align-items: center; gap: 1px;
  }
  .action-btn:hover:not(.disabled) { border-color: var(--gold-dim); color: var(--gold); }
  .action-btn.disabled { opacity: .35; cursor: not-allowed; }
  .action-btn--small { font-size: .68rem; padding: .2rem .5rem; }
  .action-source { font-family: var(--font-body); font-size: .6rem; color: var(--text-dim); font-style: italic; }

  .sub-form { display: flex; flex-direction: column; gap: .45rem; }
  .sub-form-header { display: flex; align-items: center; justify-content: space-between; }
  .field-row { display: flex; flex-direction: column; gap: .15rem; }
  .field-row label {
    font-family: var(--font-heading); font-size: .68rem; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-muted);
  }
  .field-row input, .field-row select {
    background: var(--bg-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    padding: .28rem .5rem;
    font-family: var(--font-body);
    font-size: .85rem;
  }
  .field-row input:focus, .field-row select:focus { outline: none; border-color: var(--gold-dim); }
  .sub-submit { margin-top: .15rem; }

  /* ── Spell Picker ─────────────────────────────────────────────────────── */
  .spell-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    justify-content: flex-end;
  }
  .spell-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius) var(--radius) 0 0;
    width: min(480px, 100vw);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
  }
  .spell-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: .55rem .75rem;
    border-bottom: 1px solid var(--border-muted);
    font-family: var(--font-heading);
    font-size: .78rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: .06em;
    flex-shrink: 0;
  }
  .spell-scroll {
    overflow-y: auto;
    padding: .5rem .6rem .75rem;
    flex: 1;
  }
  .spell-level-label {
    font-family: var(--font-heading);
    font-size: .62rem;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: var(--gold-dim);
    border-bottom: 1px solid var(--border-muted);
    padding-bottom: .15rem;
    margin: .65rem 0 .35rem;
  }
  .spell-level-label:first-child { margin-top: 0; }
  .spell-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: .35rem;
  }
  .spell-card {
    position: relative;
    aspect-ratio: 1;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: .4rem .3rem .3rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .15rem;
    transition: border-color .15s, background .15s;
    text-align: center;
  }
  .spell-card:hover {
    border-color: var(--gold);
    background: rgba(201,168,76,0.08);
  }
  .spell-school {
    font-family: var(--font-heading);
    font-size: .58rem;
    letter-spacing: .05em;
    color: var(--text-dim);
    text-transform: uppercase;
  }
  .spell-name {
    font-family: var(--font-heading);
    font-size: .7rem;
    font-weight: 600;
    color: var(--text);
    line-height: 1.2;
    word-break: break-word;
  }
  .spell-cast {
    font-family: var(--font-body);
    font-size: .6rem;
    color: var(--text-muted);
    font-style: italic;
  }
  .spell-conc {
    position: absolute;
    top: 3px; right: 4px;
    font-family: var(--font-heading);
    font-size: .55rem;
    font-weight: 700;
    color: var(--gold);
    background: rgba(201,168,76,0.15);
    border: 1px solid var(--gold-dim);
    border-radius: 3px;
    padding: 0 3px;
    line-height: 1.4;
  }
</style>
