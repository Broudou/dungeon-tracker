<script>
  import { getSocket } from '$lib/socket';

  export let character = null;

  let advantage    = false;
  let disadvantage = false;
  let lastRoll     = null;

  const SKILLS = [
    { name:'Athletics',       ability:'STR' },
    { name:'Acrobatics',      ability:'DEX' },
    { name:'Sleight of Hand', ability:'DEX' },
    { name:'Stealth',         ability:'DEX' },
    { name:'Arcana',          ability:'INT' },
    { name:'History',         ability:'INT' },
    { name:'Investigation',   ability:'INT' },
    { name:'Nature',          ability:'INT' },
    { name:'Religion',        ability:'INT' },
    { name:'Animal Handling', ability:'WIS' },
    { name:'Insight',         ability:'WIS' },
    { name:'Medicine',        ability:'WIS' },
    { name:'Perception',      ability:'WIS' },
    { name:'Survival',        ability:'WIS' },
    { name:'Deception',       ability:'CHA' },
    { name:'Intimidation',    ability:'CHA' },
    { name:'Performance',     ability:'CHA' },
    { name:'Persuasion',      ability:'CHA' },
  ];

  const GROUPS = ['STR','DEX','CON','INT','WIS','CHA'].map(ab => ({
    ability: ab,
    skills:  SKILLS.filter(s => s.ability === ab),
  }));

  function abilMod(score) { return Math.floor((score - 10) / 2); }
  function profBonus(level) { return level <= 4 ? 2 : level <= 8 ? 3 : level <= 12 ? 4 : level <= 16 ? 5 : 6; }

  function skillMod(skill) {
    if (!character) return 0;
    const base = abilMod(character.stats?.[skill.ability] ?? 10);
    const pb   = profBonus(character.level || 1);
    const prof = character.skills?.[skill.name] || 'none';
    if (prof === 'expert')     return base + pb * 2;
    if (prof === 'proficient') return base + pb;
    return base;
  }

  function roll(skill) {
    const mod = skillMod(skill);
    let r1 = Math.floor(Math.random() * 20) + 1;
    let r2 = (advantage || disadvantage) ? Math.floor(Math.random() * 20) + 1 : null;
    let kept = r1;
    if (advantage    && r2 !== null) kept = Math.max(r1, r2);
    if (disadvantage && r2 !== null) kept = Math.min(r1, r2);
    const total  = kept + mod;
    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
    const detail = r2 !== null ? `[${r1},${r2}→${kept}]${modStr}=${total}` : `${kept}${modStr}=${total}`;

    lastRoll = { skill: skill.name, detail, total };

    getSocket()?.emit('roll:public', {
      formula:  `${skill.name} (d20${modStr})`,
      result:   total,
      rollType: 'skill',
      context:  `${skill.name} ${modStr} → ${detail}`,
    });
  }

  function toggleAdv(which) {
    if (which === 'adv') { advantage = !advantage; if (advantage) disadvantage = false; }
    else { disadvantage = !disadvantage; if (disadvantage) advantage = false; }
  }
</script>

<div class="skill-panel">
  <div class="panel-head">
    <span class="panel-title">Skill Checks</span>
    <div class="adv-row">
      <button class="adv-btn" class:active={advantage}    on:click={() => toggleAdv('adv')}>Adv</button>
      <button class="adv-btn" class:active={disadvantage} on:click={() => toggleAdv('dis')}>Dis</button>
    </div>
  </div>

  {#if lastRoll}
    <div class="last-roll">
      <strong>{lastRoll.skill}</strong>
      <span class="text-muted">{lastRoll.detail}</span>
      <span class="roll-total">{lastRoll.total}</span>
    </div>
  {/if}

  {#each GROUPS as group}
    {#if group.skills.length}
      <div class="group">
        <span class="group-label">{group.ability}</span>
        <div class="skill-row">
          {#each group.skills as skill}
            {@const m = skillMod(skill)}
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
  .skill-panel { display: flex; flex-direction: column; gap: 0.625rem; }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .panel-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text);
  }

  .adv-row { display: flex; gap: 0.25rem; }
  .adv-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-muted);
    font-family: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.1s;
  }
  .adv-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  .last-roll {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.3rem 0.6rem;
    font-size: 0.8125rem;
  }
  .last-roll strong { flex: 0 0 auto; }
  .last-roll .text-muted { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .roll-total { font-weight: 700; font-size: 1rem; min-width: 2em; text-align: right; }

  .group { display: flex; flex-direction: column; gap: 0.25rem; }
  .group-label {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-faint);
  }

  .skill-row { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .skill-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: inherit;
    font-size: 0.775rem;
    padding: 0.2rem 0.55rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    transition: all 0.1s;
  }
  .skill-btn:hover { border-color: var(--border-strong); background: var(--surface); }
  .skill-mod { font-weight: 700; font-size: 0.75rem; }
</style>
