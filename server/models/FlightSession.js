const mongoose = require('mongoose');

const flightSessionSchema = new mongoose.Schema({
    deviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date
    },
    durationInSeconds: {
        type: Number,
        default: 0
    },

    startAddress: { type: String, default: 'Đang xác định...' },
    endAddress: { type: String, default: 'Chưa kết thúc' },

    // Lưu lại một mảng các tọa độ [lat, lng]
    path: [{
        lat: Number,
        lng: Number,
        _id: false
    }]
}, { timestamps: true });

module.exports = mongoose.model('FlightSession', flightSessionSchema);