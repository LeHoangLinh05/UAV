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
    },

    owner: { // Lưu ID của người dùng sở hữu thiết bị này
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isApproved: { // Trạng thái phê duyệt
        type: Boolean,
        default: false
    },
    isLocked: { // Trạng thái bị khóa
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Device', deviceSchema);
