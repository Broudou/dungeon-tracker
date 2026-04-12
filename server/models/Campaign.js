const mongoose = require('mongoose');

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

  // Spell slot tracking: keys "1"–"9" → { max: Number, used: Number }
  // Using Mixed so the DM can support any caster type without a rigid schema.
  spellSlots: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Full spell library available to this character (references Spell collection)
  knownSpells: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Spell' }],

  // Subset of knownSpells that are prepared for today (relevant for prepared casters)
  preparedSpells: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Spell' }],
}, { _id: true });

// ── LoreEntrySchema ───────────────────────────────────────────────────────────
// A single piece of campaign lore authored by the DM.
// `visibleToPlayers` controls whether the entry can be pushed to the player
// lore feed during a session's world phase.
const LoreEntrySchema = new mongoose.Schema({
  title: { type: String, required: true },
  body:  { type: String, default: '' },
  category: {
    type: String,
    enum: ['world', 'faction', 'npc', 'location', 'custom'],
    default: 'custom',
  },
  // When true the DM can broadcast this entry as a lore card during a session
  visibleToPlayers: { type: Boolean, default: false },
}, { _id: true, timestamps: true });

// ── CampaignSchema ────────────────────────────────────────────────────────────
// Top-level document owned by a single DM. Holds the full roster of player
// characters and all lore entries for the campaign. Sessions reference this
// document via campaignId.
const CampaignSchema = new mongoose.Schema({
  dmId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  players:     [PlayerSchema],
  lore:        [LoreEntrySchema],
}, { timestamps: true });

// Scope all queries to the owning DM — no cross-DM campaign leakage
CampaignSchema.index({ dmId: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
