const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    name: String,
    location: {
        lat: Number,
        lng: Number,
    },
    image: String, // đường dẫn ảnh
    status: {
        type: String,
        enum: ['Đang bay', 'Không hoạt động'],
        default: 'Không hoạt động'
    }
});

module.exports = mongoose.model('Device', deviceSchema);
