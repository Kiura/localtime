const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const model = new Schema({
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  active: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  chatId: { type: Number, required: true },
  type: { type: String, enum: ['private', 'group', 'supergroup', 'channel'] },
  title: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  username: { type: String },
}, { minimize: false, toObject: { virtuals: true }, toJSON: { virtuals: true } });

module.exports = mongoose.model('Chat', model);
