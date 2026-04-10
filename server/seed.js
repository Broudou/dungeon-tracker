/**
 * Seed script — populates Monster and Spell collections from the open5e SRD API.
 * Requires Node 18+ (native fetch). Falls back to embedded minimal data if the
 * API is unreachable.
 *
 * Usage: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Monster = require('./models/Monster');
const Spell = require('./models/Spell');

// ── open5e fetcher ────────────────────────────────────────────────────────────

async function fetchAll(url, collected = []) {
  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const data = await res.json();
  collected.push(...(data.results || []));
  if (data.next) return fetchAll(data.next, collected);
  return collected;
}

// ── open5e → our schema mappers ───────────────────────────────────────────────

function mapAction(a) {
  return {
    name: a.name || '',
    description: a.desc || '',
    attackBonus: a.attack_bonus ?? null,
    damageDice: a.damage?.[0]?.damage_dice || null,
    damageType: a.damage?.[0]?.damage_type?.name || null,
    saveDC: a.dc?.dc_value ?? null,
    saveAbility: a.dc?.dc_type?.name || null,
  };
}

function mapMonster(m) {
  return {
    name: m.name,
    cr: String(m.challenge_rating ?? ''),
    type: m.type || '',
    size: m.size || '',
    alignment: m.alignment || '',
    stats: {
      STR: m.strength, DEX: m.dexterity, CON: m.constitution,
      INT: m.intelligence, WIS: m.wisdom, CHA: m.charisma,
    },
    hp: {
      average: m.hit_points,
      diceExpression: m.hit_dice || '',
    },
    AC: m.armor_class,
    speed: typeof m.speed === 'object'
      ? Object.entries(m.speed).map(([k, v]) => `${k} ${v}`).join(', ')
      : String(m.speed || ''),
    savingThrows: m.strength_save != null ? {
      STR: m.strength_save, DEX: m.dexterity_save,
      CON: m.constitution_save, INT: m.intelligence_save,
      WIS: m.wisdom_save, CHA: m.charisma_save,
    } : {},
    senses: m.senses || '',
    languages: m.languages || '',
    resistances: (m.damage_resistances || '').split(',').map(s => s.trim()).filter(Boolean),
    immunities: (m.damage_immunities || '').split(',').map(s => s.trim()).filter(Boolean),
    vulnerabilities: (m.damage_vulnerabilities || '').split(',').map(s => s.trim()).filter(Boolean),
    actions: (m.actions || []).map(mapAction),
    reactions: (m.reactions || []).map(mapAction),
    traits: (m.special_abilities || []).map(mapAction),
    legendaryActions: (m.legendary_actions || []).map(mapAction),
  };
}

function mapSpell(s) {
  return {
    name: s.name,
    level: s.level_int ?? s.level ?? 0,
    school: s.school || '',
    castingTime: s.casting_time || '',
    range: s.range || '',
    components: s.components || '',
    duration: s.duration || '',
    concentration: s.concentration?.toLowerCase() === 'yes' || s.concentration === true,
    damageType: s.damage?.damage_type?.name || null,
    damageDice: s.damage?.damage_at_slot_level
      ? Object.values(s.damage.damage_at_slot_level)[0]
      : null,
    saveAbility: s.dc?.dc_type?.name || null,
    halfOnSave: s.dc?.dc_success?.toLowerCase() === 'half' || false,
    healDice: s.heal_at_slot_level
      ? Object.values(s.heal_at_slot_level)[0]
      : null,
    description: s.desc || '',
    classes: (s.classes || []).map(c => (typeof c === 'string' ? c : c.name)).join(', '),
  };
}

// ── embedded fallback data (used if open5e is unreachable) ───────────────────

const FALLBACK_MONSTERS = [
  { name: 'Goblin', cr: '1/4', type: 'Humanoid', size: 'Small', alignment: 'neutral evil', stats: { STR: 8, DEX: 14, CON: 10, INT: 10, WIS: 8, CHA: 8 }, hp: { average: 7, diceExpression: '2d6' }, AC: 15, speed: '30 ft.' },
  { name: 'Kobold', cr: '1/8', type: 'Humanoid', size: 'Small', alignment: 'lawful evil', stats: { STR: 7, DEX: 15, CON: 9, INT: 8, WIS: 7, CHA: 8 }, hp: { average: 5, diceExpression: '2d6-2' }, AC: 12, speed: '30 ft.' },
  { name: 'Skeleton', cr: '1/4', type: 'Undead', size: 'Medium', alignment: 'lawful evil', stats: { STR: 10, DEX: 14, CON: 15, INT: 6, WIS: 8, CHA: 5 }, hp: { average: 13, diceExpression: '2d8+4' }, AC: 13, speed: '30 ft.' },
  { name: 'Zombie', cr: '1/4', type: 'Undead', size: 'Medium', alignment: 'neutral evil', stats: { STR: 13, DEX: 6, CON: 16, INT: 3, WIS: 6, CHA: 5 }, hp: { average: 22, diceExpression: '3d8+9' }, AC: 8, speed: '20 ft.' },
  { name: 'Wolf', cr: '1/4', type: 'Beast', size: 'Medium', alignment: 'unaligned', stats: { STR: 12, DEX: 15, CON: 12, INT: 3, WIS: 12, CHA: 6 }, hp: { average: 11, diceExpression: '2d8+2' }, AC: 13, speed: '40 ft.' },
  { name: 'Giant Spider', cr: '1', type: 'Beast', size: 'Large', alignment: 'unaligned', stats: { STR: 14, DEX: 16, CON: 12, INT: 2, WIS: 11, CHA: 4 }, hp: { average: 26, diceExpression: '4d10+4' }, AC: 14, speed: '30 ft., climb 30 ft.' },
  { name: 'Orc', cr: '1/2', type: 'Humanoid', size: 'Medium', alignment: 'chaotic evil', stats: { STR: 16, DEX: 12, CON: 16, INT: 7, WIS: 11, CHA: 10 }, hp: { average: 15, diceExpression: '2d8+6' }, AC: 13, speed: '30 ft.' },
  { name: 'Hobgoblin', cr: '1/2', type: 'Humanoid', size: 'Medium', alignment: 'lawful evil', stats: { STR: 13, DEX: 12, CON: 12, INT: 10, WIS: 10, CHA: 9 }, hp: { average: 11, diceExpression: '2d8+2' }, AC: 18, speed: '30 ft.' },
  { name: 'Bugbear', cr: '1', type: 'Humanoid', size: 'Medium', alignment: 'chaotic evil', stats: { STR: 15, DEX: 14, CON: 13, INT: 8, WIS: 11, CHA: 9 }, hp: { average: 27, diceExpression: '5d8+5' }, AC: 16, speed: '30 ft.' },
  { name: 'Gnoll', cr: '1/2', type: 'Humanoid', size: 'Medium', alignment: 'chaotic evil', stats: { STR: 14, DEX: 12, CON: 11, INT: 6, WIS: 10, CHA: 7 }, hp: { average: 22, diceExpression: '5d8' }, AC: 15, speed: '30 ft.' },
  { name: 'Troll', cr: '5', type: 'Giant', size: 'Large', alignment: 'chaotic evil', stats: { STR: 18, DEX: 13, CON: 20, INT: 7, WIS: 9, CHA: 7 }, hp: { average: 84, diceExpression: '8d10+40' }, AC: 15, speed: '30 ft.' },
  { name: 'Ogre', cr: '2', type: 'Giant', size: 'Large', alignment: 'chaotic evil', stats: { STR: 19, DEX: 8, CON: 16, INT: 5, WIS: 7, CHA: 7 }, hp: { average: 59, diceExpression: '7d10+21' }, AC: 11, speed: '40 ft.' },
  { name: 'Hill Giant', cr: '5', type: 'Giant', size: 'Huge', alignment: 'chaotic evil', stats: { STR: 21, DEX: 8, CON: 19, INT: 5, WIS: 9, CHA: 6 }, hp: { average: 105, diceExpression: '10d12+40' }, AC: 13, speed: '40 ft.' },
  { name: 'Wyvern', cr: '6', type: 'Dragon', size: 'Large', alignment: 'unaligned', stats: { STR: 19, DEX: 10, CON: 16, INT: 5, WIS: 12, CHA: 6 }, hp: { average: 110, diceExpression: '13d10+39' }, AC: 13, speed: '20 ft., fly 80 ft.' },
  { name: 'Young Dragon (Red)', cr: '10', type: 'Dragon', size: 'Large', alignment: 'chaotic evil', stats: { STR: 23, DEX: 10, CON: 21, INT: 14, WIS: 11, CHA: 19 }, hp: { average: 178, diceExpression: '17d10+85' }, AC: 18, speed: '40 ft., climb 40 ft., fly 80 ft.' },
  { name: 'Adult Red Dragon', cr: '17', type: 'Dragon', size: 'Huge', alignment: 'chaotic evil', stats: { STR: 27, DEX: 10, CON: 25, INT: 16, WIS: 13, CHA: 21 }, hp: { average: 256, diceExpression: '19d12+133' }, AC: 19, speed: '40 ft., climb 40 ft., fly 80 ft.' },
  { name: 'Vampire', cr: '13', type: 'Undead', size: 'Medium', alignment: 'lawful evil', stats: { STR: 18, DEX: 18, CON: 18, INT: 17, WIS: 15, CHA: 18 }, hp: { average: 144, diceExpression: '17d8+68' }, AC: 16, speed: '30 ft.' },
  { name: 'Lich', cr: '21', type: 'Undead', size: 'Medium', alignment: 'neutral evil', stats: { STR: 11, DEX: 16, CON: 16, INT: 20, WIS: 14, CHA: 16 }, hp: { average: 135, diceExpression: '18d8+54' }, AC: 17, speed: '30 ft.' },
  { name: 'Beholder', cr: '13', type: 'Aberration', size: 'Large', alignment: 'lawful evil', stats: { STR: 10, DEX: 14, CON: 18, INT: 17, WIS: 15, CHA: 17 }, hp: { average: 180, diceExpression: '19d10+76' }, AC: 18, speed: '0 ft., fly 20 ft. (hover)' },
  { name: 'Mind Flayer', cr: '7', type: 'Aberration', size: 'Medium', alignment: 'lawful evil', stats: { STR: 11, DEX: 12, CON: 12, INT: 19, WIS: 17, CHA: 17 }, hp: { average: 71, diceExpression: '13d8+13' }, AC: 15, speed: '30 ft.' },
  { name: 'Aboleth', cr: '10', type: 'Aberration', size: 'Large', alignment: 'lawful evil', stats: { STR: 21, DEX: 9, CON: 15, INT: 18, WIS: 15, CHA: 18 }, hp: { average: 135, diceExpression: '18d10+36' }, AC: 17, speed: '10 ft., swim 40 ft.' },
  { name: 'Gelatinous Cube', cr: '2', type: 'Ooze', size: 'Large', alignment: 'unaligned', stats: { STR: 14, DEX: 3, CON: 20, INT: 1, WIS: 6, CHA: 1 }, hp: { average: 84, diceExpression: '8d10+40' }, AC: 6, speed: '15 ft.' },
  { name: 'Rust Monster', cr: '1/2', type: 'Monstrosity', size: 'Medium', alignment: 'unaligned', stats: { STR: 13, DEX: 12, CON: 13, INT: 2, WIS: 13, CHA: 6 }, hp: { average: 27, diceExpression: '5d8+5' }, AC: 14, speed: '40 ft.' },
  { name: 'Owlbear', cr: '3', type: 'Monstrosity', size: 'Large', alignment: 'unaligned', stats: { STR: 20, DEX: 12, CON: 17, INT: 3, WIS: 12, CHA: 7 }, hp: { average: 59, diceExpression: '7d10+21' }, AC: 13, speed: '40 ft.' },
  { name: 'Minotaur', cr: '3', type: 'Monstrosity', size: 'Large', alignment: 'chaotic evil', stats: { STR: 18, DEX: 11, CON: 16, INT: 6, WIS: 16, CHA: 9 }, hp: { average: 76, diceExpression: '9d10+27' }, AC: 14, speed: '40 ft.' },
  { name: 'Basilisk', cr: '3', type: 'Monstrosity', size: 'Medium', alignment: 'unaligned', stats: { STR: 16, DEX: 8, CON: 15, INT: 2, WIS: 8, CHA: 7 }, hp: { average: 52, diceExpression: '8d8+16' }, AC: 15, speed: '20 ft.' },
  { name: 'Medusa', cr: '6', type: 'Monstrosity', size: 'Medium', alignment: 'lawful evil', stats: { STR: 10, DEX: 15, CON: 16, INT: 12, WIS: 13, CHA: 15 }, hp: { average: 127, diceExpression: '17d8+51' }, AC: 15, speed: '30 ft.' },
  { name: 'Harpy', cr: '1', type: 'Monstrosity', size: 'Medium', alignment: 'chaotic evil', stats: { STR: 12, DEX: 13, CON: 12, INT: 7, WIS: 10, CHA: 13 }, hp: { average: 38, diceExpression: '7d8+7' }, AC: 11, speed: '20 ft., fly 40 ft.' },
  { name: 'Griffon', cr: '2', type: 'Monstrosity', size: 'Large', alignment: 'unaligned', stats: { STR: 18, DEX: 15, CON: 16, INT: 2, WIS: 13, CHA: 8 }, hp: { average: 59, diceExpression: '7d10+21' }, AC: 12, speed: '30 ft., fly 80 ft.' },
  { name: 'Manticore', cr: '3', type: 'Monstrosity', size: 'Large', alignment: 'lawful evil', stats: { STR: 17, DEX: 16, CON: 17, INT: 7, WIS: 12, CHA: 8 }, hp: { average: 68, diceExpression: '8d10+24' }, AC: 14, speed: '30 ft., fly 50 ft.' },
  { name: 'Werewolf', cr: '3', type: 'Humanoid', size: 'Medium', alignment: 'chaotic evil', stats: { STR: 15, DEX: 13, CON: 14, INT: 10, WIS: 11, CHA: 10 }, hp: { average: 58, diceExpression: '9d8+18' }, AC: 11, speed: '30 ft.' },
  { name: 'Ghost', cr: '4', type: 'Undead', size: 'Medium', alignment: 'any', stats: { STR: 7, DEX: 13, CON: 10, INT: 10, WIS: 12, CHA: 17 }, hp: { average: 45, diceExpression: '10d8' }, AC: 11, speed: '0 ft., fly 40 ft. (hover)' },
  { name: 'Wight', cr: '3', type: 'Undead', size: 'Medium', alignment: 'neutral evil', stats: { STR: 15, DEX: 14, CON: 16, INT: 10, WIS: 13, CHA: 15 }, hp: { average: 45, diceExpression: '6d8+18' }, AC: 14, speed: '30 ft.' },
  { name: 'Banshee', cr: '4', type: 'Undead', size: 'Medium', alignment: 'chaotic evil', stats: { STR: 1, DEX: 14, CON: 10, INT: 12, WIS: 11, CHA: 17 }, hp: { average: 58, diceExpression: '13d8' }, AC: 12, speed: '0 ft., fly 40 ft. (hover)' },
  { name: 'Drow', cr: '1/4', type: 'Humanoid', size: 'Medium', alignment: 'neutral evil', stats: { STR: 10, DEX: 14, CON: 10, INT: 11, WIS: 11, CHA: 12 }, hp: { average: 13, diceExpression: '3d8' }, AC: 15, speed: '30 ft.' },
  { name: 'Duergar', cr: '1', type: 'Humanoid', size: 'Medium', alignment: 'lawful evil', stats: { STR: 14, DEX: 11, CON: 14, INT: 11, WIS: 10, CHA: 9 }, hp: { average: 26, diceExpression: '4d8+8' }, AC: 16, speed: '25 ft.' },
  { name: 'Githyanki Warrior', cr: '3', type: 'Humanoid', size: 'Medium', alignment: 'lawful evil', stats: { STR: 15, DEX: 14, CON: 12, INT: 13, WIS: 13, CHA: 10 }, hp: { average: 49, diceExpression: '9d8+9' }, AC: 17, speed: '30 ft.' },
  { name: 'Merrow', cr: '2', type: 'Monstrosity', size: 'Large', alignment: 'chaotic evil', stats: { STR: 18, DEX: 10, CON: 15, INT: 8, WIS: 10, CHA: 9 }, hp: { average: 45, diceExpression: '6d10+12' }, AC: 13, speed: '10 ft., swim 40 ft.' },
  { name: 'Sahuagin', cr: '1/2', type: 'Humanoid', size: 'Medium', alignment: 'lawful evil', stats: { STR: 13, DEX: 11, CON: 12, INT: 12, WIS: 13, CHA: 9 }, hp: { average: 22, diceExpression: '4d8+4' }, AC: 12, speed: '30 ft., swim 40 ft.' },
  { name: 'Lizardfolk', cr: '1/2', type: 'Humanoid', size: 'Medium', alignment: 'neutral', stats: { STR: 15, DEX: 10, CON: 13, INT: 7, WIS: 12, CHA: 7 }, hp: { average: 22, diceExpression: '4d8+4' }, AC: 15, speed: '30 ft., swim 30 ft.' },
  { name: 'Yuan-ti Pureblood', cr: '1', type: 'Humanoid', size: 'Medium', alignment: 'neutral evil', stats: { STR: 11, DEX: 16, CON: 13, INT: 14, WIS: 11, CHA: 12 }, hp: { average: 40, diceExpression: '9d8' }, AC: 11, speed: '30 ft.' },
  { name: 'Centaur', cr: '2', type: 'Monstrosity', size: 'Large', alignment: 'neutral good', stats: { STR: 18, DEX: 14, CON: 14, INT: 9, WIS: 13, CHA: 11 }, hp: { average: 45, diceExpression: '6d10+12' }, AC: 12, speed: '50 ft.' },
  { name: 'Satyr', cr: '1/2', type: 'Fey', size: 'Medium', alignment: 'chaotic neutral', stats: { STR: 12, DEX: 16, CON: 11, INT: 12, WIS: 10, CHA: 14 }, hp: { average: 31, diceExpression: '7d8' }, AC: 14, speed: '40 ft.' },
  { name: 'Dryad', cr: '1', type: 'Fey', size: 'Medium', alignment: 'neutral', stats: { STR: 10, DEX: 12, CON: 11, INT: 14, WIS: 15, CHA: 20 }, hp: { average: 22, diceExpression: '5d8' }, AC: 11, speed: '30 ft.' },
  { name: 'Will-o-Wisp', cr: '2', type: 'Undead', size: 'Tiny', alignment: 'chaotic evil', stats: { STR: 1, DEX: 28, CON: 10, INT: 13, WIS: 14, CHA: 11 }, hp: { average: 22, diceExpression: '9d4' }, AC: 19, speed: '0 ft., fly 50 ft. (hover)' },
  { name: 'Couatl', cr: '4', type: 'Celestial', size: 'Medium', alignment: 'lawful good', stats: { STR: 16, DEX: 20, CON: 17, INT: 18, WIS: 20, CHA: 18 }, hp: { average: 97, diceExpression: '13d8+39' }, AC: 19, speed: '30 ft., fly 90 ft.' },
  { name: 'Imp', cr: '1', type: 'Fiend', size: 'Tiny', alignment: 'lawful evil', stats: { STR: 6, DEX: 17, CON: 13, INT: 11, WIS: 12, CHA: 14 }, hp: { average: 10, diceExpression: '3d4+3' }, AC: 13, speed: '20 ft., fly 40 ft.' },
  { name: 'Incubus', cr: '4', type: 'Fiend', size: 'Medium', alignment: 'neutral evil', stats: { STR: 8, DEX: 17, CON: 13, INT: 15, WIS: 12, CHA: 20 }, hp: { average: 66, diceExpression: '12d8+12' }, AC: 13, speed: '30 ft., fly 60 ft.' },
  { name: 'Balor', cr: '19', type: 'Fiend', size: 'Huge', alignment: 'chaotic evil', stats: { STR: 26, DEX: 15, CON: 22, INT: 20, WIS: 16, CHA: 22 }, hp: { average: 262, diceExpression: '21d12+126' }, AC: 19, speed: '40 ft., fly 80 ft.' },
  { name: 'Pit Fiend', cr: '20', type: 'Fiend', size: 'Large', alignment: 'lawful evil', stats: { STR: 26, DEX: 14, CON: 24, INT: 22, WIS: 18, CHA: 24 }, hp: { average: 300, diceExpression: '24d10+168' }, AC: 19, speed: '30 ft., fly 60 ft.' },
  { name: 'Planetar', cr: '16', type: 'Celestial', size: 'Large', alignment: 'lawful good', stats: { STR: 24, DEX: 20, CON: 24, INT: 19, WIS: 22, CHA: 25 }, hp: { average: 200, diceExpression: '16d10+112' }, AC: 19, speed: '40 ft., fly 120 ft.' },
];

const FALLBACK_SPELLS = [
  { name: 'Fire Bolt', level: 0, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Fire', damageDice: '1d10', classes: 'Sorcerer, Wizard' },
  { name: 'Mage Hand', level: 0, school: 'Conjuration', castingTime: '1 action', range: '30 feet', components: 'V, S', duration: '1 minute', concentration: false, classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Prestidigitation', level: 0, school: 'Transmutation', castingTime: '1 action', range: '10 feet', components: 'V, S', duration: 'Up to 1 hour', concentration: false, classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Sacred Flame', level: 0, school: 'Evocation', castingTime: '1 action', range: '60 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Radiant', damageDice: '1d8', saveAbility: 'DEX', classes: 'Cleric' },
  { name: 'Eldritch Blast', level: 0, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Force', damageDice: '1d10', classes: 'Warlock' },
  { name: 'Vicious Mockery', level: 0, school: 'Enchantment', castingTime: '1 action', range: '60 feet', components: 'V', duration: 'Instantaneous', concentration: false, damageType: 'Psychic', damageDice: '1d4', saveAbility: 'WIS', classes: 'Bard' },
  { name: 'Toll the Dead', level: 0, school: 'Necromancy', castingTime: '1 action', range: '60 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Necrotic', damageDice: '1d8', saveAbility: 'WIS', classes: 'Cleric, Warlock, Wizard' },
  { name: 'Magic Missile', level: 1, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Force', damageDice: '1d4+1', classes: 'Sorcerer, Wizard' },
  { name: 'Healing Word', level: 1, school: 'Evocation', castingTime: '1 bonus action', range: '60 feet', components: 'V', duration: 'Instantaneous', concentration: false, healDice: '1d4', classes: 'Bard, Cleric, Druid' },
  { name: 'Cure Wounds', level: 1, school: 'Evocation', castingTime: '1 action', range: 'Touch', components: 'V, S', duration: 'Instantaneous', concentration: false, healDice: '1d8', classes: 'Bard, Cleric, Druid, Paladin, Ranger' },
  { name: 'Shield', level: 1, school: 'Abjuration', castingTime: '1 reaction', range: 'Self', components: 'V, S', duration: '1 round', concentration: false, classes: 'Sorcerer, Wizard' },
  { name: 'Thunderwave', level: 1, school: 'Evocation', castingTime: '1 action', range: 'Self (15-foot cube)', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Thunder', damageDice: '2d8', saveAbility: 'CON', halfOnSave: false, classes: 'Bard, Druid, Sorcerer, Wizard' },
  { name: 'Burning Hands', level: 1, school: 'Evocation', castingTime: '1 action', range: 'Self (15-foot cone)', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Fire', damageDice: '3d6', saveAbility: 'DEX', halfOnSave: true, classes: 'Sorcerer, Wizard' },
  { name: 'Inflict Wounds', level: 1, school: 'Necromancy', castingTime: '1 action', range: 'Touch', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Necrotic', damageDice: '3d10', classes: 'Cleric' },
  { name: 'Charm Person', level: 1, school: 'Enchantment', castingTime: '1 action', range: '30 feet', components: 'V, S', duration: '1 hour', concentration: false, saveAbility: 'WIS', classes: 'Bard, Druid, Sorcerer, Warlock, Wizard' },
  { name: 'Detect Magic', level: 1, school: 'Divination', castingTime: '1 action', range: 'Self', components: 'V, S', duration: 'Concentration, up to 10 minutes', concentration: true, classes: 'Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Wizard' },
  { name: 'Hex', level: 1, school: 'Enchantment', castingTime: '1 bonus action', range: '90 feet', components: 'V, S, M', duration: 'Concentration, up to 1 hour', concentration: true, damageType: 'Necrotic', damageDice: '1d6', classes: 'Warlock' },
  { name: 'Hunter\'s Mark', level: 1, school: 'Divination', castingTime: '1 bonus action', range: '90 feet', components: 'V', duration: 'Concentration, up to 1 hour', concentration: true, damageDice: '1d6', classes: 'Ranger' },
  { name: 'Bless', level: 1, school: 'Enchantment', castingTime: '1 action', range: '30 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, classes: 'Cleric, Paladin' },
  { name: 'Divine Smite', level: 1, school: 'Evocation', castingTime: '1 bonus action', range: 'Self', components: 'V', duration: 'Instantaneous', concentration: false, damageType: 'Radiant', damageDice: '2d8', classes: 'Paladin' },
  { name: 'Misty Step', level: 2, school: 'Conjuration', castingTime: '1 bonus action', range: 'Self', components: 'V', duration: 'Instantaneous', concentration: false, classes: 'Sorcerer, Warlock, Wizard' },
  { name: 'Hold Person', level: 2, school: 'Enchantment', castingTime: '1 action', range: '60 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, saveAbility: 'WIS', classes: 'Bard, Cleric, Druid, Sorcerer, Warlock, Wizard' },
  { name: 'Scorching Ray', level: 2, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Fire', damageDice: '2d6', classes: 'Sorcerer, Wizard' },
  { name: 'Shatter', level: 2, school: 'Evocation', castingTime: '1 action', range: '60 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Thunder', damageDice: '3d8', saveAbility: 'CON', halfOnSave: true, classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Prayer of Healing', level: 2, school: 'Evocation', castingTime: '10 minutes', range: '30 feet', components: 'V', duration: 'Instantaneous', concentration: false, healDice: '2d8', classes: 'Cleric' },
  { name: 'Spiritual Weapon', level: 2, school: 'Evocation', castingTime: '1 bonus action', range: '60 feet', components: 'V, S', duration: '1 minute', concentration: false, damageType: 'Force', damageDice: '1d8', classes: 'Cleric' },
  { name: 'Invisibility', level: 2, school: 'Illusion', castingTime: '1 action', range: 'Touch', components: 'V, S, M', duration: 'Concentration, up to 1 hour', concentration: true, classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Mirror Image', level: 2, school: 'Illusion', castingTime: '1 action', range: 'Self', components: 'V, S', duration: '1 minute', concentration: false, classes: 'Sorcerer, Warlock, Wizard' },
  { name: 'Web', level: 2, school: 'Conjuration', castingTime: '1 action', range: '60 feet', components: 'V, S, M', duration: 'Concentration, up to 1 hour', concentration: true, saveAbility: 'DEX', classes: 'Sorcerer, Wizard' },
  { name: 'Acid Arrow', level: 2, school: 'Evocation', castingTime: '1 action', range: '90 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Acid', damageDice: '4d4', classes: 'Wizard' },
  { name: 'Fireball', level: 3, school: 'Evocation', castingTime: '1 action', range: '150 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Fire', damageDice: '8d6', saveAbility: 'DEX', halfOnSave: true, classes: 'Sorcerer, Wizard' },
  { name: 'Lightning Bolt', level: 3, school: 'Evocation', castingTime: '1 action', range: 'Self (100-foot line)', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Lightning', damageDice: '8d6', saveAbility: 'DEX', halfOnSave: true, classes: 'Sorcerer, Wizard' },
  { name: 'Counterspell', level: 3, school: 'Abjuration', castingTime: '1 reaction', range: '60 feet', components: 'S', duration: 'Instantaneous', concentration: false, classes: 'Sorcerer, Warlock, Wizard' },
  { name: 'Hypnotic Pattern', level: 3, school: 'Illusion', castingTime: '1 action', range: '120 feet', components: 'S, M', duration: 'Concentration, up to 1 minute', concentration: true, saveAbility: 'WIS', classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Mass Healing Word', level: 3, school: 'Evocation', castingTime: '1 bonus action', range: '60 feet', components: 'V', duration: 'Instantaneous', concentration: false, healDice: '1d4', classes: 'Cleric' },
  { name: 'Animate Dead', level: 3, school: 'Necromancy', castingTime: '1 minute', range: '10 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, classes: 'Cleric, Wizard' },
  { name: 'Spirit Guardians', level: 3, school: 'Conjuration', castingTime: '1 action', range: 'Self (15-foot radius)', components: 'V, S, M', duration: 'Concentration, up to 10 minutes', concentration: true, damageType: 'Radiant', damageDice: '3d8', saveAbility: 'WIS', halfOnSave: true, classes: 'Cleric' },
  { name: 'Call Lightning', level: 3, school: 'Conjuration', castingTime: '1 action', range: '120 feet', components: 'V, S', duration: 'Concentration, up to 10 minutes', concentration: true, damageType: 'Lightning', damageDice: '3d10', saveAbility: 'DEX', halfOnSave: true, classes: 'Druid' },
  { name: 'Fly', level: 3, school: 'Transmutation', castingTime: '1 action', range: 'Touch', components: 'V, S, M', duration: 'Concentration, up to 10 minutes', concentration: true, classes: 'Sorcerer, Warlock, Wizard' },
  { name: 'Haste', level: 3, school: 'Transmutation', castingTime: '1 action', range: '30 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, classes: 'Sorcerer, Wizard' },
  { name: 'Banishment', level: 4, school: 'Abjuration', castingTime: '1 action', range: '60 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, saveAbility: 'CHA', classes: 'Cleric, Paladin, Sorcerer, Warlock, Wizard' },
  { name: 'Polymorph', level: 4, school: 'Transmutation', castingTime: '1 action', range: '60 feet', components: 'V, S, M', duration: 'Concentration, up to 1 hour', concentration: true, saveAbility: 'WIS', classes: 'Bard, Druid, Sorcerer, Wizard' },
  { name: 'Greater Invisibility', level: 4, school: 'Illusion', castingTime: '1 action', range: 'Touch', components: 'V, S', duration: 'Concentration, up to 1 minute', concentration: true, classes: 'Bard, Sorcerer, Wizard' },
  { name: 'Wall of Fire', level: 4, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, damageType: 'Fire', damageDice: '5d8', saveAbility: 'DEX', halfOnSave: false, classes: 'Druid, Sorcerer, Wizard' },
  { name: 'Ice Storm', level: 4, school: 'Evocation', castingTime: '1 action', range: '300 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Bludgeoning', damageDice: '2d8', saveAbility: 'DEX', halfOnSave: true, classes: 'Druid, Sorcerer, Wizard' },
  { name: 'Guardian of Faith', level: 4, school: 'Conjuration', castingTime: '1 action', range: '30 feet', components: 'V', duration: '8 hours', concentration: false, damageType: 'Radiant', damageDice: '20', saveAbility: 'DEX', halfOnSave: false, classes: 'Cleric' },
  { name: 'Divination', level: 4, school: 'Divination', castingTime: '1 action', range: 'Self', components: 'V, S, M', duration: 'Instantaneous', concentration: false, classes: 'Cleric' },
  { name: 'Cone of Cold', level: 5, school: 'Evocation', castingTime: '1 action', range: 'Self (60-foot cone)', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Cold', damageDice: '8d8', saveAbility: 'CON', halfOnSave: true, classes: 'Sorcerer, Wizard' },
  { name: 'Hold Monster', level: 5, school: 'Enchantment', castingTime: '1 action', range: '90 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, saveAbility: 'WIS', classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Mass Cure Wounds', level: 5, school: 'Evocation', castingTime: '1 action', range: '60 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, healDice: '3d8', classes: 'Bard, Cleric, Druid' },
  { name: 'Raise Dead', level: 5, school: 'Necromancy', castingTime: '1 hour', range: 'Touch', components: 'V, S, M', duration: 'Instantaneous', concentration: false, classes: 'Bard, Cleric, Paladin' },
  { name: 'Wall of Force', level: 5, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: 'V, S, M', duration: 'Concentration, up to 10 minutes', concentration: true, classes: 'Wizard' },
  { name: 'Bigby\'s Hand', level: 5, school: 'Evocation', castingTime: '1 action', range: '120 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, damageType: 'Force', damageDice: '4d8', classes: 'Wizard' },
  { name: 'Scrying', level: 5, school: 'Divination', castingTime: '10 minutes', range: 'Self', components: 'V, S, M', duration: 'Concentration, up to 10 minutes', concentration: true, saveAbility: 'WIS', classes: 'Bard, Cleric, Druid, Warlock, Wizard' },
  { name: 'Chain Lightning', level: 6, school: 'Evocation', castingTime: '1 action', range: '150 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Lightning', damageDice: '10d8', saveAbility: 'DEX', halfOnSave: true, classes: 'Sorcerer, Wizard' },
  { name: 'Heal', level: 6, school: 'Evocation', castingTime: '1 action', range: '60 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, healDice: '70', classes: 'Cleric, Druid' },
  { name: 'Globe of Invulnerability', level: 6, school: 'Abjuration', castingTime: '1 action', range: 'Self (10-foot radius)', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, classes: 'Sorcerer, Wizard' },
  { name: 'Disintegrate', level: 6, school: 'Transmutation', castingTime: '1 action', range: '60 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Force', damageDice: '10d6+40', saveAbility: 'DEX', halfOnSave: false, classes: 'Sorcerer, Wizard' },
  { name: 'True Seeing', level: 6, school: 'Divination', castingTime: '1 action', range: 'Touch', components: 'V, S, M', duration: '1 hour', concentration: false, classes: 'Bard, Cleric, Sorcerer, Warlock, Wizard' },
  { name: 'Reverse Gravity', level: 7, school: 'Transmutation', castingTime: '1 action', range: '100 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, saveAbility: 'DEX', classes: 'Druid, Sorcerer, Wizard' },
  { name: 'Finger of Death', level: 7, school: 'Necromancy', castingTime: '1 action', range: '60 feet', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Necrotic', damageDice: '7d8+30', saveAbility: 'CON', halfOnSave: false, classes: 'Sorcerer, Warlock, Wizard' },
  { name: 'Plane Shift', level: 7, school: 'Conjuration', castingTime: '1 action', range: 'Touch', components: 'V, S, M', duration: 'Instantaneous', concentration: false, classes: 'Cleric, Druid, Sorcerer, Warlock, Wizard' },
  { name: 'Regenerate', level: 7, school: 'Transmutation', castingTime: '1 minute', range: 'Touch', components: 'V, S, M', duration: '1 hour', concentration: false, healDice: '4d8+15', classes: 'Bard, Cleric, Druid' },
  { name: 'Sunbeam', level: 6, school: 'Evocation', castingTime: '1 action', range: 'Self (60-foot line)', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, damageType: 'Radiant', damageDice: '6d8', saveAbility: 'CON', halfOnSave: true, classes: 'Druid, Sorcerer, Wizard' },
  { name: 'Earthquake', level: 8, school: 'Evocation', castingTime: '1 action', range: '500 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, saveAbility: 'CON', classes: 'Cleric, Druid, Sorcerer' },
  { name: 'Sunburst', level: 8, school: 'Evocation', castingTime: '1 action', range: '150 feet', components: 'V, S, M', duration: 'Instantaneous', concentration: false, damageType: 'Radiant', damageDice: '12d6', saveAbility: 'CON', halfOnSave: true, classes: 'Druid, Sorcerer, Wizard' },
  { name: 'Incendiary Cloud', level: 8, school: 'Conjuration', castingTime: '1 action', range: '150 feet', components: 'V, S', duration: 'Concentration, up to 1 minute', concentration: true, damageType: 'Fire', damageDice: '10d8', saveAbility: 'DEX', halfOnSave: true, classes: 'Sorcerer, Wizard' },
  { name: 'Dominate Monster', level: 8, school: 'Enchantment', castingTime: '1 action', range: '60 feet', components: 'V, S', duration: 'Concentration, up to 1 hour', concentration: true, saveAbility: 'WIS', classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Mind Blank', level: 8, school: 'Abjuration', castingTime: '1 action', range: 'Touch', components: 'V, S', duration: '24 hours', concentration: false, classes: 'Bard, Wizard' },
  { name: 'Power Word Kill', level: 9, school: 'Enchantment', castingTime: '1 action', range: '60 feet', components: 'V', duration: 'Instantaneous', concentration: false, classes: 'Bard, Sorcerer, Warlock, Wizard' },
  { name: 'Wish', level: 9, school: 'Conjuration', castingTime: '1 action', range: 'Self', components: 'V', duration: 'Instantaneous', concentration: false, classes: 'Sorcerer, Wizard' },
  { name: 'Meteor Swarm', level: 9, school: 'Evocation', castingTime: '1 action', range: '1 mile', components: 'V, S', duration: 'Instantaneous', concentration: false, damageType: 'Fire', damageDice: '20d6', saveAbility: 'DEX', halfOnSave: true, classes: 'Sorcerer, Wizard' },
  { name: 'True Resurrection', level: 9, school: 'Necromancy', castingTime: '1 hour', range: 'Touch', components: 'V, S, M', duration: 'Instantaneous', concentration: false, healDice: 'all', classes: 'Cleric, Druid' },
  { name: 'Foresight', level: 9, school: 'Divination', castingTime: '1 minute', range: 'Touch', components: 'V, S, M', duration: '8 hours', concentration: false, classes: 'Bard, Druid, Warlock, Wizard' },
  { name: 'Gate', level: 9, school: 'Conjuration', castingTime: '1 action', range: '60 feet', components: 'V, S, M', duration: 'Concentration, up to 1 minute', concentration: true, classes: 'Cleric, Sorcerer, Wizard' },
  { name: 'Time Stop', level: 9, school: 'Transmutation', castingTime: '1 action', range: 'Self', components: 'V', duration: 'Instantaneous', concentration: false, classes: 'Sorcerer, Wizard' },
];

// ── main ──────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dnd5e-tracker');
  console.log('Connected to MongoDB\n');

  // ── Monsters ──────────────────────────────────────────────────────────────
  console.log('Seeding monsters…');
  let monsters;
  try {
    const raw = await fetchAll(
      'https://api.open5e.com/v1/monsters/?limit=100&document__slug=wotc-srd&ordering=challenge_rating'
    );
    monsters = raw.slice(0, 100).map(mapMonster);
    console.log(`  Fetched ${monsters.length} monsters from open5e`);
  } catch (err) {
    console.warn(`  open5e unavailable (${err.message}), using ${FALLBACK_MONSTERS.length} fallback monsters`);
    monsters = FALLBACK_MONSTERS;
  }

  await Monster.deleteMany({});
  const insertedMonsters = await Monster.insertMany(monsters, { ordered: false });
  console.log(`  Inserted ${insertedMonsters.length} monsters\n`);

  // ── Spells ────────────────────────────────────────────────────────────────
  console.log('Seeding spells…');
  let spells;
  try {
    const raw = await fetchAll(
      'https://api.open5e.com/v1/spells/?limit=100&document__slug=wotc-srd&ordering=level_int'
    );
    spells = raw.slice(0, 150).map(mapSpell);
    console.log(`  Fetched ${spells.length} spells from open5e`);
  } catch (err) {
    console.warn(`  open5e unavailable (${err.message}), using ${FALLBACK_SPELLS.length} fallback spells`);
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
