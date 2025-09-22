// backend/models/NoFlyZone.js
const mongoose = require('mongoose');

const noFlyZoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    isActive: { type: Boolean, default: true },
    shape: { type: String, required: true, enum: ['Circle', 'Polygon'] },
    center: { lat: Number, lng: Number },
    radius: { type: Number },
    path: [{ lat: Number, lng: Number, _id: false }],

}, { timestamps: true });
noFlyZoneSchema.index({ isActive: 1 });

module.exports = mongoose.model('NoFlyZone', noFlyZoneSchema);