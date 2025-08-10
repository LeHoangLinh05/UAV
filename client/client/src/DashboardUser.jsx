import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import './UserDashboard.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from './api';
import { toast } from 'react-toastify';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function DashboardUser({ user, onLogout, onUserUpdate }) {
    // --- STATE ---
    const [noFlyZones, setNoFlyZones] = useState([]);
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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const [editingDevice, setEditingDevice] = useState(null); // Lưu thông tin thiết bị đang sửa
    const [showEditModal, setShowEditModal] = useState(false);

    // useEffect chính để fetch dữ liệu ban đầu và lắng nghe WebSocket
    useEffect(() => {
        let isMounted = true;
        api.get('/devices').then(res => {
            if (isMounted) setDevices(res.data);
        }).catch(err => console.error("Lỗi tải thiết bị:", err));
        api.get('/nfz').then(res => { if (isMounted) setNoFlyZones(res.data); });
        const socket = io("http://localhost:5000");
        socket.emit('joinRoom', { userId: user._id, userRole: user.role });
        const handleLocationUpdate = (data) => {
            setDevices(prev => prev.map(d => d._id === data.deviceId ? { ...d, location: data.location, status: data.status } : d));
        };
        const handleStatusUpdate = (data) => {
            setDevices(prev => prev.map(d => d._id === data.deviceId ? { ...d, status: data.status } : d));
        };
        const handleNfzBreach = (data) => {
            toast.warn(`CẢNH BÁO: Thiết bị ${data.deviceName} của bạn đã đi vào vùng cấm ${data.zoneName}!`, { autoClose: 10000 });
        };
        const handleAdminMessage = (data) => {
            toast.info(<div><h4>Tin nhắn từ Quản trị viên</h4><p>{data.message}</p></div>, { autoClose: false });
        };

        socket.on('nfzBreach', handleNfzBreach);
        socket.on('admin:messageReceived', handleAdminMessage);
        socket.on('deviceLocationUpdate', handleLocationUpdate);
        socket.on('deviceStatusUpdate', handleStatusUpdate);

        return () => {
            isMounted = false;
            socket.off('deviceLocationUpdate', handleLocationUpdate);
            socket.off('deviceStatusUpdate', handleStatusUpdate);
            socket.off('nfzBreach', handleNfzBreach);
            socket.off('admin:messageReceived', handleAdminMessage);
            socket.disconnect();
        };
    }, [user]);

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
    const handleOpenEditModal = (device) => {
        setEditingDevice({ ...device, newImage: null });
        setShowEditModal(true);
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEditingDevice(null);
    };

    const handleUpdateDevice = async (e) => {
        e.preventDefault();
        if (!editingDevice || !editingDevice.name) {
            alert('Tên thiết bị không được để trống.');
            return;
        }

        const formData = new FormData();
        formData.append('name', editingDevice.name);
        if (editingDevice.newImage) {
            formData.append('image', editingDevice.newImage);
        }

        try {
            const res = await api.put(`/devices/${editingDevice._id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setDevices(prev => prev.map(d => (d._id === res.data._id ? res.data : d)));
            alert('Cập nhật thiết bị thành công!');
            handleCloseEditModal();
        } catch (err) {
            alert(err.response?.data?.error || 'Lỗi khi cập nhật thiết bị.');
        }
    };

    const approvedDevices = devices.filter(d => d.isApproved);
    const pendingDevices = devices.filter(d => !d.isApproved);

    return (
        <div className="dashboard-layout">
            <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="user-info">
                    <label htmlFor="avatar-upload">
                        <img src={`http://localhost:5000${user.avatar}`} alt="avatar" className="avatar" />
                    </label>
                    <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                    <div className="username">{user?.name || 'Người dùng'}</div>
                </div>

                <nav className="menu-vertical">
                    {/* Thêm icon và bọc text trong span */}
                    <button className={activeTab === 'devices' ? 'active' : ''} onClick={() => setActiveTab('devices')}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                        <span>Thiết bị của tôi</span>
                    </button>
                    <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span>Lịch sử bay</span>
                    </button>
                    <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                        </svg>
                        <span>Cài đặt</span>
                    </button>
                    <button onClick={onLogout} className="logout-button">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                        <span>Đăng xuất</span>
                    </button>
                </nav>

                <button className="collapse-btn" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" /></svg>
                </button>
            </div>
            <div className="main-content">
                {activeTab === 'devices' && (
                    <>
                        <h2>Thiết bị của tôi</h2>
                        <div className="device-list">
                            {devices.map((device) => (
                                <div key={device._id} className="device-card">
                                    <button
                                        className="edit-icon-button"
                                        onClick={() => handleOpenEditModal(device)}
                                        aria-label={`Sửa thiết bị ${device.name}`} // Tốt cho accessibility
                                    >

                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <img src={`http://localhost:5000${device.image}`} alt={device.name} />
                                    <div className="device-info-group">
                                        <h3>{device.name}</h3>
                                        <p><strong>Trạng thái:</strong> {device.isLocked ? 'Bị khóa' : device.status}</p>
                                        {device.location?.lat ? (
                                            <p><strong>Vị trí:</strong> {device.location.lat.toFixed(4)}, {device.location.lng.toFixed(4)}</p>
                                        ) : (
                                            <p><strong>Vị trí:</strong> <i>Chưa có tín hiệu</i></p>
                                        )}
                                    </div>
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


            {selectedDevice && (
                <div className="map-modal">
                    <div className="map-content">
                        <h3>{selectedDevice.name} - {viewingFlight ? 'Lịch sử chuyến bay' : 'Vị trí hiện tại'}</h3>
                        <MapContainer
                            key={selectedDevice._id + (viewingFlight ? viewingFlight._id : '')}

                            center={
                                viewingFlight && viewingFlight.path.length > 0
                                    ? [viewingFlight.path[0].lat, viewingFlight.path[0].lng] // Lấy tâm là điểm bắt đầu của lịch sử
                                    : [selectedDevice.location.lat, selectedDevice.location.lng] // Lấy tâm là vị trí hiện tại
                            }
                            zoom={15}
                            style={{ height: '450px', width: '100%' }}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                            {noFlyZones.map(zone => {
                                const redOptions = { color: 'red', fillColor: 'red', fillOpacity: 0.2 };
                                if (zone.shape === 'Circle') {
                                    return <Circle key={zone._id} center={zone.center} radius={zone.radius} pathOptions={redOptions} >
                                        <Popup><b>VÙNG CẤM:</b> {zone.name}</Popup>
                                    </Circle>
                                }
                                return null;
                            })}

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


                        <button onClick={() => { setSelectedDevice(null); setViewingFlight(null); }} className="close-map">Đóng</button>
                    </div>
                </div>
            )}


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

            {showEditModal && editingDevice && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Chỉnh sửa thông tin thiết bị</h3>
                        <form onSubmit={handleUpdateDevice}>
                            <label>Tên gợi nhớ</label>
                            <input
                                type="text"
                                value={editingDevice.name}
                                onChange={e => setEditingDevice({ ...editingDevice, name: e.target.value })}
                                required
                            />

                            <label>Ảnh đại diện hiện tại</label>
                            <img
                                src={`http://localhost:5000${editingDevice.image}`}
                                alt="Current Device"
                                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }}
                            />

                            <label htmlFor="edit-device-image">Thay đổi ảnh đại diện (tùy chọn)</label>
                            <input
                                id="edit-device-image"
                                type="file"
                                accept="image/*"
                                onChange={e => setEditingDevice({ ...editingDevice, newImage: e.target.files[0] })}
                            />

                            <p style={{fontSize: '0.9rem', color: '#666', marginTop: '15px'}}>
                                Mã định danh (S/N) và Model không thể thay đổi.
                            </p>
                            <input type="text" value={`S/N: ${editingDevice.deviceId}`} disabled />


                            <div className="modal-actions">
                                <button type="submit">Lưu thay đổi</button>
                                <button type="button" onClick={handleCloseEditModal}>Hủy</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );


}