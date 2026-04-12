const mongoose = require('mongoose');

function generateJoinKey() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const SessionSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  joinKey: {
    type: String,
    unique: true,
    default: generateJoinKey,
    uppercase: true,
    minlength: 6,
    maxlength: 6,
  },
  phase: {
    type: String,
    enum: ['open-world', 'combat'],
    default: 'open-world',
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
  },
  pushedLore: [{
    title:    { type: String, default: 'Untitled' },
    category: { type: String, default: 'Other' },
    content:  { type: String, default: '' },
    pushedAt: { type: Date,   default: Date.now },
  }],
}, { timestamps: true });

SessionSchema.index({ joinKey: 1 });
SessionSchema.index({ campaignId: 1 });

module.exports = mongoose.model('Session', SessionSchema);
