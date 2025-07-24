import { useState } from 'react';
import axios from 'axios';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/register', form);
      alert('Đăng ký thành công!');
    } catch (err) {
      alert(err.response?.data?.msg || 'Lỗi đăng ký');
    }
  };

  return (
    <form onSubmit={handleRegister}>
      <h2>Đăng ký</h2>
      <input name="name" placeholder="Tên" onChange={handleChange} />
      <input name="email" placeholder="Email" onChange={handleChange} />
      <input name="password" type="password" placeholder="Mật khẩu" onChange={handleChange} />
      <select name="role" onChange={handleChange}>
        <option value="user">Người dùng</option>
        <option value="admin">Quản trị viên</option>
      </select>
      <button type="submit">Đăng ký</button>
    </form>
  );
}
