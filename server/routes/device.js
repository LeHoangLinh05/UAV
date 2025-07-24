const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Device = require('../models/Device');
const FlightSession = require('../models/FlightSession');

// Lưu ảnh vào thư mục "uploads/"
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// GET all devices
router.get('/', async (req, res) => {
    try {
        const devices = await Device.find();
        res.json(devices);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Không thể lấy danh sách thiết bị' });
    }
});

// POST: Add new device
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const { name, lat, lng } = req.body;
        const newDevice = new Device({
            name,
            location: {
                lat: parseFloat(lat),
                lng: parseFloat(lng)
            },
            image: req.file
                ? `/uploads/${req.file.filename}`
                : 'https://via.placeholder.com/150',
            status: 'Không hoạt động'
        });
        const saved = await newDevice.save();
        res.json(saved);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Không thể thêm thiết bị' });
    }
});

// PATCH: Toggle device status
// router.patch('/:id/toggle', async (req, res) => {
//     try {
//         const device = await Device.findById(req.params.id);
//         if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
//
//         device.status = device.status === 'Đang bay' ? 'Không hoạt động' : 'Đang bay';
//         await device.save();
//         res.json(device);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: 'Không thể cập nhật trạng thái' });
//     }
// });

router.post('/:id/start', async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
        if (device.status === 'Đang bay') return res.status(400).json({ error: 'Thiết bị đã đang bay' });

        // Tạo một phiên bay mới
        const session = new FlightSession({
            deviceId: device._id,
            startTime: new Date(),
            path: [device.location] // Điểm bắt đầu là vị trí hiện tại
        });
        await session.save();

        // Cập nhật trạng thái thiết bị
        device.status = 'Đang bay';
        await device.save();

        res.json({ device, session }); // Trả về cả session để frontend có session._id
    } catch (err) {
        res.status(500).json({ error: 'Không thể bắt đầu chuyến bay' });
    }
});

// ✅ TẠO ROUTE MỚI: KẾT THÚC CHUYẾN BAY
// Chúng ta sẽ dùng session ID để cập nhật cho chính xác
router.post('/sessions/:sessionId/stop', async (req, res) => {
    try {
        const { path, location } = req.body; // Frontend sẽ gửi lên đường đi cuối cùng
        const session = await FlightSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: 'Không tìm thấy phiên bay' });

        const endTime = new Date();
        const duration = Math.round((endTime - session.startTime) / 1000); // tính bằng giây

        session.endTime = endTime;
        session.durationInSeconds = duration;
        session.path = path;
        await session.save();

        // Cập nhật lại thiết bị
        const device = await Device.findById(session.deviceId);
        device.status = 'Không hoạt động';
        device.location = location; // Cập nhật vị trí cuối cùng của thiết bị
        await device.save();

        res.json({ device, session });
    } catch (err) {
        res.status(500).json({ error: 'Không thể kết thúc chuyến bay' });
    }
});


// ✅ TẠO ROUTE MỚI: LẤY LỊCH SỬ BAY CỦA 1 THIẾT BỊ
router.get('/:id/history', async (req, res) => {
    try {
        const sessions = await FlightSession.find({ deviceId: req.params.id })
            .sort({ startTime: -1 }); // Sắp xếp mới nhất lên đầu
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: 'Không thể lấy lịch sử bay' });
    }
});

// DELETE device
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Device.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
        res.json({ message: 'Đã xóa thiết bị' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Không thể xóa thiết bị' });
    }
});

module.exports = router;
