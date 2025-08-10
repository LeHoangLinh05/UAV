// models/Manufacturer.js
const mongoose = require('mongoose');

const manufacturerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // Ví dụ: "DJI", "Veeniix Robotics"
    website: String,
    supportContact: String,
});

module.exports = mongoose.model('Manufacturer', manufacturerSchema);