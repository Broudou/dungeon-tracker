const mongoose = require('mongoose');

const SpellSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  level: { type: Number, min: 0, max: 9, index: true },  // 0 = cantrip
  school: { type: String, index: true },
  castingTime: String,
  range: String,
  components: String,
  duration: String,
  concentration: { type: Boolean, default: false },
  damageType: String,
  damageDice: String,
  saveAbility: String,
  healDice: String,
  halfOnSave: { type: Boolean, default: false },
  description: String,
  // comma-separated list of classes that can use this spell
  classes: { type: String, index: true },
}, { timestamps: false });

module.exports = mongoose.model('Spell', SpellSchema);
