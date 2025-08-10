// backend/models/Device.js
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, trim: true },
    name: String,
    deviceModel: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceModel', required: true },
    location: { lat: Number, lng: Number },
    image: String,

    status: {
        type: String,
        enum: ['Đang hoạt động', 'Không hoạt động', 'Chờ kết nối'],
        default: 'Chờ kết nối'
    },

    lastHeartbeat: {
        type: Date,
        default: Date.now
    },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isLocked: { type: Boolean, default: false } // Giữ lại chức năng khóa của admin

});

deviceSchema.index({ deviceModel: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('Device', deviceSchema);