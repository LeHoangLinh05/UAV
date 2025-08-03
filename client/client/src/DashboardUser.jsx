import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import './Dashboard.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from './api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function DashboardUser({ user, onLogout, onUserUpdate }) {
    // --- STATE ---
    const [devices, setDevices] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [newDevice, setNewDevice] = useState({ name: '', deviceId: '', modelId: '', image: null });
    const [activeTab, setActiveTab] = useState('devices');
    const [allFlightHistory, setAllFlightHistory] = useState([]);
    const [viewingFlight, setViewingFlight] = useState(null);
    const [username, setUsername] = useState(user?.name || '');
    const [passwords, setPasswords] = useState({ current: '', new: '' });
    const [manufacturers, setManufacturers] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedManufacturer, setSelectedManufacturer] = useState('');
    const [historyFetched, setHistoryFetched] = useState(false);

    // useEffect chính để fetch dữ liệu ban đầu và lắng nghe WebSocket
    useEffect(() => {
        let isMounted = true;
        api.get('/devices').then(res => {
            if (isMounted) setDevices(res.data);
        }).catch(err => console.error("Lỗi tải thiết bị:", err));

        const socket = io("http://localhost:5000");
        const handleLocationUpdate = (data) => {
            setDevices(prev => prev.map(d => d._id === data.deviceId ? { ...d, location: data.location, status: data.status } : d));
        };
        const handleStatusUpdate = (data) => {
            setDevices(prev => prev.map(d => d._id === data.deviceId ? { ...d, status: data.status } : d));
        };

        socket.on('deviceLocationUpdate', handleLocationUpdate);
        socket.on('deviceStatusUpdate', handleStatusUpdate);

        return () => {
            isMounted = false;
            socket.off('deviceLocationUpdate', handleLocationUpdate);
            socket.off('deviceStatusUpdate', handleStatusUpdate);
            socket.disconnect();
        };
    }, []);

    // useEffect để fetch lịch sử khi người dùng chuyển tab
    useEffect(() => {
        if (activeTab === 'history' && !historyFetched) {
            const fetchAllHistory = async () => {
                try {
                    const deviceIds = devices.map(d => d._id);
                    const historyPromises = deviceIds.map(id => api.get(`/devices/${id}/history`));
                    const results = await Promise.all(historyPromises);
                    const allFlights = results.flatMap(result => result.data);
                    allFlights.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                    setAllFlightHistory(allFlights);
                    setHistoryFetched(true);
                } catch (err) {
                    console.error("Lỗi khi tải lịch sử bay:", err);
                }
            };
            fetchAllHistory();
        }
    }, [activeTab, devices, historyFetched]);

    // Các hàm xử lý modal và form
    const handleOpenAddModal = () => {
        setNewDevice({ name: '', deviceId: '', modelId: '', image: null });
        setSelectedManufacturer('');
        setModels([]);
        setShowAddModal(true);
    };

    useEffect(() => {
        if (showAddModal) api.get('/manufacturers').then(res => setManufacturers(res.data));
    }, [showAddModal]);

    useEffect(() => {
        if (selectedManufacturer) {
            setModels([]);
            setNewDevice(prev => ({ ...prev, modelId: '' }));
            api.get(`/manufacturers/${selectedManufacturer}/models`).then(res => setModels(res.data));
        }
    }, [selectedManufacturer]);

    const handleAddDevice = async (e) => {
        e.preventDefault();
        const { name, deviceId, modelId, image } = newDevice;
        if (!modelId || !name || !deviceId) {
            alert("Vui lòng điền đầy đủ tất cả các trường bắt buộc.");
            return;
        }
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('deviceId', deviceId);
            formData.append('modelId', modelId);
            if (image) formData.append('image', image);
            const res = await api.post('/devices', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setDevices(prev => [...prev, res.data]);
            alert('Đăng ký thiết bị thành công!');
            setShowAddModal(false);
        } catch (err) {
            alert(err.response?.data?.error || 'Lỗi khi đăng ký thiết bị.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) {
            try {
                await api.delete(`/devices/${id}`);
                setDevices(devices.filter(d => d._id !== id));
            } catch (err) {
                alert('Không thể xóa thiết bị.');
            }
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Kích thước ảnh quá lớn (tối đa 5MB)');
            return;
        }
        const formData = new FormData();
        formData.append('avatar', file);
        try {
            const res = await api.put(`/users/${user._id}/avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            onUserUpdate(res.data);
        } catch (err) {
            console.error('Lỗi khi cập nhật avatar:', err);
            alert('Không thể cập nhật avatar.');
        }
    };
    //
    // useEffect(() => {
    //     if (showAddModal) {
    //         api.get('/manufacturers').then(res => setManufacturers(res.data));
    //     }
    // }, [showAddModal]);
    //
    // // Khi chọn hãng, fetch danh sách model
    // useEffect(() => {
    //     if (selectedManufacturer) {
    //         setModels([]);
    //         setNewDevice(prev => ({ ...prev, modelId: '' }));
    //         api.get(`/manufacturers/${selectedManufacturer}/models`).then(res => setModels(res.data));
    //     }
    // }, [selectedManufacturer]);



    const approvedDevices = devices.filter(d => d.isApproved);
    const pendingDevices = devices.filter(d => !d.isApproved);

    return (
        <div className="dashboard-layout">
            <div className="sidebar">
                <div className="user-info">
                    <label htmlFor="avatar-upload">
                        <img
                            src={`http://localhost:5000${user.avatar}`}
                            alt="avatar"
                            className="avatar"
                        />
                    </label>
                    <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        style={{ display: 'none' }}
                    />
                    <div className="username">{user?.name || 'Người dùng'}</div>
                </div>
                <nav className="menu-vertical">
                    <button className={activeTab === 'devices' ? 'active' : ''} onClick={() => setActiveTab('devices')}>Thiết bị của tôi</button>
                    <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>Lịch sử bay</button>
                    <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Cài đặt</button>
                    <button onClick={onLogout} className="logout-button">Đăng xuất</button>
                </nav>
            </div>
            <div className="main-content">
                {activeTab === 'devices' && (
                    <>
                        <h2>Thiết bị của tôi</h2>
                        <div className="device-list">
                            {devices.map((device) => (
                                <div key={device._id} className="device-card">
                                    <img src={`http://localhost:5000${device.image}`} alt={device.name} />
                                    <h3>{device.name}</h3>
                                    <p><strong>Trạng thái:</strong> {device.isLocked ? 'Bị khóa' : device.status}</p>
                                    {device.location?.lat ? (
                                        <p><strong>Vị trí:</strong> {device.location.lat.toFixed(4)}, {device.location.lng.toFixed(4)}</p>
                                    ) : (
                                        <p><strong>Vị trí:</strong> <i>Chưa có tín hiệu</i></p>
                                    )}
                                    <div className="card-actions">
                                        <button onClick={() => { setSelectedDevice(device); setViewingFlight(null); }} disabled={!device.location?.lat}>Xem vị trí</button>
                                        <button onClick={() => handleDelete(device._id)} className="danger">Xóa</button>
                                    </div>
                                </div>
                            ))}
                            <div className="device-card add-card" onClick={handleOpenAddModal}>
                                <div className="plus-icon">＋</div>
                                <p>Thêm thiết bị</p>
                            </div>
                        </div>
                    </>
                )}
                {activeTab === 'history' && (
                    <div className="history-tab">
                        <h2>Lịch sử các chuyến bay</h2>
                        <div className="history-list">
                            {allFlightHistory.length > 0 ? (
                                allFlightHistory.map(flight => {
                                    const device = devices.find(d => d._id === flight.deviceId);
                                    return (
                                        <div key={flight._id} className="history-item">
                                            <div className="history-item-info">
                                                <h3>{device ? device.name : 'Thiết bị đã xóa'}</h3>
                                                <p><strong>Từ:</strong> {flight.startAddress}</p>
                                                <p><strong>Đến:</strong> {flight.endAddress}</p>
                                                <p><strong>Thời gian bay:</strong> {flight.durationInSeconds} giây</p>
                                                <p style={{ fontSize: '0.8rem', color: '#95a5a6' }}>{new Date(flight.startTime).toLocaleString('vi-VN')}</p>
                                            </div>
                                            <div className="history-item-actions">
                                                <button onClick={() => { if (device) { setViewingFlight(flight); setSelectedDevice(device); } else { alert("Không thể xem lại vì thiết bị này đã bị xóa."); } }} disabled={!device}>Xem lại hành trình</button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p>{historyFetched ? "Chưa có chuyến bay nào được ghi lại." : "Đang tải lịch sử..."}</p>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'settings' && (
                    <div className="settings-tab">
                        <h2>Cài đặt tài khoản</h2>

                        {/* --- Card Đổi tên người dùng --- */}
                        <div className="settings-card">
                            <h3>Thông tin cá nhân</h3>
                            <p className="card-description">Tên này sẽ được hiển thị trên hồ sơ của bạn.</p>
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    try {
                                        const res = await api.put(`/users/${user._id}`, { name: username });
                                        onUserUpdate(res.data);
                                        alert('Đã cập nhật tên người dùng');
                                    } catch (err) {
                                        alert('Lỗi khi cập nhật tên');
                                        console.error(err);
                                    }
                                }}
                            >
                                <label htmlFor="username-input">Tên hiển thị</label>
                                <input
                                    id="username-input"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nhập tên mới của bạn"
                                />
                                <div className="form-actions">
                                    <button type="submit">Lưu thay đổi</button>
                                </div>
                            </form>
                        </div>

                        {/* --- Card Đổi mật khẩu --- */}
                        <div className="settings-card">
                            <h3>Bảo mật</h3>
                            <p className="card-description">Để tăng cường bảo mật, hãy chọn một mật khẩu mạnh và duy nhất.</p>
                            <form
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (!passwords.current || !passwords.new) {
                                        alert("Vui lòng nhập đầy đủ mật khẩu.");
                                        return;
                                    }
                                    try {
                                        await api.put(`/users/${user._id}/password`, passwords);
                                        alert('Đổi mật khẩu thành công');
                                        setPasswords({ current: '', new: '' });
                                    } catch (err)
                                    {
                                        alert(err.response?.data?.error || 'Lỗi khi đổi mật khẩu');
                                        console.error(err);
                                    }
                                }}
                            >
                                <label htmlFor="current-password">Mật khẩu hiện tại</label>
                                <input
                                    id="current-password"
                                    type="password"
                                    value={passwords.current}
                                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                                    placeholder="••••••••"
                                />

                                <label htmlFor="new-password">Mật khẩu mới</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                    placeholder="••••••••"
                                />
                                <div className="form-actions">
                                    <button type="submit">Đổi mật khẩu</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* -------------------- SECTION THAY ĐỔI CHÍNH -------------------- */}
            {/* Modal bản đồ được nâng cấp toàn diện */}
            {selectedDevice && (
                <div className="map-modal">
                    <div className="map-content">
                        <h3>{selectedDevice.name} - {viewingFlight ? 'Lịch sử chuyến bay' : 'Vị trí hiện tại'}</h3>
                        <MapContainer
                            key={selectedDevice._id + (viewingFlight ? viewingFlight._id : '')}
                            // NEW: Tâm bản đồ động
                            center={
                                viewingFlight && viewingFlight.path.length > 0
                                    ? [viewingFlight.path[0].lat, viewingFlight.path[0].lng] // Lấy tâm là điểm bắt đầu của lịch sử
                                    : [selectedDevice.location.lat, selectedDevice.location.lng] // Lấy tâm là vị trí hiện tại
                            }
                            zoom={15} // Zoom to hơn để thấy rõ
                            style={{ height: '450px', width: '100%' }}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                            {/* --- CASE 1: Đang xem lịch sử chuyến bay --- */}
                            {viewingFlight && viewingFlight.path.length > 0 && (
                                <>
                                    {/* Vẽ đường bay */}
                                    <Polyline
                                        pathOptions={{ color: 'blue', weight: 5 }} // Đường bay đậm hơn
                                        positions={viewingFlight.path.map(p => [p.lat, p.lng])}
                                    />
                                    {/* Marker điểm bắt đầu */}
                                    <Marker position={[viewingFlight.path[0].lat, viewingFlight.path[0].lng]}>
                                        <Popup>
                                            <b>Bắt đầu:</b><br />
                                            {viewingFlight.startAddress}
                                        </Popup>
                                    </Marker>
                                    {/* Marker điểm kết thúc */}
                                    <Marker position={[viewingFlight.path[viewingFlight.path.length - 1].lat, viewingFlight.path[viewingFlight.path.length - 1].lng]}>
                                        <Popup>
                                            <b>Kết thúc:</b><br />
                                            {viewingFlight.endAddress}
                                        </Popup>
                                    </Marker>
                                </>
                            )}

                            {/* --- CASE 2: Đang xem vị trí hiện tại (không có viewingFlight) --- */}
                            {!viewingFlight && (
                                <Marker position={[selectedDevice.location.lat, selectedDevice.location.lng]}>
                                    <Popup>Vị trí hiện tại của {selectedDevice.name}</Popup>
                                </Marker>
                            )}
                        </MapContainer>

                        {/* NEW: Nút đóng sẽ reset cả 2 state */}
                        <button onClick={() => { setSelectedDevice(null); setViewingFlight(null); }} className="close-map">Đóng</button>
                    </div>
                </div>
            )}

            {/* Add Device Modal không đổi */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Đăng ký thiết bị bay mới</h3>
                        <form onSubmit={handleAddDevice}>
                            <p style={{fontSize: '0.9rem', color: '#666', textAlign: 'left', marginBottom: '15px'}}>
                                Chọn hãng, model và nhập mã định danh (S/N) của thiết bị.
                            </p>

                            <select
                                value={selectedManufacturer}
                                onChange={(e) => setSelectedManufacturer(e.target.value)}
                                required
                            >
                                <option value="">-- Chọn hãng sản xuất --</option>
                                {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                            </select>

                            <select
                                value={newDevice.modelId}
                                onChange={(e) => setNewDevice({ ...newDevice, modelId: e.target.value })}
                                required
                                disabled={!selectedManufacturer || models.length === 0}
                            >
                                <option value="">-- Chọn model thiết bị --</option>
                                {models.map(m => <option key={m._id} value={m._id}>{m.modelName}</option>)}
                            </select>

                            <input
                                type="text"
                                placeholder="Tên gợi nhớ (ví dụ: Drone quay phim Vũng Tàu)"
                                value={newDevice.name}
                                onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                                required
                            />

                            <input
                                type="text"
                                placeholder="Mã định danh duy nhất (S/N)"
                                value={newDevice.deviceId}
                                onChange={e => setNewDevice({ ...newDevice, deviceId: e.target.value })}
                                required
                            />

                            <label htmlFor="device-image" style={{textAlign: 'left', display: 'block', marginBottom: '5px'}}>Ảnh đại diện thiết bị</label>
                            <input
                                id="device-image"
                                type="file"
                                accept="image/*"
                                onChange={(e) => setNewDevice({ ...newDevice, image: e.target.files[0] })}
                            />

                            <div className="modal-actions">
                                <button type="submit">Đăng ký</button>
                                <button type="button" onClick={() => setShowAddModal(false)}>Hủy</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );


}