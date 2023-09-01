const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const model = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  usageCount: { type: Number },
}, { minimize: false, toObject: { virtuals: true }, toJSON: { virtuals: true } });

module.exports = mongoose.model('Activity', model);
