// File: routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Device = require('../models/Device');
const FlightSession = require('../models/FlightSession');

// Middleware xác thực admin sẽ được đặt ở đây
// const adminAuth = (req, res, next) => { ... };
// router.use(adminAuth);

// GET: Thống kê tổng quan
router.get('/stats', async (req, res) => {
    const userCount = await User.countDocuments();
    const deviceCount = await Device.countDocuments();
    const flyingCount = await Device.countDocuments({ status: 'Đang bay' });
    const pendingCount = await Device.countDocuments({ isApproved: false });
    res.json({ userCount, deviceCount, flyingCount, pendingCount });
});

// GET: Lấy toàn bộ người dùng
router.get('/users', async (req, res) => {
    const users = await User.find().select('-password'); // Loại bỏ password
    res.json(users);
});

// PUT: Cập nhật người dùng (khóa/mở khóa)
router.put('/users/:id/lock', async (req, res) => {
    const user = await User.findById(req.params.id);
    user.isLocked = !user.isLocked;
    await user.save();
    res.json(user);
});

// GET: Lấy toàn bộ thiết bị
router.get('/devices', async (req, res) => {
    const devices = await Device.find().populate('owner', 'name email'); // Lấy thêm info của owner
    res.json(devices);
});

// PUT: Phê duyệt thiết bị
router.put('/devices/:id/approve', async (req, res) => {
    const device = await Device.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    res.json(device);
});

// PUT: Khóa/Mở khóa thiết bị
router.put('/devices/:id/lock', async (req, res) => {
    const device = await Device.findById(req.params.id);
    device.isLocked = !device.isLocked;
    await device.save();
    res.json(device);
});

// DELETE: Xóa bất kỳ thiết bị nào
router.delete('/devices/:id', async (req, res) => {
    await Device.findByIdAndDelete(req.params.id);
    // Cũng nên xóa các flight session liên quan
    await FlightSession.deleteMany({ deviceId: req.params.id });
    res.json({ message: 'Đã xóa thiết bị và lịch sử bay liên quan.' });
});

module.exports = router;