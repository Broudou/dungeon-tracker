const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
  name:        String,
  attackBonus: Number,
  damageDice:  String,
  damageType:  String,
  description: String,
}, { _id: false });

const TraitSchema = new mongoose.Schema({
  name:        String,
  description: String,
}, { _id: false });

const CustomCreatureSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  name:       { type: String, required: true, trim: true },
  category:   {
    type: String,
    enum: ['Humanoid','Beast','Undead','Fiend','Celestial','Construct',
           'Dragon','Elemental','Fey','Giant','Monstrosity','Ooze','Plant','Other'],
    default: 'Humanoid',
  },
  role:       { type: String, enum: ['NPC','Enemy','Ally','Neutral'], default: 'NPC' },
  level:      { type: Number, min: 1, max: 20, default: 1 },
  cr:         String,
  size:       {
    type: String,
    enum: ['Tiny','Small','Medium','Large','Huge','Gargantuan'],
    default: 'Medium',
  },
  alignment:  String,
  stats: {
    STR: { type: Number, default: 10 },
    DEX: { type: Number, default: 10 },
    CON: { type: Number, default: 10 },
    INT: { type: Number, default: 10 },
    WIS: { type: Number, default: 10 },
    CHA: { type: Number, default: 10 },
  },
  hp:          { max: { type: Number, default: 10 } },
  ac:          { type: Number, default: 10 },
  speed:       { type: Number, default: 30 },
  actions:     [ActionSchema],
  traits:      [TraitSchema],
  resistances:   [String],
  immunities:    [String],
  vulnerabilities: [String],
  senses:      String,
  languages:   String,
  notes:       String,
}, { timestamps: true });

CustomCreatureSchema.index({ campaignId: 1 });

module.exports = mongoose.model('CustomCreature', CustomCreatureSchema);
