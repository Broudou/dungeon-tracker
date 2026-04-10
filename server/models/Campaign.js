const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  weight: Number,
  description: String,
  equipped: { type: Boolean, default: false },
}, { _id: true });

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  race: String,
  class: String,
  subclass: String,
  background: String,
  alignment: String,
  level: { type: Number, default: 1, min: 1, max: 20 },
  stats: {
    STR: { type: Number, default: 10 },
    DEX: { type: Number, default: 10 },
    CON: { type: Number, default: 10 },
    INT: { type: Number, default: 10 },
    WIS: { type: Number, default: 10 },
    CHA: { type: Number, default: 10 },
  },
  combat: {
    hpMax: { type: Number, default: 0 },
    hpCurrent: { type: Number, default: 0 },
    tempHp: { type: Number, default: 0 },
    AC: { type: Number, default: 10 },
    speed: { type: Number, default: 30 },
    initiativeMod: { type: Number, default: 0 },
    hitDice: String,
  },
  conditions: [String],
  inventory: [InventoryItemSchema],
  // keys "1"–"9" → { max, used }
  spellSlots: { type: mongoose.Schema.Types.Mixed, default: {} },
  knownSpells: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Spell' }],
  preparedSpells: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Spell' }],
}, { _id: true });

const LoreEntrySchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, default: '' },
  category: {
    type: String,
    enum: ['world', 'faction', 'npc', 'location', 'custom'],
    default: 'custom',
  },
  visibleToPlayers: { type: Boolean, default: false },
}, { _id: true, timestamps: true });

const CampaignSchema = new mongoose.Schema({
  dmId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  players: [PlayerSchema],
  lore: [LoreEntrySchema],
}, { timestamps: true });

// Only the owning DM can query campaigns
CampaignSchema.index({ dmId: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
