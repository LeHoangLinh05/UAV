import { useState } from 'react';
import axios from 'axios';
import React from 'react';
import './App.css';
import DashboardUser from './DashboardUser'; // 👈 import dashboard
import 'leaflet/dist/leaflet.css';


export default function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await axios.post('http://localhost:5000/api/login', {
          email: form.email,
          password: form.password
        });
        // alert(`Đăng nhập thành công. Xin chào ${res.data.user.name}`);
        setUser(res.data.user);
        setIsLoggedIn(true); // 👈 chuyển sang dashboard
      } else {
        await axios.post('http://localhost:5000/api/register', form);
        alert('Đăng ký thành công!');
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.msg || 'Lỗi');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
  };

  const handleUserUpdate = (updatedUserData) => {
    setUser(prevUser => ({ ...prevUser, ...updatedUserData }));
  };

  // 👉 Nếu đã login thì render DashboardUser
  if (isLoggedIn) {
    return <DashboardUser
              user={user}
              onLogout={handleLogout}
              onUserUpdate={handleUserUpdate}
           />;
  }

  // Màn hình đăng nhập/đăng ký
  return (
    <div className="app-container">
      <video autoPlay loop muted className="background-video">
        <source src="/videos/bg.mp4" type="video/mp4" />
        Trình duyệt của bạn không hỗ trợ video.
      </video>

      <div className="form-overlay">
        <h1>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</h1>
        <form onSubmit={handleSubmit}>
          <input
            name="email"
            type="email"
            placeholder="Email"
            onChange={handleChange}
          />
          <input
            name="password"
            type="password"
            placeholder="Mật khẩu"
            onChange={handleChange}
          />
          {!isLogin && (
            <>
              <input name="name" placeholder="Tên" onChange={handleChange} />
              <select name="role" value={form.role} onChange={handleChange}>
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </>
          )}
          <button type="submit">{isLogin ? 'Đăng nhập' : 'Đăng ký'}</button>
        </form>
        <p>
          {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="toggle-button"
          >
            {isLogin ? 'Đăng ký' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  );
}
