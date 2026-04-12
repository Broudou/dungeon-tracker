<script>
  import { getSocket } from '$lib/socket';

  export let character = null;

  let advantage    = false;
  let disadvantage = false;
  let lastRoll     = null;

  const SKILLS = [
    { name: 'Athletics',       ability: 'STR' },
    { name: 'Acrobatics',      ability: 'DEX' },
    { name: 'Sleight of Hand', ability: 'DEX' },
    { name: 'Stealth',         ability: 'DEX' },
    { name: 'Arcana',          ability: 'INT' },
    { name: 'History',         ability: 'INT' },
    { name: 'Investigation',   ability: 'INT' },
    { name: 'Nature',          ability: 'INT' },
    { name: 'Religion',        ability: 'INT' },
    { name: 'Animal Handling', ability: 'WIS' },
    { name: 'Insight',         ability: 'WIS' },
    { name: 'Medicine',        ability: 'WIS' },
    { name: 'Perception',      ability: 'WIS' },
    { name: 'Survival',        ability: 'WIS' },
    { name: 'Deception',       ability: 'CHA' },
    { name: 'Intimidation',    ability: 'CHA' },
    { name: 'Performance',     ability: 'CHA' },
    { name: 'Persuasion',      ability: 'CHA' },
  ];

  const ABILITY_GROUPS = ['STR','DEX','CON','INT','WIS','CHA'].map(ab => ({
    ability: ab,
    skills: SKILLS.filter(s => s.ability === ab),
  }));

  function mod(score) { return Math.floor((score - 10) / 2); }
  function profBonus(level) { return level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : level <= 16 ? 5 : 6; }

  function getSkillMod(skill) {
    if (!character) return 0;
    const abilScore = character.stats?.[skill.ability] ?? 10;
    const base = mod(abilScore);
    const profLevel = character.skills?.[skill.name] || 'none';
    const pb = profBonus(character.level || 1);
    if (profLevel === 'expert')    return base + pb * 2;
    if (profLevel === 'proficient') return base + pb;
    return base;
  }

  function roll(skill) {
    const skillMod = getSkillMod(skill);
    let r1 = Math.floor(Math.random() * 20) + 1;
    let r2 = advantage || disadvantage ? Math.floor(Math.random() * 20) + 1 : null;
    let kept = r1;
    if (advantage && r2 !== null)    kept = Math.max(r1, r2);
    if (disadvantage && r2 !== null) kept = Math.min(r1, r2);
    const total   = kept + skillMod;
    const modStr  = skillMod >= 0 ? `+${skillMod}` : `${skillMod}`;
    const detail  = r2 !== null ? `[${r1},${r2}→${kept}]${modStr}=${total}` : `${kept}${modStr}=${total}`;

    lastRoll = { skill: skill.name, detail, total };

    getSocket()?.emit('roll:public', {
      formula:  `${skill.name} (d20${modStr})`,
      result:   total,
      rollType: 'skill',
      context:  `${skill.name} ${modStr} → ${detail}`,
    });
  }
</script>

<div class="skill-panel">
  <div class="panel-header">
    <span class="panel-title">Roll a Check</span>
    <div class="adv-row">
      <label class:active={advantage}>
        <input type="checkbox" bind:checked={advantage} on:change={() => { if (advantage) disadvantage = false; }} />
        ADV
      </label>
      <label class:active={disadvantage}>
        <input type="checkbox" bind:checked={disadvantage} on:change={() => { if (disadvantage) advantage = false; }} />
        DIS
      </label>
    </div>
  </div>

  {#if lastRoll}
    <div class="last-roll">
      <strong style="color:var(--gold);">{lastRoll.skill}</strong>
      <span style="color:var(--text-muted);">→ {lastRoll.detail}</span>
    </div>
  {/if}

  {#each ABILITY_GROUPS as group}
    {#if group.skills.length}
      <div class="ability-group">
        <span class="ability-label">{group.ability}</span>
        <div class="skill-btns">
          {#each group.skills as skill}
            {@const m = getSkillMod(skill)}
            <button class="skill-btn" on:click={() => roll(skill)}>
              {skill.name}
              <span class="skill-mod">{m >= 0 ? '+' : ''}{m}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</div>

<style>
  .skill-panel { display: flex; flex-direction: column; gap: .6rem; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; }
  .panel-title {
    font-family: var(--font-heading);
    font-size: .82rem;
    font-weight: 700;
    color: var(--gold);
    letter-spacing: .05em;
  }
  .adv-row { display: flex; gap: .4rem; }
  .adv-row label {
    display: flex; align-items: center; gap: .2rem;
    font-family: var(--font-heading); font-size: .68rem; font-weight: 600;
    letter-spacing: .06em; color: var(--text-muted);
    cursor: pointer; padding: 2px 6px; border-radius: 999px;
    border: 1px solid var(--border-muted); transition: all .1s;
  }
  .adv-row label.active { border-color: var(--gold-dim); color: var(--gold); }
  .adv-row input { display: none; }

  .last-roll {
    font-family: var(--font-body);
    font-size: .82rem;
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    padding: .3rem .55rem;
    display: flex; gap: .5rem; align-items: center;
  }

  .ability-group { display: flex; flex-direction: column; gap: .25rem; }
  .ability-label {
    font-family: var(--font-heading); font-size: .62rem; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: var(--gold-dim);
  }
  .skill-btns { display: flex; flex-wrap: wrap; gap: .25rem; }
  .skill-btn {
    background: var(--surface-2);
    border: 1px solid var(--border-muted);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font-heading);
    font-size: .7rem;
    letter-spacing: .03em;
    padding: .22rem .55rem;
    cursor: pointer;
    display: flex; align-items: center; gap: .3rem;
    transition: border-color .1s;
  }
  .skill-btn:hover { border-color: var(--gold-dim); color: var(--gold); }
  .skill-mod { font-weight: 700; color: var(--gold); }
</style>
