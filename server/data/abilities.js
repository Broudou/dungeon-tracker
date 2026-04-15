/**
 * Hardcoded class abilities and traits for PHB classes.
 * Seeded into the Ability collection.
 */

module.exports = [
  // ── Fighter ──────────────────────────────────────────────────────────────────
  {
    name: 'Second Wind',
    description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level.',
    type: 'ability', classes: ['Fighter'], level: 1, resource: 'bonus', actionType: 'heal',
  },
  {
    name: 'Action Surge',
    description: 'Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action on top of your regular action and a possible bonus action.',
    type: 'ability', classes: ['Fighter'], level: 2, resource: 'action', actionType: 'improvise',
  },
  {
    name: 'Extra Attack (Fighter)',
    description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
    type: 'ability', classes: ['Fighter'], level: 5, resource: 'action', actionType: null,
  },
  {
    name: 'Indomitable',
    description: 'Beginning at 9th level, you can reroll a saving throw that you fail. If you do so, you must use the new roll, and you can\'t use this feature again until you finish a long rest.',
    type: 'ability', classes: ['Fighter'], level: 9, resource: 'passive', actionType: null,
  },

  // ── Barbarian ────────────────────────────────────────────────────────────────
  {
    name: 'Rage',
    description: 'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action. While raging, you have advantage on Strength checks and Strength saving throws, and gain a bonus to melee damage rolls. You also have resistance to bludgeoning, piercing, and slashing damage.',
    type: 'ability', classes: ['Barbarian'], level: 1, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Unarmored Defense (Barbarian)',
    description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
    type: 'trait', classes: ['Barbarian'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Reckless Attack',
    description: 'Starting at 2nd level, you can throw aside all concern for defense to attack with fierce desperation. When you make your first attack on your turn, you can decide to attack recklessly. Doing so gives you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.',
    type: 'ability', classes: ['Barbarian'], level: 2, resource: 'passive', actionType: null,
  },
  {
    name: 'Danger Sense',
    description: 'At 2nd level, you gain an uncanny sense of when things nearby aren\'t as they should be, giving you an edge when you dodge away from danger. You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells.',
    type: 'trait', classes: ['Barbarian'], level: 2, resource: 'passive', actionType: null,
  },
  {
    name: 'Extra Attack (Barbarian)',
    description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
    type: 'ability', classes: ['Barbarian'], level: 5, resource: 'action', actionType: null,
  },
  {
    name: 'Feral Instinct',
    description: 'By 7th level, your instincts are so honed that you have advantage on initiative rolls. Additionally, if you are surprised at the beginning of combat and aren\'t incapacitated, you can act normally on your first turn, but only if you enter your rage before doing anything else on that turn.',
    type: 'trait', classes: ['Barbarian'], level: 7, resource: 'passive', actionType: null,
  },

  // ── Bard ─────────────────────────────────────────────────────────────────────
  {
    name: 'Bardic Inspiration',
    description: 'You can inspire others through stirring words or music. To do so, you use a bonus action on your turn to choose one creature other than yourself within 60 feet of you who can hear you. That creature gains one Bardic Inspiration die, a d6.',
    type: 'ability', classes: ['Bard'], level: 1, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Jack of All Trades',
    description: 'Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any ability check you make that doesn\'t already include your proficiency bonus.',
    type: 'trait', classes: ['Bard'], level: 2, resource: 'passive', actionType: null,
  },
  {
    name: 'Song of Rest',
    description: 'Beginning at 2nd level, you can use soothing music or oration to help revitalize your wounded allies during a short rest. If you or any friendly creatures who can hear your performance regain hit points at the end of the short rest, each of those creatures regains an extra 1d6 hit points.',
    type: 'ability', classes: ['Bard'], level: 2, resource: 'passive', actionType: null,
  },
  {
    name: 'Countercharm',
    description: 'At 6th level, you gain the ability to use musical notes or words of power to disrupt mind-influencing effects. As an action, you can start a performance that lasts until the end of your next turn.',
    type: 'ability', classes: ['Bard'], level: 6, resource: 'action', actionType: 'improvise',
  },

  // ── Cleric ───────────────────────────────────────────────────────────────────
  {
    name: 'Divine Domain',
    description: 'Choose one domain related to your deity. Your choice grants you domain spells and other features when you choose it at 1st level.',
    type: 'trait', classes: ['Cleric'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Channel Divinity',
    description: 'At 2nd level, you gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain.',
    type: 'ability', classes: ['Cleric'], level: 2, resource: 'action', actionType: 'improvise',
  },
  {
    name: 'Turn Undead',
    description: 'As an action, you present your holy symbol and speak a prayer censuring the undead. Each undead that can see or hear you within 30 feet of you must make a Wisdom saving throw.',
    type: 'ability', classes: ['Cleric'], level: 2, resource: 'action', actionType: 'improvise',
  },
  {
    name: 'Destroy Undead',
    description: 'Starting at 5th level, when an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold.',
    type: 'ability', classes: ['Cleric'], level: 5, resource: 'passive', actionType: null,
  },
  {
    name: 'Divine Intervention',
    description: 'Beginning at 10th level, you can call on your deity to intervene on your behalf when your need is great. Imploring your deity\'s aid requires you to use your action.',
    type: 'ability', classes: ['Cleric'], level: 10, resource: 'action', actionType: 'improvise',
  },

  // ── Druid ────────────────────────────────────────────────────────────────────
  {
    name: 'Druidic',
    description: 'You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages.',
    type: 'trait', classes: ['Druid'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Wild Shape',
    description: 'Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before. You can use this feature twice. You regain expended uses when you finish a short or long rest.',
    type: 'ability', classes: ['Druid'], level: 2, resource: 'action', actionType: 'improvise',
  },
  {
    name: 'Timeless Body (Druid)',
    description: 'Starting at 18th level, the primal magic that you wield causes you to age more slowly. For every 10 years that pass, your body ages only 1 year.',
    type: 'trait', classes: ['Druid'], level: 18, resource: 'passive', actionType: null,
  },

  // ── Monk ─────────────────────────────────────────────────────────────────────
  {
    name: 'Martial Arts',
    description: 'Your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons. You can use Dexterity instead of Strength for attack and damage rolls, and you can roll your Martial Arts die in place of normal damage.',
    type: 'trait', classes: ['Monk'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Unarmored Defense (Monk)',
    description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
    type: 'trait', classes: ['Monk'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Ki',
    description: 'Starting at 2nd level, your training allows you to harness the mystic energy of ki. You have a number of ki points equal to your monk level. You can spend ki points to fuel various ki features: Flurry of Blows, Patient Defense, Step of the Wind.',
    type: 'ability', classes: ['Monk'], level: 2, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Flurry of Blows',
    description: 'Immediately after you take the Attack action on your turn, you can spend 1 ki point to make two unarmed strikes as a bonus action.',
    type: 'ability', classes: ['Monk'], level: 2, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Patient Defense',
    description: 'You can spend 1 ki point to take the Dodge action as a bonus action on your turn.',
    type: 'ability', classes: ['Monk'], level: 2, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Step of the Wind',
    description: 'You can spend 1 ki point to take the Disengage or Dash action as a bonus action on your turn, and your jump distance is doubled for the turn.',
    type: 'ability', classes: ['Monk'], level: 2, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Stunning Strike',
    description: 'Starting at 5th level, you can interfere with the flow of ki in an opponent\'s body. When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike.',
    type: 'ability', classes: ['Monk'], level: 5, resource: 'passive', actionType: null,
  },
  {
    name: 'Evasion (Monk)',
    description: 'At 7th level, your instinctive agility lets you dodge out of the way of certain area effects. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.',
    type: 'trait', classes: ['Monk'], level: 7, resource: 'passive', actionType: null,
  },

  // ── Paladin ──────────────────────────────────────────────────────────────────
  {
    name: 'Divine Sense',
    description: 'The presence of strong evil registers on your senses like a noxious odor, and powerful good rings like heavenly music in your ears. As an action, you open your awareness to detect such forces.',
    type: 'ability', classes: ['Paladin'], level: 1, resource: 'action', actionType: 'improvise',
  },
  {
    name: 'Lay on Hands',
    description: 'Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest. With that pool, you can restore a total number of hit points equal to your paladin level × 5.',
    type: 'ability', classes: ['Paladin'], level: 1, resource: 'action', actionType: 'heal',
  },
  {
    name: 'Divine Smite',
    description: 'Starting at 2nd level, when you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon\'s damage. The extra damage is 2d8 for a 1st-level spell slot, plus 1d8 for each spell level higher than 1st.',
    type: 'ability', classes: ['Paladin'], level: 2, resource: 'passive', actionType: null,
  },
  {
    name: 'Divine Health',
    description: 'By 3rd level, the divine magic flowing through you makes you immune to disease.',
    type: 'trait', classes: ['Paladin'], level: 3, resource: 'passive', actionType: null,
  },
  {
    name: 'Extra Attack (Paladin)',
    description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
    type: 'ability', classes: ['Paladin'], level: 5, resource: 'action', actionType: null,
  },
  {
    name: 'Aura of Protection',
    description: 'Starting at 6th level, whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (with a minimum bonus of +1). You must be conscious to grant this bonus.',
    type: 'trait', classes: ['Paladin'], level: 6, resource: 'passive', actionType: null,
  },

  // ── Ranger ───────────────────────────────────────────────────────────────────
  {
    name: 'Favored Enemy',
    description: 'Beginning at 1st level, you have significant experience studying, tracking, hunting, and even talking to a certain type of enemy. Choose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead.',
    type: 'trait', classes: ['Ranger'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Natural Explorer',
    description: 'You are a master of navigating the natural world, and you react with swift and decisive action when attacked. This grants you bonuses in favored terrain.',
    type: 'trait', classes: ['Ranger'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Extra Attack (Ranger)',
    description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
    type: 'ability', classes: ['Ranger'], level: 5, resource: 'action', actionType: null,
  },
  {
    name: 'Evasion (Ranger)',
    description: 'Beginning at 7th level, you can nimbly dodge out of the way of certain area effects. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw.',
    type: 'trait', classes: ['Ranger'], level: 7, resource: 'passive', actionType: null,
  },

  // ── Rogue ────────────────────────────────────────────────────────────────────
  {
    name: 'Sneak Attack',
    description: 'Beginning at 1st level, you know how to strike subtly and exploit a foe\'s distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll.',
    type: 'ability', classes: ['Rogue'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Thieves\' Cant',
    description: 'During your rogue training you learned thieves\' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.',
    type: 'trait', classes: ['Rogue'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Cunning Action',
    description: 'Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action.',
    type: 'ability', classes: ['Rogue'], level: 2, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Uncanny Dodge',
    description: 'Starting at 5th level, when an attacker that you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.',
    type: 'ability', classes: ['Rogue'], level: 5, resource: 'reaction', actionType: 'improvise',
  },
  {
    name: 'Evasion (Rogue)',
    description: 'Beginning at 7th level, you can nimbly dodge out of the way of certain area effects. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw.',
    type: 'trait', classes: ['Rogue'], level: 7, resource: 'passive', actionType: null,
  },

  // ── Sorcerer ─────────────────────────────────────────────────────────────────
  {
    name: 'Sorcerous Origin',
    description: 'Choose a sorcerous origin, which describes the source of your innate magical power. Your choice grants you features when you choose it at 1st level and again at 6th, 14th, and 18th level.',
    type: 'trait', classes: ['Sorcerer'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Font of Magic',
    description: 'At 2nd level, you tap into a deep wellspring of magic within yourself. This wellspring is represented by sorcery points, which allow you to create a variety of magical effects.',
    type: 'ability', classes: ['Sorcerer'], level: 2, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Flexible Casting',
    description: 'You can use your sorcery points to gain additional spell slots, or sacrifice spell slots to gain additional sorcery points.',
    type: 'ability', classes: ['Sorcerer'], level: 2, resource: 'bonus', actionType: 'improvise',
  },
  {
    name: 'Metamagic',
    description: 'At 3rd level, you gain the ability to twist your spells to suit your needs. You gain two Metamagic options (Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, or Twinned Spell).',
    type: 'ability', classes: ['Sorcerer'], level: 3, resource: 'passive', actionType: null,
  },

  // ── Warlock ──────────────────────────────────────────────────────────────────
  {
    name: 'Otherworldly Patron',
    description: 'At 1st level, you have struck a bargain with an otherworldly being of your choice. Your choice of patron grants you features at 1st level and again at 6th, 10th, and 14th level.',
    type: 'trait', classes: ['Warlock'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Pact Magic',
    description: 'Your arcane research and the magic bestowed on you by your patron have given you facility with spells. You regain all expended spell slots when you finish a short or long rest.',
    type: 'trait', classes: ['Warlock'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Eldritch Invocations',
    description: 'In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge that imbue you with an abiding magical ability. Starting at 2nd level, you gain two eldritch invocations of your choice.',
    type: 'ability', classes: ['Warlock'], level: 2, resource: 'passive', actionType: null,
  },
  {
    name: 'Pact Boon',
    description: 'At 3rd level, your otherworldly patron bestows a gift upon you for your loyal service. You gain one of the following features of your choice: Pact of the Chain, Pact of the Blade, or Pact of the Tome.',
    type: 'ability', classes: ['Warlock'], level: 3, resource: 'passive', actionType: null,
  },

  // ── Wizard ───────────────────────────────────────────────────────────────────
  {
    name: 'Arcane Recovery',
    description: 'You have learned to regain some of your magical energy by studying your spellbook. Once per day when you finish a short rest, you can choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your wizard level (rounded up).',
    type: 'ability', classes: ['Wizard'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Arcane Tradition',
    description: 'When you reach 2nd level, you choose an arcane tradition, shaping your practice of magic through one of eight schools: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, or Transmutation.',
    type: 'trait', classes: ['Wizard'], level: 2, resource: 'passive', actionType: null,
  },
  {
    name: 'Spell Mastery',
    description: 'At 18th level, you have achieved such mastery over certain spells that you can cast them at will. Choose a 1st-level wizard spell and a 2nd-level wizard spell that are in your spellbook. You can cast those spells at their lowest level without expending a spell slot when you have them prepared.',
    type: 'ability', classes: ['Wizard'], level: 18, resource: 'passive', actionType: null,
  },

  // ── Universal / Shared ───────────────────────────────────────────────────────
  {
    name: 'Fighting Style',
    description: 'You adopt a particular style of fighting as your specialty. Choose one of the following options: Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting.',
    type: 'ability', classes: ['Fighter', 'Paladin', 'Ranger'], level: 1, resource: 'passive', actionType: null,
  },
  {
    name: 'Spellcasting',
    description: 'You can cast spells using your spellcasting ability modifier. Your spell save DC and spell attack bonus are based on this modifier plus your proficiency bonus.',
    type: 'trait', classes: ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'], level: 1, resource: 'action', actionType: null,
  },
];
