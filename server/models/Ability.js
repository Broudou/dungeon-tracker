const mongoose = require('mongoose');

const AbilitySchema = new mongoose.Schema({
  name:        { type: String, required: true, index: true },
  description: String,
  type:        { type: String, enum: ['ability', 'trait'], required: true },
  classes:     [String],
  level:       { type: Number, default: 1 },
  resource:    { type: String, enum: ['action', 'bonus', 'reaction', 'passive'] },
  actionType:  String,
}, { timestamps: false });

AbilitySchema.index({ classes: 1 });

module.exports = mongoose.model('Ability', AbilitySchema);
