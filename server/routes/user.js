const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const multer = require('multer'); // ✅ Import multer
const path = require('path');     // ✅ Import path
const fs = require('fs');         // ✅ Import fs để xóa file cũ

// ✅ Cấu hình Multer để lưu file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        // Không cần kiểm tra tồn tại thư mục ở đây vì file device.js đã làm rồi
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Tạo tên file duy nhất để tránh trùng lặp
        const uniqueName = `avatar-${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });


// ✅ TẠO ROUTE MỚI ĐỂ UPLOAD AVATAR
// PUT /api/users/:id/avatar
router.put('/:id/avatar', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Vui lòng chọn một file ảnh.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng' });

        const defaultAvatarPath = '/uploads/default-avatar.jpg'; // <-- Lưu đường dẫn mặc định vào một biến

        if (user.avatar && user.avatar !== defaultAvatarPath) {
            const oldAvatarPath = path.join(__dirname, '..', user.avatar);
            if (fs.existsSync(oldAvatarPath)) {
                try {
                    fs.unlinkSync(oldAvatarPath);
                    console.log('Đã xóa avatar cũ:', oldAvatarPath);
                } catch (unlinkErr) {
                    console.error('Không thể xóa avatar cũ:', unlinkErr);
                }
            }
        }

        // Cập nhật đường dẫn avatar mới
        user.avatar = `/uploads/${req.file.filename}`;
        await user.save();

        // Trả về thông tin user đã được cập nhật
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar
        });

    } catch (err) {
        console.error('Lỗi upload avatar:', err);
        res.status(500).json({ error: 'Lỗi server khi upload avatar.' });
    }
});
// Cập nhật tên người dùng
router.put('/:id', async (req, res) => {
    try {
        const { name } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { name },
            { new: true }
        );
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi cập nhật tên người dùng' });
    }
});

// Đổi mật khẩu
router.put('/:id/password', async (req, res) => {
    try {
        const { current, new: newPassword } = req.body;
        const user = await User.findById(req.params.id);

        const isMatch = await bcrypt.compare(current, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Sai mật khẩu hiện tại' });

        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
        await user.save();

        res.json({ message: 'Đổi mật khẩu thành công' });
    } catch (err) {
        res.status(500).json({ error: 'Lỗi khi đổi mật khẩu' });
    }
});

router.use((req, res, next) => {
    console.log('User route hit:', req.method, req.originalUrl);
    next();
});

module.exports = router;
