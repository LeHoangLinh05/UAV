const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  avatar: { type: String, default: '/uploads/default-avatar.jpg' },
  isLocked: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('User', userSchema);
