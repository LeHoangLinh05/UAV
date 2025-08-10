// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const cron = require('node-cron');
const axios = require('axios');

require('./models');

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const manufacturerRoutes = require('./routes/manufacturer');
const nfzRoutes = require('./routes/nfz');

dotenv.config();
const app = express();
const server = http.createServer(app);

// Cấu hình Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set('socketio', io);

// Cấu hình Middleware
app.use(cors({ origin: '*' })); // CORS nên được đặt trước các route
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const getAddressFromCoordinates = async (lat, lng) => {
    if (!lat || !lng) return 'Tọa độ không hợp lệ';
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=vi`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'UAV-Management-App/1.0' }
        });
        const data = response.data;
        return data?.display_name || 'Không tìm thấy địa chỉ chi tiết';
    } catch (error) {
        console.error('Lỗi khi lấy địa chỉ từ Nominatim:', error.message);
        return 'Lỗi khi lấy địa chỉ';
    }
};


cron.schedule('* * * * *', async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Chạy tác vụ kiểm tra thiết bị mất kết nối...`);

    const Device = mongoose.model('Device');             // ✅ SỬA LỖI 2: Lấy model Device
    const FlightSession = mongoose.model('FlightSession'); // ✅ SỬA LỖI 2: Lấy model FlightSession

    const TIMEOUT_THRESHOLD = 1 * 60 * 1000; // Ngưỡng timeout: 5 phút
    const timeoutDate = new Date(Date.now() - TIMEOUT_THRESHOLD);

    try {
        const inactiveDevices = await Device.find({
            status: 'Đang hoạt động',
            lastHeartbeat: { $lt: timeoutDate }
        });

        if (inactiveDevices.length === 0) return; // Không có gì để làm

        console.log(`Phát hiện ${inactiveDevices.length} thiết bị mất kết nối.`);

        for (const device of inactiveDevices) {
            const session = await FlightSession.findOne({
                deviceId: device._id,
                endTime: { $exists: false }
            });

            if (session) {
                session.endTime = new Date(device.lastHeartbeat.getTime() + 1000); // Thời điểm kết thúc là lúc có tín hiệu cuối cùng
                const duration = Math.round((session.endTime - session.startTime) / 1000);
                session.durationInSeconds = duration;

                const lastPosition = session.path[session.path.length - 1];
                if (lastPosition) {
                    session.endAddress = await getAddressFromCoordinates(lastPosition.lat, lastPosition.lng);
                }
                await session.save();
                console.log(`Đã tự động kết thúc phiên bay ${session._id} cho thiết bị ${device.deviceId}`);
            }

            device.status = 'Không hoạt động';
            await device.save();

            const socketio = app.get('socketio');
            if (socketio) {
                socketio.emit('deviceStatusUpdate', {
                    deviceId: device._id,
                    status: device.status
                });
            }
        }
    } catch (error) {
        console.error('Lỗi trong tác vụ cron:', error);
    }
});


// Đăng ký các API routes
app.use('/api', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/nfz', nfzRoutes);

// Sự kiện Socket.IO
io.on('connection', (socket) => {
    console.log('Một client đã kết nối:', socket.id);
    socket.on('joinRoom', ({ userId, userRole }) => {
        if (userId) {
            socket.join(userId);
            console.log(`[Socket.IO] Client ${socket.id} (User ID: ${userId}) đã tham gia phòng "${userId}".`);
        }
        if (userRole === 'admin') {
            socket.join('admins');
            console.log(`[Socket.IO] Client ${socket.id} (Role: ${userRole}) đã tham gia phòng "admins".`);
        }
    });
    socket.on('admin:sendMessageToUser', ({ targetUserId, message, deviceName, zoneName }) => {
        io.to(targetUserId).emit('admin:messageReceived', {
            sender: 'Quản trị viên',
            message,
            deviceName,
            zoneName,
            timestamp: new Date()
        });
        console.log(`Admin đã gửi tin nhắn đến user ${targetUserId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client đã ngắt kết nối:', socket.id);
    });
});



mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB connected');
        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            console.log(`Server đang chạy trên cổng ${PORT}`);
        });
    })
    .catch(err => console.error(err));