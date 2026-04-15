const mongoose = require('mongoose');

const DotEffectSchema = new mongoose.Schema({
  effectId:         { type: String, required: true },
  spellName:        String,
  damageDice:       String,
  damageType:       String,
  sourceInstanceId: String,
  appliedRound:     Number,
}, { _id: false });

const TagSchema = new mongoose.Schema({
  label: String,
  color: { type: String, enum: ['red', 'green', 'blue', 'yellow', 'purple'], default: 'yellow' },
}, { _id: false });

const ActionEntrySchema = new mongoose.Schema({
  name:        String,
  description: String,
  attackBonus: Number,
  damageDice:  String,
  damageType:  String,
  saveDC:      Number,
  saveAbility: String,
}, { _id: false });

const CombatantSchema = new mongoose.Schema({
  entityId:         String,   // player._id or monster _id or custom creature _id
  entityType:       { type: String, enum: ['player', 'monster', 'custom'] },
  instanceId:       String,   // unique per encounter (uuid)
  name:             String,
  initiative:       { type: Number, default: 0 },
  currentHp:        { type: Number, default: 0 },
  maxHp:            { type: Number, default: 0 },
  ac:               { type: Number, default: 10 },
  conditions:       [String],
  customTags:       [TagSchema],
  actionSpent:      { type: Boolean, default: false },
  bonusActionSpent: { type: Boolean, default: false },
  reactionSpent:    { type: Boolean, default: false },
  isDefeated:       { type: Boolean, default: false },
  // Display meta (denormalised for speed)
  cr:       String,
  level:    Number,
  class:    String,
  race:     String,
  deathSaves: {
    successes: { type: Number, default: 0 },
    failures:  { type: Number, default: 0 },
  },
  dotEffects: { type: [DotEffectSchema], default: [] },
  stats: mongoose.Schema.Types.Mixed,   // raw ability scores { STR, DEX, CON, INT, WIS, CHA }
  // Monster/custom creature abilities (denormalised from source document)
  actions:          [ActionEntrySchema],
  reactions:        [ActionEntrySchema],
  traits:           [ActionEntrySchema],
  legendaryActions: [ActionEntrySchema],
}, { _id: false });

const PendingActionSchema = new mongoose.Schema({
  actionId:       { type: String, required: true },
  submittedBy:    String,   // entityId of the acting character
  submitterName:  String,
  actionType:     String,   // 'attack', 'cast', 'heal', 'item', 'improvise', 'bonus', 'reaction', etc.
  description:    String,   // human-readable summary shown in DM queue
  params:         mongoose.Schema.Types.Mixed,
  status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  dmNote:         String,
  submittedAt:    { type: Date, default: Date.now },
}, { _id: false });

const LogEntrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  message:   String,
  type:      {
    type: String,
    enum: ['action', 'damage', 'heal', 'condition', 'roll', 'system', 'dm_note'],
    default: 'system',
  },
}, { _id: false });

const CombatSessionSchema = new mongoose.Schema({
  sessionId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  campaignId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  state:            { type: String, enum: ['idle', 'active', 'paused', 'ended'], default: 'idle' },
  round:            { type: Number, default: 0 },
  currentTurnIndex: { type: Number, default: 0 },
  initiativeOrder:  [CombatantSchema],
  pendingActions:   [PendingActionSchema],
  combatLog:        [LogEntrySchema],
}, { timestamps: true });

CombatSessionSchema.index({ sessionId: 1 });

module.exports = mongoose.model('CombatSession', CombatSessionSchema);
