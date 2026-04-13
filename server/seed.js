/**
 * Seed script — populates Monster and Spell collections.
 *
 * Monster source priority:
 *   1. https://www.dnd5eapi.co/api  (official D&D 5e SRD API, ~330 monsters)
 *   2. https://api.open5e.com       (fallback, same SRD data, paginated)
 *   3. Embedded minimal fallback    (offline / both APIs down)
 *
 * Spell source: open5e SRD (fallback to embedded list)
 *
 * Usage: npm run seed
 * Requires Node 18+ (native fetch).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Monster  = require('./models/Monster');
const Spell    = require('./models/Spell');

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
    classes:     (s.classes || []).map(c => (typeof c === 'string' ? c : c.name)).join(', '),
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
  { name:'Fire Bolt',    level:0, school:'Evocation',    castingTime:'1 action',       range:'120 feet', components:'V, S',     duration:'Instantaneous',             concentration:false, damageType:'Fire',     damageDice:'1d10', classes:'Sorcerer, Wizard' },
  { name:'Healing Word', level:1, school:'Evocation',    castingTime:'1 bonus action', range:'60 feet',  components:'V',         duration:'Instantaneous',             concentration:false, healDice:'1d4',        classes:'Bard, Cleric, Druid' },
  { name:'Cure Wounds',  level:1, school:'Evocation',    castingTime:'1 action',       range:'Touch',    components:'V, S',     duration:'Instantaneous',             concentration:false, healDice:'1d8',        classes:'Bard, Cleric, Druid, Paladin, Ranger' },
  { name:'Magic Missile',level:1, school:'Evocation',    castingTime:'1 action',       range:'120 feet', components:'V, S',     duration:'Instantaneous',             concentration:false, damageType:'Force',    damageDice:'1d4+1', classes:'Sorcerer, Wizard' },
  { name:'Shield',       level:1, school:'Abjuration',   castingTime:'1 reaction',     range:'Self',     components:'V, S',     duration:'1 round',                   concentration:false, classes:'Sorcerer, Wizard' },
  { name:'Fireball',     level:3, school:'Evocation',    castingTime:'1 action',       range:'150 feet', components:'V, S, M',  duration:'Instantaneous',             concentration:false, damageType:'Fire',     damageDice:'8d6',  saveAbility:'DEX', halfOnSave:true, classes:'Sorcerer, Wizard' },
  { name:'Counterspell', level:3, school:'Abjuration',   castingTime:'1 reaction',     range:'60 feet',  components:'S',         duration:'Instantaneous',             concentration:false, classes:'Sorcerer, Warlock, Wizard' },
  { name:'Misty Step',   level:2, school:'Conjuration',  castingTime:'1 bonus action', range:'Self',     components:'V',         duration:'Instantaneous',             concentration:false, classes:'Sorcerer, Warlock, Wizard' },
  { name:'Hex',          level:1, school:'Enchantment',  castingTime:'1 bonus action', range:'90 feet',  components:'V, S, M',  duration:'Concentration, up to 1 hour', concentration:true, damageType:'Necrotic', damageDice:'1d6', classes:'Warlock' },
  { name:'Hunter\'s Mark',level:1,school:'Divination',   castingTime:'1 bonus action', range:'90 feet',  components:'V',         duration:'Concentration, up to 1 hour', concentration:true, damageDice:'1d6',      classes:'Ranger' },
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
    const raw = await fetchOpen5eAll(
      'https://api.open5e.com/v1/spells/?limit=100&document__slug=wotc-srd&ordering=level_int'
    );
    spells = raw.map(mapOpen5eSpell);
    console.log(`  Mapped ${spells.length} spells from open5e`);
  } catch (err) {
    console.warn(`  open5e unavailable (${err.message}), using ${FALLBACK_SPELLS.length} built-in spells`);
    spells = FALLBACK_SPELLS;
  }

  await Spell.deleteMany({});
  const insertedSpells = await Spell.insertMany(spells, { ordered: false });
  console.log(`  Inserted ${insertedSpells.length} spells\n`);

  console.log('Seed complete.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
