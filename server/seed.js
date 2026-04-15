/**
 * Seed script — populates Monster, Spell, and Ability collections.
 *
 * Source priority for all data:
 *   1. https://www.dnd5eapi.co/api  (official D&D 5e SRD API)
 *   2. https://api.open5e.com       (fallback, same SRD data, paginated)
 *   3. Embedded minimal fallback    (offline / both APIs down)
 *
 * Fetched: monsters, spells, class features (abilities), racial traits
 *
 * Usage: npm run seed
 * Requires Node 18+ (native fetch).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Monster  = require('./models/Monster');
const Spell    = require('./models/Spell');
const Ability  = require('./models/Ability');

const HARDCODED_SPELLS    = require('./data/spells');
const HARDCODED_ABILITIES = require('./data/abilities');

const TIMEOUT = 20_000;

// ── dnd5eapi.co fetchers ──────────────────────────────────────────────────────

async function fetchDnd5eMonsters() {
  const listRes = await fetch('https://www.dnd5eapi.co/api/monsters', {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!listRes.ok) throw new Error(`dnd5eapi list HTTP ${listRes.status}`);
  const { results } = await listRes.json();
  console.log(`  Found ${results.length} monsters on dnd5eapi.co — fetching full data…`);

  const monsters = [];
  const BATCH    = 15;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch   = results.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(m =>
        fetch(`https://www.dnd5eapi.co${m.url}`, { signal: AbortSignal.timeout(TIMEOUT) })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${m.url}`); return r.json(); })
      )
    );
    monsters.push(...fetched);
    process.stdout.write(`\r  Fetched ${monsters.length}/${results.length}…`);
  }
  process.stdout.write('\n');
  return monsters;
}

async function fetchDnd5eSpells() {
  const listRes = await fetch('https://www.dnd5eapi.co/api/spells', {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!listRes.ok) throw new Error(`dnd5eapi spells list HTTP ${listRes.status}`);
  const { results } = await listRes.json();
  console.log(`  Found ${results.length} spells on dnd5eapi.co — fetching full data…`);

  const spells = [];
  const BATCH  = 15;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch   = results.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(s =>
        fetch(`https://www.dnd5eapi.co${s.url}`, { signal: AbortSignal.timeout(TIMEOUT) })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${s.url}`); return r.json(); })
      )
    );
    spells.push(...fetched);
    process.stdout.write(`\r  Fetched ${spells.length}/${results.length}…`);
  }
  process.stdout.write('\n');
  return spells;
}

async function fetchDnd5eFeatures() {
  const listRes = await fetch('https://www.dnd5eapi.co/api/features', {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!listRes.ok) throw new Error(`dnd5eapi features list HTTP ${listRes.status}`);
  const { results } = await listRes.json();
  console.log(`  Found ${results.length} features on dnd5eapi.co — fetching full data…`);

  const features = [];
  const BATCH    = 15;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch   = results.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(f =>
        fetch(`https://www.dnd5eapi.co${f.url}`, { signal: AbortSignal.timeout(TIMEOUT) })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${f.url}`); return r.json(); })
      )
    );
    features.push(...fetched);
    process.stdout.write(`\r  Fetched ${features.length}/${results.length}…`);
  }
  process.stdout.write('\n');
  return features;
}

async function fetchDnd5eTraits() {
  const listRes = await fetch('https://www.dnd5eapi.co/api/traits', {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!listRes.ok) throw new Error(`dnd5eapi traits list HTTP ${listRes.status}`);
  const { results } = await listRes.json();
  console.log(`  Found ${results.length} traits on dnd5eapi.co — fetching full data…`);

  const traits = [];
  const BATCH  = 15;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch   = results.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(t =>
        fetch(`https://www.dnd5eapi.co${t.url}`, { signal: AbortSignal.timeout(TIMEOUT) })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${t.url}`); return r.json(); })
      )
    );
    traits.push(...fetched);
    process.stdout.write(`\r  Fetched ${traits.length}/${results.length}…`);
  }
  process.stdout.write('\n');
  return traits;
}

// ── open5e paginated fetcher (fallback) ───────────────────────────────────────

async function fetchOpen5eAll(url, collected = []) {
  process.stdout.write(`\r  Fetching page… (${collected.length} so far)`);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`open5e HTTP ${res.status}`);
  const data = await res.json();
  collected.push(...(data.results || []));
  if (data.next) return fetchOpen5eAll(data.next, collected);
  process.stdout.write('\n');
  return collected;
}

// ── dnd5eapi.co → our schema mappers ─────────────────────────────────────────

function mapDnd5eAction(a) {
  // damage can be on a.damage or a.attacks[*].damage
  const dmgArr   = Array.isArray(a.damage) ? a.damage : (a.attacks?.[0]?.damage ?? []);
  const firstDmg = dmgArr[0] ?? {};
  return {
    name:        a.name        || '',
    description: a.desc        || '',
    attackBonus: a.attack_bonus ?? null,
    damageDice:  firstDmg.damage_dice  || null,
    damageType:  firstDmg.damage_type?.name || null,
    saveDC:      a.dc?.dc_value      ?? null,
    saveAbility: a.dc?.dc_type?.name || null,
  };
}

function mapDnd5eMonster(m) {
  const acVal = Array.isArray(m.armor_class)
    ? (m.armor_class[0]?.value ?? 10)
    : (m.armor_class ?? 10);

  const speed = typeof m.speed === 'object'
    ? Object.entries(m.speed).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ')
    : String(m.speed || '');

  const senses = typeof m.senses === 'object'
    ? Object.entries(m.senses).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')
    : String(m.senses || '');

  const savingThrows = {};
  for (const s of (m.saving_throws || [])) {
    savingThrows[s.name.toUpperCase().slice(0, 3)] = s.value;
  }

  function toArr(v) {
    if (Array.isArray(v)) return v;
    return typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
  }

  // Capitalise first letter of type/size (API returns lowercase)
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  return {
    name:            m.name,
    cr:              String(m.challenge_rating ?? ''),
    type:            cap(m.type),
    size:            cap(m.size),
    alignment:       m.alignment || '',
    stats: {
      STR: m.strength      ?? 10,
      DEX: m.dexterity     ?? 10,
      CON: m.constitution  ?? 10,
      INT: m.intelligence  ?? 10,
      WIS: m.wisdom        ?? 10,
      CHA: m.charisma      ?? 10,
    },
    hp: {
      average:        m.hit_points      ?? 0,
      diceExpression: m.hit_points_roll || m.hit_dice || '',
    },
    AC:              acVal,
    speed,
    savingThrows,
    senses,
    languages:       m.languages || '',
    resistances:     toArr(m.damage_resistances),
    immunities:      toArr(m.damage_immunities),
    vulnerabilities: toArr(m.damage_vulnerabilities),
    actions:          (m.actions           || []).map(mapDnd5eAction),
    reactions:        (m.reactions         || []).map(mapDnd5eAction),
    traits:           (m.special_abilities || []).map(mapDnd5eAction),
    legendaryActions: (m.legendary_actions || []).map(mapDnd5eAction),
  };
}

function mapDnd5eSpell(s) {
  const dmgAtSlot = s.damage?.damage_at_slot_level ?? s.damage?.damage_at_character_level ?? {};
  return {
    name:          s.name,
    level:         s.level ?? 0,
    school:        s.school?.name || '',
    castingTime:   s.casting_time || '',
    range:         s.range        || '',
    components:    (s.components || []).join(', ') + (s.material ? ` (${s.material})` : ''),
    duration:      s.duration     || '',
    concentration: s.concentration === true,
    damageType:    s.damage?.damage_type?.name || null,
    damageDice:    Object.values(dmgAtSlot)[0] || null,
    saveAbility:   s.dc?.dc_type?.name || null,
    halfOnSave:    s.dc?.dc_success?.toLowerCase() === 'half',
    healDice:      s.heal_at_slot_level ? Object.values(s.heal_at_slot_level)[0] : null,
    description:   (s.desc || []).join('\n'),
    classes:       (s.classes || []).map(c => c.name).join(', '),
  };
}

function mapDnd5eFeature(f) {
  return {
    name:        f.name,
    description: (f.desc || []).join('\n'),
    type:        'ability',
    classes:     f.class?.name ? [f.class.name] : [],
    level:       f.level || 1,
    resource:    'passive',
    actionType:  null,
  };
}

function mapDnd5eTrait(t) {
  return {
    name:        t.name,
    description: (t.desc || []).join('\n'),
    type:        'trait',
    classes:     [],
    level:       1,
    resource:    'passive',
    actionType:  null,
  };
}

// ── open5e → our schema mappers ───────────────────────────────────────────────

function mapOpen5eAction(a) {
  return {
    name:        a.name          || '',
    description: a.desc          || '',
    attackBonus: a.attack_bonus  ?? null,
    damageDice:  a.damage?.[0]?.damage_dice        || null,
    damageType:  a.damage?.[0]?.damage_type?.name  || null,
    saveDC:      a.dc?.dc_value      ?? null,
    saveAbility: a.dc?.dc_type?.name || null,
  };
}

function mapOpen5eMonster(m) {
  return {
    name:      m.name,
    cr:        String(m.challenge_rating ?? ''),
    type:      m.type      || '',
    size:      m.size      || '',
    alignment: m.alignment || '',
    stats: {
      STR: m.strength, DEX: m.dexterity, CON: m.constitution,
      INT: m.intelligence, WIS: m.wisdom, CHA: m.charisma,
    },
    hp: {
      average:        m.hit_points,
      diceExpression: m.hit_dice || '',
    },
    AC:    m.armor_class,
    speed: typeof m.speed === 'object'
      ? Object.entries(m.speed).map(([k, v]) => `${k} ${v}`).join(', ')
      : String(m.speed || ''),
    savingThrows: m.strength_save != null ? {
      STR: m.strength_save, DEX: m.dexterity_save,
      CON: m.constitution_save, INT: m.intelligence_save,
      WIS: m.wisdom_save, CHA: m.charisma_save,
    } : {},
    senses:          m.senses    || '',
    languages:       m.languages || '',
    resistances:     (m.damage_resistances    || '').split(',').map(s => s.trim()).filter(Boolean),
    immunities:      (m.damage_immunities     || '').split(',').map(s => s.trim()).filter(Boolean),
    vulnerabilities: (m.damage_vulnerabilities|| '').split(',').map(s => s.trim()).filter(Boolean),
    actions:          (m.actions           || []).map(mapOpen5eAction),
    reactions:        (m.reactions         || []).map(mapOpen5eAction),
    traits:           (m.special_abilities || []).map(mapOpen5eAction),
    legendaryActions: (m.legendary_actions || []).map(mapOpen5eAction),
  };
}

function mapOpen5eSpell(s) {
  return {
    name:          s.name,
    level:         s.level_int ?? s.level ?? 0,
    school:        s.school        || '',
    castingTime:   s.casting_time  || '',
    range:         s.range         || '',
    components:    s.components    || '',
    duration:      s.duration      || '',
    concentration: s.concentration?.toLowerCase() === 'yes' || s.concentration === true,
    damageType:    s.damage?.damage_type?.name || null,
    damageDice:    s.damage?.damage_at_slot_level
      ? Object.values(s.damage.damage_at_slot_level)[0]
      : null,
    saveAbility: s.dc?.dc_type?.name || null,
    halfOnSave:  s.dc?.dc_success?.toLowerCase() === 'half' || false,
    healDice:    s.heal_at_slot_level
      ? Object.values(s.heal_at_slot_level)[0]
      : null,
    description: s.desc   || '',
    classes:     (s.spell_lists || s.classes || []).map(c => (typeof c === 'string' ? c : c.name)).join(', '),
  };
}

// ── embedded fallback data ────────────────────────────────────────────────────

const FALLBACK_MONSTERS = [
  { name:'Goblin',      cr:'1/4', type:'Humanoid', size:'Small',  alignment:'neutral evil',  stats:{STR:8,DEX:14,CON:10,INT:10,WIS:8,CHA:8},   hp:{average:7,  diceExpression:'2d6'},     AC:15, speed:'30 ft.', actions:[{name:'Scimitar',description:'Melee weapon attack.',attackBonus:4,damageDice:'1d6+2',damageType:'Slashing'}], reactions:[], traits:[], legendaryActions:[] },
  { name:'Kobold',      cr:'1/8', type:'Humanoid', size:'Small',  alignment:'lawful evil',   stats:{STR:7,DEX:15,CON:9,INT:8,WIS:7,CHA:8},    hp:{average:5,  diceExpression:'2d6-2'},    AC:12, speed:'30 ft.', actions:[{name:'Dagger',description:'Melee weapon attack.',attackBonus:4,damageDice:'1d4+2',damageType:'Piercing'}], reactions:[], traits:[], legendaryActions:[] },
  { name:'Skeleton',    cr:'1/4', type:'Undead',   size:'Medium', alignment:'lawful evil',   stats:{STR:10,DEX:14,CON:15,INT:6,WIS:8,CHA:5},  hp:{average:13, diceExpression:'2d8+4'},    AC:13, speed:'30 ft.', actions:[], reactions:[], traits:[], legendaryActions:[] },
  { name:'Zombie',      cr:'1/4', type:'Undead',   size:'Medium', alignment:'neutral evil',  stats:{STR:13,DEX:6,CON:16,INT:3,WIS:6,CHA:5},   hp:{average:22, diceExpression:'3d8+9'},    AC:8,  speed:'20 ft.', actions:[], reactions:[], traits:[], legendaryActions:[] },
  { name:'Wolf',        cr:'1/4', type:'Beast',    size:'Medium', alignment:'unaligned',     stats:{STR:12,DEX:15,CON:12,INT:3,WIS:12,CHA:6},  hp:{average:11, diceExpression:'2d8+2'},    AC:13, speed:'40 ft.', actions:[], reactions:[], traits:[], legendaryActions:[] },
  { name:'Orc',         cr:'1/2', type:'Humanoid', size:'Medium', alignment:'chaotic evil',  stats:{STR:16,DEX:12,CON:16,INT:7,WIS:11,CHA:10}, hp:{average:15, diceExpression:'2d8+6'},    AC:13, speed:'30 ft.', actions:[{name:'Greataxe',description:'Melee weapon attack.',attackBonus:5,damageDice:'1d12+3',damageType:'Slashing'}], reactions:[], traits:[], legendaryActions:[] },
  { name:'Troll',       cr:'5',   type:'Giant',    size:'Large',  alignment:'chaotic evil',  stats:{STR:18,DEX:13,CON:20,INT:7,WIS:9,CHA:7},   hp:{average:84, diceExpression:'8d10+40'},  AC:15, speed:'30 ft.', actions:[], reactions:[], traits:[{name:'Regeneration',description:'The troll regains 10 hit points at the start of its turn.'}], legendaryActions:[] },
  { name:'Owlbear',     cr:'3',   type:'Monstrosity',size:'Large',alignment:'unaligned',     stats:{STR:20,DEX:12,CON:17,INT:3,WIS:12,CHA:7},  hp:{average:59, diceExpression:'7d10+21'},  AC:13, speed:'40 ft.', actions:[], reactions:[], traits:[], legendaryActions:[] },
  { name:'Vampire',     cr:'13',  type:'Undead',   size:'Medium', alignment:'lawful evil',   stats:{STR:18,DEX:18,CON:18,INT:17,WIS:15,CHA:18},hp:{average:144,diceExpression:'17d8+68'}, AC:16, speed:'30 ft.', actions:[], reactions:[], traits:[], legendaryActions:[] },
  { name:'Adult Red Dragon', cr:'17', type:'Dragon', size:'Huge', alignment:'chaotic evil',  stats:{STR:27,DEX:10,CON:25,INT:16,WIS:13,CHA:21},hp:{average:256,diceExpression:'19d12+133'},AC:19, speed:'40 ft., fly 80 ft.', actions:[], reactions:[], traits:[], legendaryActions:[] },
];

const FALLBACK_SPELLS = [
  // ── Cantrips (level 0) ────────────────────────────────────────────────────
  { name:'Fire Bolt',         level:0, school:'Evocation',    castingTime:'1 action',       range:'120 feet',  components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Fire',     damageDice:'1d10', classes:'Sorcerer, Wizard',                   description:'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage.' },
  { name:'Sacred Flame',      level:0, school:'Evocation',    castingTime:'1 action',       range:'60 feet',   components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Radiant',  damageDice:'1d8',  saveAbility:'DEX', classes:'Cleric',                              description:'Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage.' },
  { name:'Eldritch Blast',    level:0, school:'Evocation',    castingTime:'1 action',       range:'120 feet',  components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Force',    damageDice:'1d10', classes:'Warlock',                             description:'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage.' },
  { name:'Toll the Dead',     level:0, school:'Necromancy',   castingTime:'1 action',       range:'60 feet',   components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Necrotic', damageDice:'1d8',  saveAbility:'WIS', classes:'Cleric, Warlock, Wizard',             description:'You point at one creature you can see within range, and the sound of a dolorous bell fills the air. The target must succeed on a Wisdom saving throw or take 1d8 necrotic damage.' },
  { name:'Prestidigitation',  level:0, school:'Transmutation',castingTime:'1 action',       range:'10 feet',   components:'V, S',    duration:'Up to 1 hour',                concentration:false,                                    classes:'Bard, Sorcerer, Warlock, Wizard',     description:'This spell is a minor magical trick. You create one of several minor magical effects: a small sensory effect, a small mark, lighting or snuffing a candle, chilling a small amount of liquid, or creating a small trinket.' },
  { name:'Guidance',          level:0, school:'Divination',   castingTime:'1 action',       range:'Touch',     components:'V, S',    duration:'Concentration, up to 1 minute',concentration:true,                                     classes:'Cleric, Druid',                       description:'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.' },
  { name:'Shillelagh',        level:0, school:'Transmutation',castingTime:'1 bonus action', range:'Self',      components:'V, S, M', duration:'Concentration, up to 1 minute',concentration:true,  damageType:'Bludgeoning',damageDice:'1d8',  classes:'Druid',                               description:'The wood of a club or quarterstaff you are holding is imbued with nature\'s power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls using that weapon.' },
  { name:'Minor Illusion',    level:0, school:'Illusion',     castingTime:'1 action',       range:'30 feet',   components:'S, M',    duration:'1 minute',                    concentration:false,                                    classes:'Bard, Sorcerer, Warlock, Wizard',     description:'You create a sound or an image of an object within range that lasts for the duration. The illusion ends if you dismiss it as an action or cast this spell again.' },
  { name:'Mage Hand',         level:0, school:'Conjuration',  castingTime:'1 action',       range:'30 feet',   components:'V, S',    duration:'1 minute',                    concentration:false,                                    classes:'Bard, Sorcerer, Warlock, Wizard',     description:'A spectral, floating hand appears at a point you choose within range. The hand can manipulate an object, open an unlocked door or container, or stow or retrieve an item from an open container.' },
  { name:'Vicious Mockery',   level:0, school:'Enchantment',  castingTime:'1 action',       range:'60 feet',   components:'V',       duration:'Instantaneous',               concentration:false, damageType:'Psychic',  damageDice:'1d4',  saveAbility:'WIS', classes:'Bard',                                description:'You unleash a string of insults laced with subtle enchantments at a creature you can see within range. If the target can hear you, it must succeed on a Wisdom saving throw or take 1d4 psychic damage and have disadvantage on the next attack roll it makes before the end of its next turn.' },

  // ── Level 1 ───────────────────────────────────────────────────────────────
  { name:'Healing Word',      level:1, school:'Evocation',    castingTime:'1 bonus action', range:'60 feet',   components:'V',       duration:'Instantaneous',               concentration:false, healDice:'1d4',                            classes:'Bard, Cleric, Druid',                 description:'A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier.' },
  { name:'Cure Wounds',       level:1, school:'Evocation',    castingTime:'1 action',       range:'Touch',     components:'V, S',    duration:'Instantaneous',               concentration:false, healDice:'1d8',                            classes:'Bard, Cleric, Druid, Paladin, Ranger',description:'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.' },
  { name:'Magic Missile',     level:1, school:'Evocation',    castingTime:'1 action',       range:'120 feet',  components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Force',    damageDice:'1d4+1',                       classes:'Sorcerer, Wizard',                    description:'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target.' },
  { name:'Shield',            level:1, school:'Abjuration',   castingTime:'1 reaction',     range:'Self',      components:'V, S',    duration:'1 round',                     concentration:false,                                    classes:'Sorcerer, Wizard',                    description:'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from Magic Missile.' },
  { name:'Hex',               level:1, school:'Enchantment',  castingTime:'1 bonus action', range:'90 feet',   components:'V, S, M', duration:'Concentration, up to 1 hour', concentration:true,  damageType:'Necrotic', damageDice:'1d6',                         classes:'Warlock',                             description:'You place a curse on a creature that you can see within range. Until the spell ends, you deal an extra 1d6 necrotic damage to the target whenever you hit it with an attack.' },
  { name:"Hunter's Mark",     level:1, school:'Divination',   castingTime:'1 bonus action', range:'90 feet',   components:'V',       duration:'Concentration, up to 1 hour', concentration:true,  damageDice:'1d6',                                                classes:'Ranger',                              description:'You choose a creature you can see within range and mystically mark it as your quarry. Until the spell ends, you deal an extra 1d6 damage to the target whenever you hit it with a weapon attack.' },
  { name:'Bless',             level:1, school:'Enchantment',  castingTime:'1 action',       range:'30 feet',   components:'V, S, M', duration:'Concentration, up to 1 minute',concentration:true,                                     classes:'Cleric, Paladin',                     description:'You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.' },
  { name:'Thunderwave',       level:1, school:'Evocation',    castingTime:'1 action',       range:'Self',      components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Thunder',  damageDice:'2d8',  saveAbility:'CON', halfOnSave:true, classes:'Bard, Druid, Sorcerer, Wizard',        description:'A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw. On a failed save, a creature takes 2d8 thunder damage and is pushed 10 feet away from you.' },
  { name:'Chromatic Orb',     level:1, school:'Evocation',    castingTime:'1 action',       range:'90 feet',   components:'V, S, M', duration:'Instantaneous',               concentration:false, damageType:'Fire',     damageDice:'3d8',                         classes:'Sorcerer, Wizard',                    description:'You hurl a 4-inch diameter sphere of energy at a creature that you can see within range. You choose acid, cold, fire, lightning, poison, or thunder for the type of orb you create, and the orb deals 3d8 damage of that type on a hit.' },
  { name:'Wrathful Smite',    level:1, school:'Evocation',    castingTime:'1 bonus action', range:'Self',      components:'V',       duration:'Concentration, up to 1 minute',concentration:true,  damageType:'Psychic',  damageDice:'1d6',                         classes:'Paladin',                             description:'The next time you hit with a melee weapon attack during this spell\'s duration, your attack deals an extra 1d6 psychic damage. Additionally, if the target is a creature, it must make a Wisdom saving throw or be frightened of you until the spell ends.' },

  // ── Level 2 ───────────────────────────────────────────────────────────────
  { name:'Misty Step',        level:2, school:'Conjuration',  castingTime:'1 bonus action', range:'Self',      components:'V',       duration:'Instantaneous',               concentration:false,                                    classes:'Sorcerer, Warlock, Wizard',           description:'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.' },
  { name:'Hold Person',       level:2, school:'Enchantment',  castingTime:'1 action',       range:'60 feet',   components:'V, S, M', duration:'Concentration, up to 1 minute',concentration:true,                                     classes:'Bard, Cleric, Druid, Sorcerer, Warlock, Wizard', description:'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.' },
  { name:'Invisibility',      level:2, school:'Illusion',     castingTime:'1 action',       range:'Touch',     components:'V, S, M', duration:'Concentration, up to 1 hour', concentration:true,                                     classes:'Bard, Sorcerer, Warlock, Wizard',     description:'A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person.' },
  { name:'Shatter',           level:2, school:'Evocation',    castingTime:'1 action',       range:'60 feet',   components:'V, S, M', duration:'Instantaneous',               concentration:false, damageType:'Thunder',  damageDice:'3d8',  saveAbility:'CON', halfOnSave:true, classes:'Bard, Sorcerer, Warlock, Wizard',      description:'A sudden loud ringing noise, painfully intense, erupts from a point of your choice within range. Each creature in a 10-foot-radius sphere centered on that point must make a Constitution saving throw.' },
  { name:'Spiritual Weapon',  level:2, school:'Evocation',    castingTime:'1 bonus action', range:'60 feet',   components:'V, S',    duration:'1 minute',                    concentration:false, damageType:'Force',    damageDice:'1d8',                         classes:'Cleric',                              description:'You create a floating, spectral weapon within range that lasts for the duration or until you cast this spell again. As a bonus action on your turn, you can move the weapon up to 20 feet and repeat the attack against a creature within 5 feet of it.' },
  { name:'Aid',               level:2, school:'Abjuration',   castingTime:'1 action',       range:'30 feet',   components:'V, S, M', duration:'8 hours',                     concentration:false,                                    classes:'Cleric, Paladin',                     description:'Your spell bolsters your allies with toughness and resolve. Choose up to three creatures within range. Each target\'s hit point maximum and current hit points increase by 5 for the duration.' },
  { name:'Pass Without Trace',level:2, school:'Abjuration',   castingTime:'1 action',       range:'Self',      components:'V, S, M', duration:'Concentration, up to 1 hour', concentration:true,                                     classes:'Druid, Ranger',                       description:'A veil of shadows and silence radiates from you, masking you and your companions from detection. For the duration, each creature you choose within 30 feet of you has a +10 bonus to Dexterity (Stealth) checks.' },
  { name:"Scorching Ray",     level:2, school:'Evocation',    castingTime:'1 action',       range:'120 feet',  components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Fire',     damageDice:'2d6',                         classes:'Sorcerer, Wizard',                    description:'You create three rays of fire and hurl them at targets within range. You can hurl them at one target or several. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 fire damage.' },

  // ── Level 3 ───────────────────────────────────────────────────────────────
  { name:'Fireball',          level:3, school:'Evocation',    castingTime:'1 action',       range:'150 feet',  components:'V, S, M', duration:'Instantaneous',               concentration:false, damageType:'Fire',     damageDice:'8d6',  saveAbility:'DEX', halfOnSave:true, classes:'Sorcerer, Wizard',                     description:'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw.' },
  { name:'Counterspell',      level:3, school:'Abjuration',   castingTime:'1 reaction',     range:'60 feet',   components:'S',       duration:'Instantaneous',               concentration:false,                                    classes:'Sorcerer, Warlock, Wizard',           description:'You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect. If it is casting a spell of 4th level or higher, make an ability check using your spellcasting ability.' },
  { name:'Spirit Guardians',  level:3, school:'Conjuration',  castingTime:'1 action',       range:'Self',      components:'V, S, M', duration:'Concentration, up to 10 minutes', concentration:true, damageType:'Radiant',  damageDice:'3d8',  saveAbility:'WIS', halfOnSave:true, classes:'Cleric',                              description:'You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration. If you are good or neutral, their spectral form appears angelic or fey. If you are evil, they appear fiendish. When a creature enters the area for the first time on a turn or starts its turn there, it must succeed on a Wisdom saving throw or take 3d8 radiant or necrotic damage.' },
  { name:'Hypnotic Pattern',  level:3, school:'Illusion',     castingTime:'1 action',       range:'120 feet',  components:'S, M',    duration:'Concentration, up to 1 minute',concentration:true,                                     classes:'Bard, Sorcerer, Warlock, Wizard',     description:'You create a twisting pattern of colors that weaves through the air inside a 30-foot cube within range. The pattern appears for a moment and vanishes. Each creature in the area who sees the pattern must make a Wisdom saving throw. On a failed save, the creature becomes charmed for the duration.' },
  { name:'Lightning Bolt',    level:3, school:'Evocation',    castingTime:'1 action',       range:'Self',      components:'V, S, M', duration:'Instantaneous',               concentration:false, damageType:'Lightning', damageDice:'8d6',  saveAbility:'DEX', halfOnSave:true, classes:'Sorcerer, Wizard',                     description:'A stroke of lightning forming a line of 100 feet long and 5 feet wide blasts out from you in a direction you choose. Each creature in the line must make a Dexterity saving throw. A creature takes 8d6 lightning damage on a failed save, or half as much on a successful one.' },
  { name:"Speak with Dead",   level:3, school:'Necromancy',   castingTime:'1 action',       range:'10 feet',   components:'V, S, M', duration:'10 minutes',                  concentration:false,                                    classes:'Bard, Cleric, Wizard',                description:'You grant the semblance of life and intelligence to a corpse of your choice within range, allowing it to answer the questions you pose. The corpse can give you information about events it experienced in life.' },

  // ── Level 4 ───────────────────────────────────────────────────────────────
  { name:'Banishment',        level:4, school:'Abjuration',   castingTime:'1 action',       range:'60 feet',   components:'V, S, M', duration:'Concentration, up to 1 minute',concentration:true,                                     saveAbility:'CHA', classes:'Cleric, Paladin, Sorcerer, Warlock, Wizard', description:'You attempt to send one creature that you can see within range to another plane of existence. The target must succeed on a Charisma saving throw or be banished.' },
  { name:'Polymorph',         level:4, school:'Transmutation',castingTime:'1 action',       range:'60 feet',   components:'V, S, M', duration:'Concentration, up to 1 hour', concentration:true,                                     saveAbility:'WIS', classes:'Bard, Cleric, Druid, Sorcerer, Wizard',       description:'This spell transforms a creature that you can see within range into a new form. An unwilling creature must make a Wisdom saving throw to avoid the effect.' },
  { name:'Dimension Door',    level:4, school:'Conjuration',  castingTime:'1 action',       range:'500 feet',  components:'V',       duration:'Instantaneous',               concentration:false,                                    classes:'Bard, Sorcerer, Warlock, Wizard',     description:'You teleport yourself from your current location to any other spot within range. You arrive at exactly the spot desired.' },

  // ── Level 5 ───────────────────────────────────────────────────────────────
  { name:'Cone of Cold',      level:5, school:'Evocation',    castingTime:'1 action',       range:'Self',      components:'V, S, M', duration:'Instantaneous',               concentration:false, damageType:'Cold',     damageDice:'8d8',  saveAbility:'CON', halfOnSave:true, classes:'Sorcerer, Wizard',                     description:'A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a Constitution saving throw. A creature takes 8d8 cold damage on a failed save, or half as much on a successful one.' },
  { name:'Mass Cure Wounds',  level:5, school:'Evocation',    castingTime:'1 action',       range:'60 feet',   components:'V, S',    duration:'Instantaneous',               concentration:false, healDice:'3d8',                            classes:'Bard, Cleric, Druid',                 description:'A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point. Each target regains hit points equal to 3d8 + your spellcasting ability modifier.' },
  { name:'Hold Monster',      level:5, school:'Enchantment',  castingTime:'1 action',       range:'90 feet',   components:'V, S, M', duration:'Concentration, up to 1 minute',concentration:true,                                     saveAbility:'WIS', classes:'Bard, Sorcerer, Warlock, Wizard',       description:'Choose a creature that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.' },

  // ── Level 6 ───────────────────────────────────────────────────────────────
  { name:'Disintegrate',      level:6, school:'Transmutation',castingTime:'1 action',       range:'60 feet',   components:'V, S, M', duration:'Instantaneous',               concentration:false, damageType:'Force',    damageDice:'10d6+40',saveAbility:'DEX', classes:'Sorcerer, Wizard',                    description:'A thin green ray springs from your pointing finger to a target that you can see within range. The target can be a creature, an object, or a creation of magical force. A creature targeted by this spell must make a Dexterity saving throw. On a failed save, the target takes 10d6 + 40 force damage.' },
  { name:'Heal',              level:6, school:'Evocation',    castingTime:'1 action',       range:'60 feet',   components:'V, S',    duration:'Instantaneous',               concentration:false, healDice:'70',                             classes:'Cleric, Druid',                       description:'Choose a creature that you can see within range. A surge of positive energy washes through the creature, causing it to regain 70 hit points. This spell also ends blindness, deafness, and any diseases affecting the target.' },

  // ── Level 7 ───────────────────────────────────────────────────────────────
  { name:'Finger of Death',   level:7, school:'Necromancy',   castingTime:'1 action',       range:'60 feet',   components:'V, S',    duration:'Instantaneous',               concentration:false, damageType:'Necrotic', damageDice:'7d8+30',saveAbility:'CON', classes:'Sorcerer, Warlock, Wizard',            description:'You send negative energy coursing through a creature that you can see within range, causing it searing pain. The target must make a Constitution saving throw. It takes 7d8 + 30 necrotic damage on a failed save, or half as much on a successful one.' },

  // ── Level 8 ───────────────────────────────────────────────────────────────
  { name:'Maze',              level:8, school:'Conjuration',  castingTime:'1 action',       range:'60 feet',   components:'V, S',    duration:'Concentration, up to 10 minutes', concentration:true,                                  classes:'Wizard',                              description:'You banish a creature that you can see within range into a labyrinthine demiplane. The target remains there for the duration or until it escapes the maze.' },

  // ── Level 9 ───────────────────────────────────────────────────────────────
  { name:'Wish',              level:9, school:'Conjuration',  castingTime:'1 action',       range:'Self',      components:'V',       duration:'Instantaneous',               concentration:false,                                    classes:'Sorcerer, Wizard',                    description:'Wish is the mightiest spell a mortal creature can cast. By simply speaking aloud, you can alter the very foundations of reality in accord with your desires. The basic use of this spell is to duplicate any other spell of 8th level or lower.' },
  { name:'True Resurrection',  level:9, school:'Necromancy',  castingTime:'1 hour',         range:'Touch',     components:'V, S, M', duration:'Instantaneous',               concentration:false, healDice:'All HP',                         classes:'Cleric, Druid',                       description:'You touch a creature that has been dead for no longer than 200 years and that died for any reason except old age. If the creature\'s soul is free and willing, the creature is restored to life with all its hit points.' },
];

// ── main ──────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dnd5e-tracker');
  console.log('Connected to MongoDB\n');

  // ── Monsters ──────────────────────────────────────────────────────────────
  console.log('Seeding monsters…');
  let monsters;

  // Try dnd5eapi.co first
  try {
    const raw = await fetchDnd5eMonsters();
    monsters  = raw.map(mapDnd5eMonster);
    console.log(`  Mapped ${monsters.length} monsters from dnd5eapi.co`);
  } catch (err) {
    console.warn(`  dnd5eapi.co unavailable (${err.message}), trying open5e…`);

    // Fallback: open5e — no limit, fetches all pages
    try {
      const raw = await fetchOpen5eAll(
        'https://api.open5e.com/v1/monsters/?limit=100&document__slug=wotc-srd&ordering=challenge_rating'
      );
      monsters = raw.map(mapOpen5eMonster);
      console.log(`  Mapped ${monsters.length} monsters from open5e`);
    } catch (err2) {
      console.warn(`  open5e also unavailable (${err2.message}), using ${FALLBACK_MONSTERS.length} built-in monsters`);
      monsters = FALLBACK_MONSTERS;
    }
  }

  await Monster.deleteMany({});
  const insertedMonsters = await Monster.insertMany(monsters, { ordered: false });
  console.log(`  Inserted ${insertedMonsters.length} monsters\n`);

  // ── Spells ────────────────────────────────────────────────────────────────
  console.log('Seeding spells…');
  let spells;
  try {
    const raw = await fetchDnd5eSpells();
    spells    = raw.map(mapDnd5eSpell);
    console.log(`  Mapped ${spells.length} spells from dnd5eapi.co`);
  } catch (err) {
    console.warn(`  dnd5eapi.co spells unavailable (${err.message}), trying open5e…`);
    try {
      const raw = await fetchOpen5eAll('https://api.open5e.com/v1/spells/?limit=100&document__slug=wotc-srd');
      spells    = raw.map(mapOpen5eSpell);
      console.log(`  Mapped ${spells.length} spells from open5e`);
    } catch (err2) {
      console.warn(`  open5e also unavailable (${err2.message}), using ${HARDCODED_SPELLS.length} built-in spells`);
      spells = HARDCODED_SPELLS;
    }
  }
  await Spell.deleteMany({});
  const insertedSpells = await Spell.insertMany(spells, { ordered: false });
  console.log(`  Inserted ${insertedSpells.length} spells\n`);

  // ── Abilities & Traits ────────────────────────────────────────────────────
  console.log('Seeding abilities & traits…');
  let abilities;
  try {
    console.log('  Fetching class features…');
    const rawFeatures = await fetchDnd5eFeatures();
    console.log('  Fetching racial traits…');
    const rawTraits   = await fetchDnd5eTraits();
    abilities = [
      ...rawFeatures.map(mapDnd5eFeature),
      ...rawTraits.map(mapDnd5eTrait),
    ];
    console.log(`  Mapped ${abilities.length} abilities/traits from dnd5eapi.co`);
  } catch (err) {
    console.warn(`  dnd5eapi.co abilities unavailable (${err.message}), using ${HARDCODED_ABILITIES.length} built-in abilities`);
    abilities = HARDCODED_ABILITIES;
  }
  await Ability.deleteMany({});
  const insertedAbilities = await Ability.insertMany(abilities, { ordered: false });
  console.log(`  Inserted ${insertedAbilities.length} abilities/traits\n`);

  console.log('Seed complete.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
