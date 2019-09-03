const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const model = new Schema({
  memberOf: { type: Schema.Types.ObjectId, ref: 'Chat' },
  userId: { type: Number, required: true, index: true },
  firstName: { type: String },
  lastName: { type: String },
  username: { type: String },
  timezone: { type: String },
  country: { type: String },
  flag: { type: String },
}, { minimize: false, toObject: { virtuals: true }, toJSON: { virtuals: true } });

module.exports = mongoose.model('User', model);
