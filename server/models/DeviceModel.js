// models/DeviceModel.js
const mongoose = require('mongoose');

const deviceModelSchema = new mongoose.Schema({
    manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer', required: true },
    modelName: { type: String, required: true }, // Ví dụ: "Mavic 3 Pro", "V-Scout 2"
    // Quan trọng: Định danh loại giao thức mà model này sử dụng
    protocol: { type: String, required: true, enum: ['dji_json_v1', 'veeniix_csv', 'standard_gps'] }
});

// Đảm bảo modelName là duy nhất trong phạm vi của một hãng
deviceModelSchema.index({ manufacturer: 1, modelName: 1 }, { unique: true });

module.exports = mongoose.model('DeviceModel', deviceModelSchema);