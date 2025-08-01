// src/DashboardUser.jsx

import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from './api';

// --- Phần thiết lập icon Leaflet không đổi ---
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Các hàm và state khác không đổi...
// ... (Giữ nguyên toàn bộ phần code từ đầu file cho đến trước component return) ...

export default function DashboardUser({ user, onLogout, onUserUpdate}) {
    // --- Toàn bộ state và các hàm useEffect, handle... giữ nguyên như cũ ---
    const [showAddModal, setShowAddModal] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [newDevice, setNewDevice] = useState({ name: '', lat: '', lng: '', image: '' });
    const [activeSimulations, setActiveSimulations] = useState({});
    const [viewingFlight, setViewingFlight] = useState(null);
    const [allFlightHistory, setAllFlightHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('devices');
    const [deviceView, setDeviceView] = useState('approved');
    const [username, setUsername] = useState(user?.name || '');
    const [passwords, setPasswords] = useState({ current: '', new: '' });

    useEffect(() => {
        api.get('/devices')
            .then(res => {
                const devicesData = res.data;
                setDevices(devicesData);
                if (devicesData.length === 0) return;
                const historyPromises = devicesData.map(device => api.get(`/devices/${device._id}/history`));
                Promise.all(historyPromises)
                    .then(results => {
                        const allFlights = results.flatMap(result => result.data);
                        allFlights.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                        setAllFlightHistory(allFlights);
                    })
                    .catch(historyErr => console.error("Lỗi khi tải lịch sử bay:", historyErr));
            })
            .catch(err => console.error('Lỗi nghiêm trọng khi tải danh sách thiết bị:', err.response || err));
    }, []);

    const simulateMovement = (lat, lng) => {
        const latOffset = (Math.random() - 0.5) * 0.002;
        const lngOffset = (Math.random() - 0.5) * 0.002;
        return { lat: lat + latOffset, lng: lng + lngOffset };
    };

    const handleStartFlight = async (deviceId) => {
        try {
            const res = await api.post(`/devices/${deviceId}/start`);
            const { device, session } = res.data;
            setActiveSimulations(prevSims => ({
                ...prevSims,
                [deviceId]: { intervalId: null, sessionId: session._id, path: [device.location] }
            }));
            setDevices(prev => prev.map(d => d._id === deviceId ? { ...d, status: 'Đang bay' } : d));
            const intervalId = setInterval(() => {
                let newLocation = null;
                setActiveSimulations(currentSims => {
                    const currentSim = currentSims[deviceId];
                    if (!currentSim) {
                        clearInterval(intervalId);
                        return currentSims;
                    }
                    const lastPosition = currentSim.path[currentSim.path.length - 1];
                    newLocation = simulateMovement(lastPosition.lat, lastPosition.lng);
                    return { ...currentSims, [deviceId]: { ...currentSim, path: [...currentSim.path, newLocation] } };
                });
                setDevices(currentDevices => currentDevices.map(d => d._id === deviceId && newLocation ? { ...d, location: newLocation } : d));
            }, 2000);
            setActiveSimulations(prevSims => ({ ...prevSims, [deviceId]: { ...prevSims[deviceId], intervalId: intervalId } }));
        } catch (err) {
            alert(err.response?.data?.error || 'Lỗi khi bắt đầu bay');
        }
    };

    const handleStopFlight = async (deviceId) => {
        const simulation = activeSimulations[deviceId];
        if (simulation && simulation.intervalId) {
            clearInterval(simulation.intervalId);
        }
        const deviceToUpdate = devices.find(d => d._id === deviceId);
        if (!deviceToUpdate) {
            alert('Lỗi: Không tìm thấy thông tin thiết bị trên giao diện. Vui lòng thử tải lại trang.');
            return;
        }
        try {
            const payload = simulation ? { path: simulation.path, location: deviceToUpdate.location } : {};
            await api.post(`/devices/${deviceId}/stop`, payload);
            alert('Chuyến bay đã kết thúc và được lưu lại.');
            const res = await api.get(`/devices`);
            setDevices(res.data);
            const newSims = { ...activeSimulations };
            delete newSims[deviceId];
            setActiveSimulations(newSims);
        } catch (err) {
            console.error('Lỗi khi gọi API dừng bay:', err);
            alert(err.response?.data?.error || 'Lỗi từ server khi dừng bay');
            const res = await api.get(`/devices`);
            setDevices(res.data);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) {
            try {
                await api.delete(`/devices/${id}`);
                setDevices(devices.filter(d => d._id !== id));
            } catch (err) {
                console.error('Lỗi khi xóa:', err);
                alert('Không thể xóa thiết bị.');
            }
        }
    };

    const handleAddDevice = async (e) => {
        e.preventDefault();
        if (!newDevice.name || !newDevice.lat || !newDevice.lng) {
            alert("Vui lòng điền đầy đủ tên và tọa độ.");
            return;
        }
        try {
            const formData = new FormData();
            formData.append('name', newDevice.name);
            formData.append('lat', newDevice.lat);
            formData.append('lng', newDevice.lng);
            if (newDevice.image) formData.append('image', newDevice.image);
            await api.post('/devices', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            alert('Đã gửi yêu cầu thêm thiết bị. Vui lòng chờ quản trị viên phê duyệt.');
            const updatedDevicesResponse = await api.get('/devices');
            setDevices(updatedDevicesResponse.data);
            setNewDevice({ name: '', lat: '', lng: '', image: '' });
            setShowAddModal(false);
            setDeviceView('pending');
        } catch (err) {
            console.error('Lỗi chi tiết khi thêm thiết bị:', err.response || err);
            alert(err.response?.data?.error || 'Đã có lỗi xảy ra.');
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

    const approvedDevices = devices.filter(d => d.isApproved);
    const pendingDevices = devices.filter(d => !d.isApproved);

    return (
        <div className="dashboard-layout">
            {/* --- Sidebar và Main Content giữ nguyên như cũ --- */}
            <div className="sidebar">
                <div className="user-info">
                    <label htmlFor="avatar-upload">
                        <img src={`http://localhost:5000${user.avatar}`} alt="avatar" className="avatar" />
                    </label>
                    <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                    <div className="username">{user?.name || 'Người dùng'}</div>
                </div>
                <nav className="menu-vertical">
                    <button className={activeTab === 'devices' ? 'active' : ''} onClick={() => setActiveTab('devices')}>Thiết bị bay của tôi</button>
                    <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>Lịch sử bay</button>
                    <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Cài đặt</button>
                    <button onClick={onLogout} className="logout-button">Đăng xuất</button>
                </nav>
            </div>
            <div className="main-content">
                {activeTab === 'devices' && (
                    <>
                        <h2>Thiết bị bay</h2>
                        <div className="sub-tabs">
                            <button onClick={() => setDeviceView('approved')} className={deviceView === 'approved' ? 'active' : ''}>
                                Đã duyệt ({approvedDevices.length})
                            </button>
                            <button onClick={() => setDeviceView('pending')} className={deviceView === 'pending' ? 'active' : ''}>
                                Chờ duyệt ({pendingDevices.length})
                            </button>
                        </div>
                        {deviceView === 'approved' && (
                            <div className="device-list">
                                {approvedDevices.map((device) => (
                                    <div key={device._id} className="device-card">
                                        <img src={`http://localhost:5000${device.image}`} alt={device.name} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }} />
                                        <h3>{device.name}</h3>
                                        <p><strong>Trạng thái:</strong> {device.isLocked ? 'Bị khóa' : device.status}</p>
                                        <p><strong>Vị trí:</strong> {device.location?.lat}, {device.location?.lng}</p>
                                        <div className="card-actions">
                                            {/* // CHANGED: Xóa viewingFlight khi chỉ xem vị trí */}
                                            <button onClick={() => { setSelectedDevice(device); setViewingFlight(null); }}>Vị trí</button>
                                            {device.status === 'Đang bay' ? (
                                                <button onClick={() => handleStopFlight(device._id)} className="danger" disabled={device.isLocked}>Ngừng bay</button>
                                            ) : (
                                                <button onClick={() => handleStartFlight(device._id)} disabled={device.isLocked}>Bắt đầu bay</button>
                                            )}
                                            <button onClick={() => handleDelete(device._id)} className="danger">Xóa</button>
                                        </div>
                                    </div>
                                ))}
                                <div className="device-card add-card" onClick={() => setShowAddModal(true)}>
                                    <div className="plus-icon">＋</div>
                                    <p>Thêm thiết bị</p>
                                </div>
                            </div>
                        )}
                        {deviceView === 'pending' && (
                            <div className="device-list">
                                {pendingDevices.length === 0 && <p>Không có thiết bị nào đang chờ phê duyệt.</p>}
                                {pendingDevices.map((device) => (
                                    <div key={device._id} className="device-card">
                                        <img src={`http://localhost:5000${device.image}`} alt={device.name} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }} />
                                        <h3>{device.name}</h3>
                                        <p><strong>Trạng thái:</strong> Chờ phê duyệt</p>
                                        <p style={{ color: '#888' }}><i>Vị trí ban đầu: {device.location?.lat}, {device.location?.lng}</i></p>
                                        <div className="card-actions">
                                            <button onClick={() => handleDelete(device._id)} className="danger">Hủy yêu cầu</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
                                                <button onClick={() => { if (device) { setViewingFlight(flight); setSelectedDevice(device); } else { alert("Không thể xem lại vì thiết bị này đã bị xóa."); } }} disabled={!device}>
                                                    Xem lại hành trình
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p>Chưa có chuyến bay nào được ghi lại.</p>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'settings' && (
                    <div className="settings-tab">
                        {/* Phần cài đặt không thay đổi */}
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
                    {/* ... */}
                </div>
            )}
        </div>
    );
}