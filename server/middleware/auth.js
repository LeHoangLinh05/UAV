// File: middleware/auth.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose'); // ✅ Import mongoose
const User = mongoose.model('User'); // ✅ Lấy model từ mongoose

module.exports = async function(req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ msg: 'Không có token, không được phép truy cập' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Dùng findById để đảm bảo trả về một instance Mongoose đầy đủ
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ msg: 'Người dùng không tồn tại.' });
        }

        if (user.isLocked) {
            return res.status(403).json({ msg: 'Tài khoản của bạn đã bị khóa.' });
        }

        // Gán toàn bộ user object vào req, nhưng chỉ chứa các thông tin an toàn
        // Hoặc đơn giản là gán lại decoded object như cũ
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token không hợp lệ' });
    }
};