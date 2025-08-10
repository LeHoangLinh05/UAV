# 🚀 Hệ thống Quản lý Thiết bị bay không người lái

## ✨ Tính năng chính
### Dành cho Người dùng (User)
*   ✅ Xác thực người dùng (Đăng ký / Đăng nhập).
*   ✅ Quản lý hồ sơ: Thay đổi tên, mật khẩu, ảnh đại diện.
*   ✅ Quản lý thiết bị (CRUD): Thêm, xem, sửa, xóa các thiết bị của mình.
*   🗺️ Xem vị trí thiết bị trên bản đồ theo thời gian thực.
*   📜 Xem lại lịch sử các chuyến bay đã thực hiện.
*   ⚠️ Nhận cảnh báo tự động khi vi phạm Vùng cấm bay.

### Dành cho Quản trị viên (Admin)
*   📊 Bảng điều khiển tổng quan với các số liệu thống kê.
*   🌐 Bản đồ giám sát toàn cục, hiển thị tất cả thiết bị và Vùng cấm bay.
*   👤 Quản lý người dùng: Xem danh sách, khóa/mở khóa tài khoản.
*   🚁 Quản lý thiết bị: Xem, lọc theo trạng thái, khóa/mở khóa bất kỳ thiết bị nào.
*   🚫 Quản lý Vùng cấm bay (CRUD): Vẽ, sửa, xóa các vùng cấm trực tiếp trên bản đồ.
*   🚨 Nhận thông báo vi phạm thời gian thực và đã gửi cảnh báo tự động.

## 🛠️ Áp dụng 
*   **Frontend:** React, Vite, Axios, Socket.IO Client, Leaflet, React-Leaflet-Draw
*   **Backend:** Node.js, Express, MongoDB, Mongoose, Socket.IO, JSON Web Token (JWT)

---

## ⚙️ Cài đặt và Khởi chạy

### Yêu cầu
*   **Node.js**: phiên bản 16+
*   **MongoDB**: Đã cài đặt và đang chạy trên máy, hoặc có chuỗi kết nối từ MongoDB Atlas.
*   **Git**

### 1. Cài đặt API Server

```bash
git clone <URL_REPO_BACKEND> server
cd server
npm install
```

```bash
node server.js
```

### 2. Cài đặt Giao diện React + Vite
```bash
git clone <URL_REPO_FRONTEND> client
cd client
npm install
npm run dev
```
➡️ Giao diện người dùng sẽ chạy tại `http://localhost:5173` (hoặc một cổng khác do Vite chỉ định trong terminal).

