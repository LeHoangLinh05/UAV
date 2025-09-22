// models/DeviceModel.js
const mongoose = require('mongoose');

const deviceModelSchema = new mongoose.Schema({
    manufacturer: { type: mongoose.Schema.Types.ObjectId, ref: 'Manufacturer', required: true },
    modelName: { type: String, required: true },
    protocol: { type: String, required: true, enum: ['dji_json_v1', 'veeniix_csv', 'standard_gps'] }
});

deviceModelSchema.index({ manufacturer: 1, modelName: 1 }, { unique: true });

module.exports = mongoose.model('DeviceModel', deviceModelSchema);