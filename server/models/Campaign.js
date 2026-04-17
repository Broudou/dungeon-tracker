const mongoose = require('mongoose');

// ── SpellSlotSchema ───────────────────────────────────────────────────────────
// One individual spell slot for a caster. `level` is the slot level (1–9),
// `index` is the 0-based position within that level, and `spell` is an
// optional reference to the spell assigned to this slot.
const SpellSlotSchema = new mongoose.Schema({
  level: { type: Number, required: true, min: 1, max: 9 },
  index: { type: Number, required: true, min: 0 },
  spell: { type: mongoose.Schema.Types.ObjectId, ref: 'Spell', default: null },
  used:  { type: Boolean, default: false },
}, { _id: false });

// ── InventoryItemSchema ───────────────────────────────────────────────────────
// A single item in a player's inventory. Embedded in PlayerSchema.
// `equipped` is a UI hint — no mechanical effect is enforced server-side.
const InventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  weight: Number,         // optional, in lbs
  description: String,
  equipped: { type: Boolean, default: false },
}, { _id: true });

// ── PlayerSchema ──────────────────────────────────────────────────────────────
// A player character (PC) belonging to a campaign. Embedded in CampaignSchema.
// This record is the canonical source of truth for character data; during a
// live session the relevant fields are denormalised into CombatSession.initiativeOrder
// for fast in-memory combat access.
const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  race: String,
  class: String,
  subclass: String,
  background: String,
  alignment: String,
  level: { type: Number, default: 1, min: 1, max: 20 },

  // The six core D&D ability scores (standard array default: 10 = no modifier)
  stats: {
    STR: { type: Number, default: 10 },
    DEX: { type: Number, default: 10 },
    CON: { type: Number, default: 10 },
    INT: { type: Number, default: 10 },
    WIS: { type: Number, default: 10 },
    CHA: { type: Number, default: 10 },
  },

  // Combat-relevant values copied into the initiative tracker when combat starts
  combat: {
    hpMax:        { type: Number, default: 0 },
    hpCurrent:    { type: Number, default: 0 },
    tempHp:       { type: Number, default: 0 },   // absorbs damage before real HP
    AC:           { type: Number, default: 10 },
    speed:        { type: Number, default: 30 },  // ft per turn
    initiativeMod:{ type: Number, default: 0 },   // added on top of DEX modifier
    hitDice:      String,                          // e.g. "1d10"
  },

  // Active conditions (e.g. "poisoned", "blinded") managed by the DM in-session
  conditions: [String],

  inventory: [InventoryItemSchema],

  // Per-slot state: each entry is one physical spell slot with its level,
  // position index, assigned spell, and expended flag.
  spellSlots: [SpellSlotSchema],

  // Full spell library available to this character (references Spell collection)
  knownSpells: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Spell' }],

  // Subset of knownSpells that are prepared for today (relevant for prepared casters)
  preparedSpells: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Spell' }],
}, { _id: true });

// ── CampaignSchema ────────────────────────────────────────────────────────────
// Top-level document owned by a single DM. Holds the full roster of player
// characters. Sessions reference this document via campaignId.
const CampaignSchema = new mongoose.Schema({
  dmId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  players:     [PlayerSchema],
}, { timestamps: true });

// Scope all queries to the owning DM — no cross-DM campaign leakage
CampaignSchema.index({ dmId: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
