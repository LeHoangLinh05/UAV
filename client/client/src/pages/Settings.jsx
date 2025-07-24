import React, { useState } from 'react';
import axios from 'axios';

const Settings = ({ userId }) => {
    const [newName, setNewName] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleNameChange = async () => {
        try {
            await axios.put('http://localhost:5000/api/user/update-name', {
                userId,
                newName
            });
            setMessage('Đã cập nhật tên thành công');
        } catch (err) {
            setMessage('Lỗi khi cập nhật tên');
        }
    };

    const handlePasswordChange = async () => {
        try {
            await axios.put('http://localhost:5000/api/user/change-password', {
                userId,
                currentPassword,
                newPassword
            });
            setMessage('Đổi mật khẩu thành công');
        } catch (err) {
            setMessage(err.response?.data?.error || 'Lỗi khi đổi mật khẩu');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2>Cài đặt</h2>

            <div>
                <h3>Đổi tên người dùng</h3>
                <input
                    type="text"
                    placeholder="Tên mới"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                />
                <button onClick={handleNameChange}>Cập nhật tên</button>
            </div>

            <div style={{ marginTop: '20px' }}>
                <h3>Đổi mật khẩu</h3>
                <input
                    type="password"
                    placeholder="Mật khẩu hiện tại"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                />
                <button onClick={handlePasswordChange}>Đổi mật khẩu</button>
            </div>

            {message && <p style={{ marginTop: '20px', color: 'green' }}>{message}</p>}
        </div>
    );
};

export default Settings;
