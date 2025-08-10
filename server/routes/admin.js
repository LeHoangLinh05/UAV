// File: routes/admin.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');


const User = mongoose.model('User');
const Device = mongoose.model('Device');
const FlightSession = mongoose.model('FlightSession');

const auth = require('../middleware/auth');

router.use(auth);

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

router.get('/users', async (req, res) => {
    try {
        const adminId = req.user._id;
        const users = await User.find({ _id: { $ne: adminId } }).select('-password');

        res.json(users);
    } catch (err) {
        console.error("Lỗi khi lấy danh sách người dùng:", err);
        res.status(500).json({ msg: 'Lỗi server' });
    }
});

router.put('/users/:id/lock', async (req, res) => {
    try {
        if (req.user._id.equals(req.params.id)) {
            return res.status(400).json({ msg: 'Bạn không thể thực hiện hành động này với tài khoản của chính mình.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ msg: 'Không tìm thấy người dùng.' });

        user.isLocked = !user.isLocked;
        await user.save();
        res.json(user);
    } catch (err) {
        res.status(500).json({ msg: 'Lỗi server khi cập nhật người dùng' });
    }
});

router.get('/devices', async (req, res) => {
    try {
        const devices = await Device.find().populate('owner', 'name email');
        res.json(devices);
    } catch (err) {
        res.status(500).json({ msg: 'Lỗi server khi lấy danh sách thiết bị' });
    }
});

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

router.get('/users/:id/history', async (req, res) => {
    try {
        const userId = req.params.id;
        const userDevices = await Device.find({ owner: userId }).select('_id');
        if (!userDevices || userDevices.length === 0) {
            return res.json([]);
        }
        const deviceIds = userDevices.map(d => d._id);
        const flightHistory = await FlightSession.find({
            deviceId: { $in: deviceIds }
        })
            .populate('deviceId', 'name')
            .sort({ startTime: -1 });

        res.json(flightHistory);

    } catch (err) {
        console.error("Lỗi khi lấy lịch sử bay của người dùng:", err);
        res.status(500).json({ msg: 'Lỗi server' });
    }
});

module.exports = router;