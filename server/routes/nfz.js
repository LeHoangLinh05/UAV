// backend/routes/nfz.js
const express = require('express');
const router = express.Router();
const NoFlyZone = require('../models/NoFlyZone');
const authMiddleware = require('../middleware/auth');

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Yêu cầu quyền Quản trị viên' });
    }
};

router.get('/all', authMiddleware, adminOnly, async (req, res) => {
    try {
        const zones = await NoFlyZone.find().sort({ createdAt: -1 });
        res.json(zones);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.get('/', async (req, res) => {
    try {
        const zones = await NoFlyZone.find({ isActive: true });
        res.json(zones);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

router.post('/', authMiddleware, adminOnly, async (req, res) => {
    try {
        const newZone = new NoFlyZone(req.body);
        await newZone.save();
        res.status(201).json(newZone);
    } catch (err) {
        res.status(400).json({ error: 'Không thể tạo vùng cấm', details: err.message });
    }
});

router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const updatedZone = await NoFlyZone.findByIdAndUpdate(
            req.params.id,
            { name, description, isActive },
            { new: true } // Trả về document đã được cập nhật
        );
        if (!updatedZone) return res.status(404).json({ error: 'Không tìm thấy vùng cấm' });
        res.json(updatedZone);
    } catch (err) {
        res.status(400).json({ error: 'Không thể cập nhật vùng cấm', details: err.message });
    }
});


router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        await NoFlyZone.findByIdAndDelete(req.params.id);
        res.json({ message: 'Đã xóa vùng cấm' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi server' });
    }
});

module.exports = router;