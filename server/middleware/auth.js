// File: middleware/auth.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = mongoose.model('User');

module.exports = async function(req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ msg: 'Không có token, không được phép truy cập' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ msg: 'Người dùng không tồn tại.' });
        }

        if (user.isLocked) {
            return res.status(403).json({ msg: 'Tài khoản của bạn đã bị khóa.' });
        }
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token không hợp lệ' });
    }
};