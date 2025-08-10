// backend/models/NoFlyZone.js
const mongoose = require('mongoose');

const noFlyZoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    isActive: { type: Boolean, default: true },

    // 'Circle' hoặc 'Polygon'
    shape: { type: String, required: true, enum: ['Circle', 'Polygon'] },

    // Dành cho hình tròn
    center: { lat: Number, lng: Number }, // Yêu cầu nếu shape là 'Circle'
    radius: { type: Number }, // Bán kính tính bằng mét. Yêu cầu nếu shape là 'Circle'

    // Dành cho đa giác
    path: [{ lat: Number, lng: Number, _id: false }], // Yêu cầu nếu shape là 'Polygon'

}, { timestamps: true });

// Index để truy vấn nhanh các vùng active
noFlyZoneSchema.index({ isActive: 1 });

module.exports = mongoose.model('NoFlyZone', noFlyZoneSchema);