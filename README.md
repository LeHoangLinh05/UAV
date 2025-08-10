Yêu cầu:
Node.js (v16+) & npm
MongoDB (đang chạy local hoặc có chuỗi kết nối từ Atlas)
Git

1. Cài đặt Backend (API Server)
# Tải mã nguồn về thư mục "server"
git clone <URL_REPO_BACKEND> server
cd server
# Cài đặt thư viện
npm install
# Tạo file .env và cấu hình MONGO_URI, JWT_SECRET
# Khởi chạy server
node server.js
2. Cài đặt Frontend (Giao diện React + Vite)
# Tải mã nguồn về thư mục "client"
git clone <URL_REPO_FRONTEND> client
cd client
# Cài đặt thư viện
npm install
# Khởi chạy server phát triển
npm run dev
➡️ Giao diện người dùng sẽ chạy tại http://localhost:5173 (hoặc một cổng khác do Vite chỉ định).
