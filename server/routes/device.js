const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Device = require('../models/Device'); // Cần model Device mới
const FlightSession = require('../models/FlightSession');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

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

const getAddressFromCoordinates = async (lat, lng) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'UAV-Management-App/1.0 (your-email@example.com)' }
        });

        const data = response.data;
        if (data && data.address) {
            const addr = data.address;

            // Xây dựng chuỗi địa chỉ theo thứ tự ưu tiên
            // Ví dụ: "Số nhà, Tên đường, Phường, Quận, Thành phố"
            const addressParts = [
                // Ưu tiên tên địa điểm (nhà hát, tòa nhà...)
                addr.amenity || addr.historic || addr.leisure || addr.shop || addr.tourism || addr.theatre,
                // Số nhà và đường
                addr.house_number,
                addr.road,
                // Đơn vị hành chính nhỏ
                addr.suburb || addr.quarter, // Phường hoặc khu phố
                addr.city_district || addr.county, // Quận hoặc huyện
                addr.city || addr.state, // Thành phố hoặc tỉnh
                addr.country
            ];

            // Lọc ra các phần tử không tồn tại (undefined) và ghép chúng lại
            const formattedAddress = addressParts.filter(part => part).join(', ');

            return formattedAddress || data.display_name; // Nếu không ghép được thì dùng display_name
        }

        // Nếu không có address object, dùng display_name (phòng hờ)
        if (data && data.display_name) {
            return data.display_name;
        }

        return 'Không tìm thấy địa chỉ chi tiết';
    } catch (error) {
        console.error('Lỗi khi lấy địa chỉ từ Nominatim:', error.message);
        return 'Lỗi khi lấy địa chỉ';
    }
};




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

router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { name, deviceId, modelId } = req.body;
        const ownerId = req.user.id;

        if (!name || !deviceId || !modelId) {
            return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin.' });
        }

        const existingDevice = await Device.findOne({ deviceId: deviceId, deviceModel: modelId });
        if (existingDevice) {
            return res.status(400).json({ error: 'Mã định danh (S/N) này đã tồn tại cho model đã chọn.' });
        }

        const newDevice = new Device({
            name,
            deviceId,
            deviceModel: modelId,
            owner: ownerId,
            image: req.file ? `/uploads/${req.file.filename}` : '/uploads/default-device.png',
            // Mongoose sẽ tự động đặt status là 'Chờ kết nối' theo default trong schema
        });

        const savedDevice = await newDevice.save();
        res.status(201).json(savedDevice);
    } catch (err) {
        console.error("Lỗi tạo thiết bị:", err);
        res.status(500).json({ error: 'Không thể thêm thiết bị.' });
    }
});

// ✅ CẬP NHẬT LẠI ROUTE GET CỦA USER
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[BACKEND] GET /devices - Received request from user ID (from token): ${userId}`);

        const devices = await Device.find({ owner: userId });
        res.json(devices);
    } catch (err) {
        console.error("Lỗi lấy danh sách thiết bị của user:", err);
        res.status(500).json({ error: 'Không thể lấy danh sách thiết bị' });
    }
});

router.post('/ingress', async (req, res) => {
    // rawData có thể là JSON, string, XML... tùy thiết bị gửi lên
    const rawData = req.body;

    // 1. Tìm đúng trình phiên dịch
    let parser;
    let tempDeviceId;

    // Phải có một cách sơ bộ để xác định loại dữ liệu, ví dụ dựa trên header hoặc cấu trúc
    if (typeof rawData === 'object' && rawData.serial) {
        parser = djiParser;
        tempDeviceId = rawData.serial;
    } else if (typeof rawData === 'string' && rawData.includes(';')) {
        parser = veeniixParser;
        tempDeviceId = rawData.split(';')[0];
    } else {
        // ... các trường hợp khác
        return res.status(400).send('Unknown device protocol');
    }

    // 2. Lấy thông tin thiết bị từ CSDL dựa trên S/N
    const device = await Device.findOne({ deviceId: tempDeviceId }).populate('deviceModel');
    if (!device) {
        return res.status(404).send('Device not registered');
    }

    // 3. Dùng đúng trình phiên dịch để chuẩn hóa dữ liệu
    const normalizedData = parser.parse(rawData);

    // 4. Cập nhật CSDL với dữ liệu đã được chuẩn hóa
    device.location = normalizedData.location;
    // ... cập nhật các thông tin khác như pin, trạng thái ...
    await device.save();

    // 5. Gửi thông báo qua WebSocket (như cũ)
    const io = req.app.get('socketio');
    io.emit('deviceLocationUpdate', {
        deviceId: device._id, // Gửi _id của Mongo để frontend dễ tìm
        location: device.location
    });

    res.status(200).send('OK');
});

router.post('/location', async (req, res) => {
    try {
        const { deviceId, lat, lng } = req.body;
        if (!deviceId || lat == null || lng == null) {
            return res.status(400).json({ error: 'Thiếu thông tin.' });
        }

        const device = await Device.findOne({ deviceId: deviceId });
        if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });

        const wasInactive = (device.status === 'Không hoạt động' || device.status === 'Chờ kết nối');

        // Cập nhật thông tin cơ bản của thiết bị
        device.location = { lat, lng };
        device.status = 'Đang hoạt động';
        device.lastHeartbeat = new Date();
        await device.save();

        let currentSession;

        if (wasInactive) {
            // --- BẮT ĐẦU CHUYẾN BAY MỚI ---
            console.log(`Bắt đầu chuyến bay mới cho thiết bị ${deviceId}`);
            const startAddress = await getAddressFromCoordinates(lat, lng);
            currentSession = new FlightSession({
                deviceId: device._id,
                startTime: new Date(),
                path: [{ lat, lng }],
                startAddress: startAddress
            });
        } else {
            // --- CẬP NHẬT CHUYẾN BAY HIỆN TẠI ---
            currentSession = await FlightSession.findOne({ deviceId: device._id, endTime: { $exists: false } });
            if (currentSession) {
                currentSession.path.push({ lat, lng });
            } else {
                // Trường hợp hiếm gặp: không tìm thấy session, tạo mới
                const startAddress = await getAddressFromCoordinates(lat, lng);
                currentSession = new FlightSession({
                    deviceId: device._id, startTime: new Date(), path: [{ lat, lng }], startAddress
                });
            }
        }
        await currentSession.save();

        // Gửi tín hiệu WebSocket như cũ
        const io = req.app.get('socketio');
        io.emit('deviceLocationUpdate', {
            deviceId: device._id, location: device.location, status: device.status
        });

        res.json({ message: 'Cập nhật vị trí thành công.' });
    } catch (err) {
        console.error('Lỗi khi cập nhật vị trí GPS:', err);
        res.status(500).json({ error: 'Lỗi server.' });
    }
});

module.exports = router;
