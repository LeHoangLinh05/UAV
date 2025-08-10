const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const Device = require('../models/Device'); // Cần model Device mới
const FlightSession = require('../models/FlightSession');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const NoFlyZone = require('../models/NoFlyZone');

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

function getDistance(point1, point2) {
    const R = 6371e3; // Bán kính Trái Đất (mét)
    const φ1 = point1.lat * Math.PI / 180;
    const φ2 = point2.lat * Math.PI / 180;
    const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
    const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function isPointInCircle(point, center, radius) {
    return getDistance(point, center) <= radius;
}

// Hàm kiểm tra điểm trong đa giác (Ray-casting algorithm)
function isPointInPolygon(point, polygon) {
    const { lat, lng } = point;
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}


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

router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { name } = req.body;
        const device = await Device.findById(req.params.id);

        if (!device) {
            return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
        }

        // Kiểm tra quyền sở hữu
        if (device.owner.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Bạn không có quyền sửa thiết bị này' });
        }

        // Cập nhật tên
        if (name) {
            device.name = name;
        }

        // Cập nhật ảnh nếu có file mới được tải lên
        if (req.file) {
            // Xóa ảnh cũ nếu không phải ảnh mặc định
            const defaultImagePath = '/uploads/default-device.png';
            if (device.image && device.image !== defaultImagePath) {
                const oldImagePath = path.join(__dirname, '..', device.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            device.image = `/uploads/${req.file.filename}`;
        }

        const updatedDevice = await device.save();
        res.json(updatedDevice);

    } catch (err) {
        console.error('Lỗi khi cập nhật thiết bị:', err);
        res.status(500).json({ error: 'Lỗi server khi cập nhật thiết bị.' });
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
        // ... code cũ để tìm và cập nhật device, session không đổi ...
        if (!deviceId || lat == null || lng == null) {
            return res.status(400).json({ error: 'Thiếu thông tin.' });
        }

        const device = await Device.findOne({ deviceId: deviceId }).populate('owner', '_id'); // Lấy cả owner id
        if (!device) return res.status(404).json({ error: 'Không tìm thấy thiết bị.' });

        const wasInactive = (device.status === 'Không hoạt động' || device.status === 'Chờ kết nối');

        device.location = { lat, lng };
        device.status = 'Đang hoạt động';
        device.lastHeartbeat = new Date();
        await device.save();

        let currentSession;

        if (wasInactive) {
            const startAddress = await getAddressFromCoordinates(lat, lng);
            currentSession = new FlightSession({ deviceId: device._id, startTime: new Date(), path: [{ lat, lng }], startAddress: startAddress });
        } else {
            currentSession = await FlightSession.findOne({ deviceId: device._id, endTime: { $exists: false } });
            if (currentSession) {
                currentSession.path.push({ lat, lng });
            } else {
                const startAddress = await getAddressFromCoordinates(lat, lng);
                currentSession = new FlightSession({ deviceId: device._id, startTime: new Date(), path: [{ lat, lng }], startAddress });
            }
        }
        await currentSession.save();

        const io = req.app.get('socketio');
        io.emit('deviceLocationUpdate', { deviceId: device._id, location: device.location, status: device.status });


        const zones = await NoFlyZone.find({ isActive: true });
        for (const zone of zones) {
            let isInZone = false;
            const currentPoint = { lat, lng };

            if (zone.shape === 'Circle' && isPointInCircle(currentPoint, zone.center, zone.radius)) {
                isInZone = true;
            } else if (zone.shape === 'Polygon' && isPointInPolygon(currentPoint, zone.path)) {
                isInZone = true;
            }

            if (isInZone) {
                console.log(`CẢNH BÁO: Thiết bị ${device.name} đã đi vào vùng cấm ${zone.name}`);

                // 1. Dữ liệu cảnh báo cho Admin
                const breachDataForAdmin = {
                    deviceName: device.name,
                    deviceId: device._id,
                    ownerName: device.owner?.name || 'Không xác định', // Thêm tên chủ sở hữu
                    zoneName: zone.name,
                    zoneId: zone._id,
                    timestamp: new Date()
                };

                // Gửi cảnh báo đến tất cả admin
                io.to('admins').emit('nfzBreach', breachDataForAdmin);

                // 2. Tự động tạo và gửi tin nhắn cảnh báo đến User
                if (device.owner?._id) {
                    const autoMessage = `Hệ thống tự động phát hiện thiết bị "${device.name}" của bạn đã đi vào vùng cấm bay "${zone.name}". Yêu cầu di chuyển thiết bị ra khỏi khu vực này ngay lập tức để đảm bảo an toàn và tuân thủ quy định.`;

                    const messageDataForUser = {
                        sender: 'Hệ thống tự động',
                        message: autoMessage,
                        deviceName: device.name,
                        zoneName: zone.name,
                        timestamp: new Date()
                    };

                    // Gửi tin nhắn bằng sự kiện 'admin:messageReceived'
                    io.to(device.owner._id.toString()).emit('admin:messageReceived', messageDataForUser);
                    console.log(`Đã tự động gửi cảnh báo đến người dùng ${device.owner.name} (ID: ${device.owner._id})`);
                }

                // Chúng ta chỉ cần cảnh báo một lần cho vị trí hiện tại nên dùng break
                break;
            }
        }

        res.json({ message: 'Cập nhật vị trí thành công.' });
    } catch (err) {
        console.error('Lỗi khi cập nhật vị trí GPS:', err);
        res.status(500).json({ error: 'Lỗi server.' });
    }
});

module.exports = router;
