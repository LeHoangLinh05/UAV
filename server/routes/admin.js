// File: routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Sử dụng Mongoose để lấy các model đã được đăng ký

const User = mongoose.model('User');
const Device = mongoose.model('Device');
const FlightSession = mongoose.model('FlightSession');

// Import middleware xác thực
const auth = require('../middleware/auth');

// ✅ ÁP DỤNG MIDDLEWARE CHO TẤT CẢ CÁC ROUTE TRONG FILE NÀY
// Mọi request đến /api/admin/* sẽ phải đi qua middleware 'auth' trước.
// Điều này đảm bảo chúng ta luôn có req.user chứa thông tin của admin.
router.use(auth);


// GET: Thống kê tổng quan
router.get('/stats', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const deviceCount = await Device.countDocuments();
        const activeDeviceCount = await Device.countDocuments({ status: 'Đang hoạt động' });

        res.json({
            userCount,
            deviceCount,
            activeDeviceCount
        });
    } catch (err) {
        res.status(500).json({ msg: 'Lỗi server khi lấy thống kê' });
    }
});


// GET: Lấy toàn bộ người dùng, TRỪ chính admin đang đăng nhập
router.get('/users', async (req, res) => {
    try {
        const adminId = req.user._id; // Lấy ID của admin từ token (nhờ middleware 'auth')

        // Tìm tất cả user có _id KHÁC ($ne) với ID của admin
        const users = await User.find({ _id: { $ne: adminId } }).select('-password');

        res.json(users);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách người dùng:", err);
        res.status(500).json({ msg: 'Lỗi server' });
    }
});


// PUT: Cập nhật người dùng (khóa/mở khóa)
router.put('/users/:id/lock', async (req, res) => {
    try {
        // Kiểm tra để admin không thể tự khóa chính mình (đã có ở frontend nhưng thêm ở đây để an toàn hơn)
        if (req.user._id.equals(req.params.id)) {
            return res.status(400).json({ msg: 'Bạn không thể thực hiện hành động này với tài khoản của chính mình.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'Không tìm thấy người dùng.' });

        user.isLocked = !user.isLocked;
        await user.save();
        res.json(user); // Trả về user đã được cập nhật
    } catch (err) {
        res.status(500).json({ msg: 'Lỗi server khi cập nhật người dùng' });
    }
});


// GET: Lấy toàn bộ thiết bị
router.get('/devices', async (req, res) => {
    try {
        const devices = await Device.find().populate('owner', 'name email');
        res.json(devices);
    } catch (err) {
        res.status(500).json({ msg: 'Lỗi server khi lấy danh sách thiết bị' });
    }
});


// PUT: Khóa/Mở khóa thiết bị
router.put('/devices/:id/lock', async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) return res.status(404).json({ msg: 'Không tìm thấy thiết bị.' });

        device.isLocked = !device.isLocked;
        await device.save();
        res.json(device);
    } catch (err) {
        res.status(500).json({ msg: 'Lỗi server khi cập nhật thiết bị' });
    }
});


// DELETE: Xóa bất kỳ thiết bị nào
router.delete('/devices/:id', async (req, res) => {
    try {
        const device = await Device.findByIdAndDelete(req.params.id);
        if (!device) return res.status(404).json({ msg: 'Không tìm thấy thiết bị.' });

        await FlightSession.deleteMany({ deviceId: req.params.id });
        res.json({ message: 'Đã xóa thiết bị và lịch sử bay liên quan.' });
    } catch (err) {
        res.status(500).json({ msg: 'Lỗi server khi xóa thiết bị' });
    }
});


module.exports = router;