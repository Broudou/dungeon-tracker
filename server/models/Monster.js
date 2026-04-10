const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
  name: String,
  description: String,
  attackBonus: Number,
  damageDice: String,
  damageType: String,
  saveDC: Number,
  saveAbility: String,
}, { _id: false });

const MonsterSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  cr: { type: String, index: true },   // stored as string: "1/4", "1/2", "1", "10" …
  type: { type: String, index: true },
  size: String,
  alignment: String,
  stats: {
    STR: Number, DEX: Number, CON: Number,
    INT: Number, WIS: Number, CHA: Number,
  },
  hp: {
    average: Number,
    diceExpression: String,
  },
  AC: Number,
  speed: String,
  savingThrows: { type: mongoose.Schema.Types.Mixed, default: {} },
  skills: { type: mongoose.Schema.Types.Mixed, default: {} },
  senses: String,
  languages: String,
  resistances: [String],
  immunities: [String],
  vulnerabilities: [String],
  actions: [ActionSchema],
  reactions: [ActionSchema],
  traits: [ActionSchema],
  legendaryActions: [ActionSchema],
}, { timestamps: false });

module.exports = mongoose.model('Monster', MonsterSchema);
