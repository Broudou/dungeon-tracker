<script>
  import { getSocket } from '$lib/socket';

  export let character = null;  // player's character object

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

  const ABILITIES = ['STR','DEX','CON','INT','WIS','CHA'];

  const ABILITY_GROUPS = ABILITIES.map(ab => ({
    ability: ab,
    skills: SKILLS.filter(s => s.ability === ab),
  }));

  function mod(score) { return Math.floor((score - 10) / 2); }

  function profBonus(level) {
    if (level <= 4)  return 2;
    if (level <= 8)  return 3;
    if (level <= 12) return 4;
    if (level <= 16) return 5;
    return 6;
  }

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

  function rollD20() {
    return Math.floor(Math.random() * 20) + 1;
  }

  function roll(skill) {
    const skillMod = getSkillMod(skill);
    let r1 = rollD20();
    let r2 = advantage || disadvantage ? rollD20() : null;
    let kept = r1;
    let kept2 = r2;
    if (advantage && r2 !== null)    { kept = Math.max(r1, r2); kept2 = r2; }
    if (disadvantage && r2 !== null) { kept = Math.min(r1, r2); kept2 = r2; }

    const total   = kept + skillMod;
    const modStr  = skillMod >= 0 ? `+${skillMod}` : `${skillMod}`;
    const formula = `${skill.name} (d20${modStr})`;
    const result  = total;
    const detail  = r2 !== null
      ? `[${r1},${r2}→${kept}]${modStr}=${total}`
      : `${kept}${modStr}=${total}`;

    lastRoll = { skill: skill.name, detail, total };

    getSocket()?.emit('roll:public', {
      formula,
      result: total,
      rollType: 'skill',
      context: `${skill.name} ${modStr} → ${detail}`,
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
      Last: <strong>{lastRoll.skill}</strong> → {lastRoll.detail}
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
  .skill-panel { display: flex; flex-direction: column; gap: .75rem; }
  .panel-header { display: flex; align-items: center; justify-content: space-between; }
  .panel-title { font-size: .9rem; font-weight: 700; }
  .adv-row { display: flex; gap: .5rem; }
  .adv-row label {
    display: flex; align-items: center; gap: .25rem;
    font-size: .75rem; font-weight: 600; color: var(--color-text-muted);
    cursor: pointer; padding: 2px 6px; border-radius: 999px;
    border: 1px solid var(--color-border);
  }
  .adv-row label.active { border-color: var(--color-accent); color: var(--color-accent); }
  .adv-row input { display: none; }

  .last-roll {
    font-size: .8rem;
    color: var(--color-text-muted);
    background: var(--color-surface-2);
    border-radius: var(--radius);
    padding: .3rem .6rem;
  }

  .ability-group { display: flex; flex-direction: column; gap: .3rem; }
  .ability-label { font-size: .65rem; font-weight: 700; letter-spacing: .1em; color: var(--color-text-muted); }
  .skill-btns { display: flex; flex-wrap: wrap; gap: .3rem; }
  .skill-btn {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    padding: .25rem .6rem;
    font-size: .78rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: .3rem;
    transition: border-color .1s;
  }
  .skill-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
  .skill-mod { font-weight: 700; color: var(--color-accent); font-size: .75rem; }
</style>
