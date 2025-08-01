const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Device = require('../models/Device');
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


router.post('/:id/start', async (req, res) => {
    try {
        const device = await Device.findById(req.params.id);
        if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
        if (device.status === 'Đang bay') return res.status(400).json({ error: 'Thiết bị đã đang bay' });

        // Lấy địa chỉ bắt đầu
        const startAddress = await getAddressFromCoordinates(device.location.lat, device.location.lng);

        const session = new FlightSession({
            deviceId: device._id,
            startTime: new Date(),
            path: [device.location],
            startAddress: startAddress // Lưu địa chỉ
        });
        await session.save();

        device.status = 'Đang bay';
        await device.save();

        res.json({ device, session });
    } catch (err) {
        console.error("Lỗi khi bắt đầu chuyến bay:", err);
        res.status(500).json({ error: 'Không thể bắt đầu chuyến bay' });
    }
});

router.post('/:id/stop', async (req, res) => {
    try {
        const { path, location } = req.body;
        const deviceId = req.params.id;

        // Tìm phiên bay đang hoạt động (chưa có endTime) của thiết bị này
        const session = await FlightSession.findOne({
            deviceId: deviceId,
            endTime: { $exists: false }
        });

        if (!session) {
            // Có thể chuyến bay đã kết thúc ở một tab khác, hoặc có lỗi.
            // Cập nhật lại trạng thái thiết bị cho chắc chắn và báo lỗi nhẹ nhàng.
            await Device.findByIdAndUpdate(deviceId, { status: 'Không hoạt động' });
            return res.status(404).json({ error: 'Không tìm thấy phiên bay đang hoạt động cho thiết bị này.' });
        }

        const device = await Device.findById(deviceId);
        if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });

        // Dữ liệu cuối cùng: ưu tiên dữ liệu từ client, nếu không có thì dùng dữ liệu hiện tại trong DB
        const finalLocation = location || device.location;

        const endTime = new Date();
        const duration = Math.round((endTime - session.startTime) / 1000);
        const endAddress = await getAddressFromCoordinates(finalLocation.lat, finalLocation.lng);

        // Cập nhật session
        session.endTime = endTime;
        session.durationInSeconds = duration;
        session.endAddress = endAddress;
        if (path) { // Chỉ cập nhật path nếu client gửi lên
            session.path = path;
        }
        await session.save();

        // Cập nhật device
        device.status = 'Không hoạt động';
        device.location = finalLocation;
        await device.save();

        res.json({ message: 'Chuyến bay đã kết thúc thành công', device, session });
    } catch (err) {
        console.error("Lỗi khi dừng chuyến bay:", err);
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

router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        // Giờ chúng ta không cần userId từ req.body nữa
        const { name, lat, lng } = req.body;

        // ✅ LẤY USER ID TỪ TOKEN ĐÃ ĐƯỢC GIẢI MÃ
        const userId = req.user.id;

        const newDevice = new Device({
            name,
            location: { lat: parseFloat(lat), lng: parseFloat(lng) },
            image: req.file ? `/uploads/${req.file.filename}` : 'https://via.placeholder.com/150',
            status: 'Không hoạt động',
            owner: userId, // ✅ Gán chủ sở hữu một cách an toàn
            isApproved: false,
            isLocked: false
        });
        const saved = await newDevice.save();
        res.status(201).json(saved);
    } catch (err) {
        console.error("Lỗi tạo thiết bị:", err);
        res.status(500).json({ error: 'Không thể thêm thiết bị' });
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

module.exports = router;
