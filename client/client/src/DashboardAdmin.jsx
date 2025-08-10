import React, { useState, useEffect, useRef  } from 'react';
import { io } from "socket.io-client";
import api from './api';
import './Dashboard.css';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, Polygon, FeatureGroup } from 'react-leaflet';
import { EditControl } from "react-leaflet-draw";
import L from 'leaflet';
import { toast } from 'react-toastify';
import 'leaflet-draw/dist/leaflet.draw.css';

// Bản vá lỗi icon Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const API_URL = 'http://localhost:5000/api';

// Component helper để sửa lỗi render map
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
    }, [map]);
    return null;
}

const StatCard = ({ title, value, icon }) => (
    <div className="stat-card">
        <div className="stat-icon">{icon}</div>
        <div className="stat-info">
            <p>{title}</p>
            <h3>{value}</h3>
        </div>
    </div>
);

export default function DashboardAdmin({ user, onLogout }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({});
    const [users, setUsers] = useState([]);
    const [devices, setDevices] = useState([]);
    const [deviceTab, setDeviceTab] = useState('all');
    const [noFlyZones, setNoFlyZones] = useState([]); // State cho vùng cấm
    const [showAlertModal, setShowAlertModal] = useState(false); // State cho modal gửi tin nhắn
    const [alertData, setAlertData] = useState(null); // Dữ liệu của vi phạm
    const [alertMessage, setAlertMessage] = useState(''); // Nội dung tin nhắn
    const [allNoFlyZones, setAllNoFlyZones] = useState([]); // State mới để lưu tất cả zone cho trang quản lý
    const [editingZone, setEditingZone] = useState(null); // State cho modal chỉnh sửa zone
    const socketRef = useRef(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedUserForHistory, setSelectedUserForHistory] = useState(null);
    const [userFlightHistory, setUserFlightHistory] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [selectedDeviceForMap, setSelectedDeviceForMap] = useState(null);

    useEffect(() => {
        // --- PHẦN 1: KHỞI TẠO VÀ LẤY DỮ LIỆU BAN ĐẦU ---
        // (Không liên quan đến socket)
        const fetchData = () => {
            Promise.all([
                api.get('/admin/stats'),
                api.get('/admin/users'),
                api.get('/admin/devices'),
                api.get('/nfz/all')
            ]).then(([statsRes, usersRes, devicesRes, allNfzRes]) => {
                setStats(statsRes.data);
                setUsers(usersRes.data);
                setDevices(devicesRes.data);
                setAllNoFlyZones(allNfzRes.data);
                setNoFlyZones(allNfzRes.data.filter(z => z.isActive));
                console.log('[EFFECT] Initial data fetched.');
            }).catch(err => console.error("Lỗi tải dữ liệu admin:", err));
        };
        fetchData();

        // --- PHẦN 2: THIẾT LẬP KẾT NỐI SOCKET VÀ LISTENERS ---
        // Chỉ tạo kết nối MỘT LẦN
        const socket = io("http://localhost:5000");
        socketRef.current = socket;

        console.log(`[EFFECT] Socket instance created for user ${user.name}`);

        // Định nghĩa các handler
        const handleConnect = () => {
            console.log(`[SOCKET] CONNECTED! ID: ${socket.id}. Joining rooms...`);
            socket.emit('joinRoom', { userId: user._id, userRole: user.role });
        };

        const handleDisconnect = () => {
            console.log('[SOCKET] DISCONNECTED!');
        };

        const handleNfzBreach = (data) => {
            console.log('🔥🔥🔥 NFZ BREACH EVENT RECEIVED! 🔥🔥🔥', data);

            toast.warn(
                <div>
                    <h4>🚨 Phát hiện vi phạm!</h4>
                    <p>
                        Thiết bị <strong>{data.deviceName}</strong> (chủ sở hữu: {data.ownerName}) đã vào vùng cấm <strong>{data.zoneName}</strong>.
                    </p>
                    <p style={{fontSize: '0.9em', marginTop: '5px'}}><em>Hệ thống đã tự động gửi cảnh báo đến người dùng.</em></p>
                </div>,
                {
                    toastId: `admin-nfz-${data.deviceId}`, // Tránh lặp lại
                    autoClose: 10000 // Tự đóng sau 10s
                }
            );
            toast.error(<CustomToast />, { toastId: `nfz-${data.deviceId}-${data.zoneId}`, autoClose: false });
        };

        // Gắn listeners
        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('nfzBreach', handleNfzBreach);

        // Cập nhật vị trí trực tiếp mà không cần handler riêng
        socket.on('deviceLocationUpdate', (data) => {
            setDevices(prev => prev.map(d => d._id === data.deviceId ? { ...d, location: data.location, status: data.status } : d));
        });
        socket.on('deviceStatusUpdate', (data) => {
            setDevices(prev => prev.map(d => d._id === data.deviceId ? { ...d, status: data.status } : d));
        });

        // --- PHẦN 3: HÀM DỌN DẸP ---
        // Hàm này sẽ chỉ chạy một lần khi component bị unmount (ví dụ: khi logout)
        return () => {
            console.log('[EFFECT CLEANUP] Component unmounting. Disconnecting socket.');
            socket.disconnect();
        };

    }, []);


    const handleSendMessage = (e) => {
        e.preventDefault();
        if (socketRef.current) {
            socketRef.current.emit('admin:sendMessageToUser', {
                targetUserId: alertData.ownerId,
                message: alertMessage,
                deviceName: alertData.deviceName,
                zoneName: alertData.zoneName
            });
            toast.success(`Đã gửi cảnh báo đến người dùng của thiết bị ${alertData.deviceName}.`);
            setShowAlertModal(false);
            setAlertData(null);
            setAlertMessage('');
        } else {
            toast.error("Lỗi kết nối socket, không thể gửi tin nhắn.");
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
            // API endpoint để cập nhật avatar là chung cho mọi user, kể cả admin
            const res = await api.put(`/users/${user._id}/avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            // Gọi hàm onUserUpdate được truyền từ App.jsx
            onUserUpdate(res.data);
        } catch (err) {
            console.error('Lỗi khi cập nhật avatar:', err);
            alert('Không thể cập nhật avatar.');
        }
    };

    const handleLockDevice = async (id) => {
        try {
            // Gọi API để khóa/mở khóa thiết bị
            await api.put(`${API_URL}/admin/devices/${id}/lock`);

            // Cập nhật state 'devices' ngay lập tức để giao diện thay đổi
            setDevices(prevDevices =>
                prevDevices.map(device => {
                    if (device._id === id) {
                        // Đảo ngược trạng thái isLocked của thiết bị vừa được cập nhật
                        return { ...device, isLocked: !device.isLocked };
                    }
                    return device;
                })
            );
        } catch (err) {
            console.error("Lỗi khi khóa/mở khóa thiết bị:", err);
            alert("Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
    };

    const handleLockUser = async (id) => {
        try {
            // Gọi API để khóa/mở khóa người dùng
            await api.put(`${API_URL}/admin/users/${id}/lock`);

            // Cập nhật state 'users' ngay lập tức để giao diện thay đổi
            setUsers(prevUsers =>
                prevUsers.map(u => {
                    if (u._id === id) {
                        // Đảo ngược trạng thái isLocked của người dùng vừa được cập nhật
                        return { ...u, isLocked: !u.isLocked };
                    }
                    return u;
                })
            );
        } catch (err) {
            console.error("Lỗi khi khóa/mở khóa người dùng:", err);
            alert("Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
    };

    const handleViewHistory = async (user) => {
        setSelectedUserForHistory(user);
        setShowHistoryModal(true);
        setIsHistoryLoading(true);
        setUserFlightHistory([]); // Xóa lịch sử cũ

        try {
            const res = await api.get(`/admin/users/${user._id}/history`);
            setUserFlightHistory(res.data);
        } catch (err) {
            toast.error("Không thể tải lịch sử bay của người dùng này.");
            console.error(err);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const renderOverview = () => {
        const validDevices = Array.isArray(devices)
            ? devices.filter(d => d.location && d.location.lat != null && d.location.lng != null)
            : [];

        const redOptions = { color: 'red', fillColor: '#f03e3e', fillOpacity: 0.2 };

        return (
            // Thêm một class mới cho container cha để định vị
            <div className="overview-container">
                {/* 1. Phần bản đồ làm nền */}
                <div className="overview-map-background">
                    <MapContainer center={[21.0285, 105.8542]} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapResizer />
                        {validDevices.map(d => {
                            const deviceIcon = L.divIcon({
                                html: `<img class="map-device-avatar" src="http://localhost:5000${d.image}" alt="${d.name}" />`,
                                className: 'custom-device-icon-container',
                                iconSize: [40, 40],
                                iconAnchor: [20, 20],
                                popupAnchor: [0, -20]
                            });
                            return (
                                <Marker key={d._id} position={[d.location.lat, d.location.lng]} icon={deviceIcon}>
                                    <Popup>
                                        <b>{d.name}</b><br/>
                                        Chủ sở hữu: {d.owner?.name || 'N/A'}<br/>
                                        Trạng thái: {d.status}
                                    </Popup>
                                </Marker>
                            );
                        })}
                        {Array.isArray(noFlyZones) && noFlyZones.map(zone => {
                            // Kiểm tra kỹ lưỡng các thuộc tính cần thiết trước khi render
                            if (zone.shape === 'Circle' && zone.center && typeof zone.center.lat === 'number' && typeof zone.center.lng === 'number' && typeof zone.radius === 'number') {
                                return (
                                    <Circle
                                        key={`nfz-${zone._id}`}
                                        center={[zone.center.lat, zone.center.lng]} // Đảm bảo truyền vào một mảng
                                        radius={zone.radius}
                                        pathOptions={redOptions}
                                    >
                                        <Popup>
                                            <b>Vùng cấm: {zone.name}</b><br/>
                                            {zone.description}
                                        </Popup>
                                    </Circle>
                                );
                            }
                            if (zone.shape === 'Polygon' && Array.isArray(zone.path) && zone.path.length > 0) {
                                // Tạo một mảng tọa độ hợp lệ cho Polygon
                                const validPath = zone.path.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number').map(p => [p.lat, p.lng]);
                                if (validPath.length > 2) { // Một đa giác cần ít nhất 3 điểm
                                    return (
                                        <Polygon
                                            key={`nfz-${zone._id}`}
                                            positions={validPath}
                                            pathOptions={redOptions}
                                        >
                                            <Popup>
                                                <b>Vùng cấm: {zone.name}</b><br/>
                                                {zone.description}
                                            </Popup>
                                        </Polygon>
                                    );
                                }
                            }
                            return null; // Luôn trả về null nếu điều kiện không khớp
                        })}
                    </MapContainer>
                </div>

                {/* 2. Phần nội dung nổi lên trên, bao gồm cả tiêu đề và các thẻ thống kê */}
                <div className="overview-content-overlay">
                    {/*<h2>Tổng quan hệ thống</h2>*/}
                    <div className="stats-grid">
                        <StatCard title="Tổng người dùng" value={stats.userCount || 0} icon="👤" />
                        <StatCard title="Tổng thiết bị" value={stats.deviceCount || 0} icon="🚁" />
                        <StatCard title="Đang hoạt động" value={stats.activeDeviceCount || 0} icon="✈️" />
                        <StatCard title="Thiết bị Offline" value={(stats.deviceCount || 0) - (stats.activeDeviceCount || 0)} icon="🔌" />
                    </div>
                </div>
            </div>
        );
    };

    const renderDeviceManagement = () => {
        const lockedDevices = devices.filter(d => d.isLocked);
        // const devicesToList = deviceTab === 'locked' ? lockedDevices : devices;
        const activeDevices = devices.filter(d => d.status === 'Đang hoạt động');
        const inactiveDevices = devices.filter(d => d.status !== 'Đang hoạt động');

        let devicesToList;

        // 3. Sử dụng switch-case để chọn danh sách dựa trên `deviceTab` state
        switch (deviceTab) {
            case 'active':
                devicesToList = activeDevices;
                break;
            case 'inactive':
                devicesToList = inactiveDevices;
                break;
            case 'locked':
                devicesToList = lockedDevices;
                break;
            default: // 'all'
                devicesToList = devices;
                break;
        }
        return (
            <>
                <h2>Quản lý thiết bị</h2>
                <div className="sub-tabs">
                    <button onClick={() => setDeviceTab('all')} className={deviceTab === 'all' ? 'active' : ''}>
                        Tất cả ({devices.length})
                    </button>
                    <button onClick={() => setDeviceTab('active')} className={deviceTab === 'active' ? 'active' : ''}>
                        Đang hoạt động ({activeDevices.length})
                    </button>
                    <button onClick={() => setDeviceTab('inactive')} className={deviceTab === 'inactive' ? 'active' : ''}>
                        Không hoạt động ({inactiveDevices.length})
                    </button>
                    <button onClick={() => setDeviceTab('locked')} className={deviceTab === 'locked' ? 'active' : ''}>
                        Bị khóa ({lockedDevices.length})
                    </button>
                </div>
                <div className="device-list">
                    {devicesToList.length > 0 ? (
                        devicesToList.map(device => (
                            <div key={device._id} className={`device-card ${device.isLocked ? 'locked' : ''}`}>
                                <img src={`http://localhost:5000${device.image}`} alt={device.name} />
                                <h3>{device.name}</h3>
                                <p><strong>Chủ sở hữu:</strong> {device.owner?.name || 'N/A'}</p>
                                <p><strong>Trạng thái:</strong> {device.status}</p>
                                <div className="card-actions">
                                    <button
                                        className="action-btn view-btn" // Thêm class mới để tạo style
                                        onClick={() => setSelectedDeviceForMap(device)}
                                        disabled={!device.location?.lat} // Chỉ bật khi có tọa độ
                                    >
                                        Xem vị trí
                                    </button>
                                    <button onClick={() => handleLockDevice(device._id)}>{device.isLocked ? 'Mở khóa' : 'Khóa'}</button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p>Không có thiết bị nào trong danh mục này.</p>
                    )}
                </div>
            </>
        );
    };

    const renderUserManagement = () => (
        <>
            <h2>Quản lý người dùng</h2>
            <table className="user-table">
                <thead>
                <tr>
                    <th>Avatar</th>
                    <th>Tên</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Lịch sử</th>
                    <th>Hành động</th>
                </tr>
                </thead>
                <tbody>
                {users.map(u => (
                    <tr key={u._id}>
                        <td><img src={`http://localhost:5000${u.avatar}`} alt="avatar" className="avatar-small" /></td>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td>{u.isLocked ? <span className="locked-tag">Bị khóa</span> : <span className="active-tag">Hoạt động</span>}</td>
                        <td>
                            <button
                                onClick={() => handleViewHistory(u)}
                                className="action-btn history-btn"
                            >
                                Xem
                            </button>
                        </td>
                        <td>
                            {/* Thay đổi chính nằm ở thẻ button dưới đây */}
                            <button
                                onClick={() => handleLockUser(u._id)}
                                className={`action-btn ${u.isLocked ? 'unlock-btn' : 'lock-btn'}`}
                            >
                                {u.isLocked ? 'Mở khóa' : 'Khóa'}
                            </button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </>
    );

    const renderNfzManagement = () => {
        const handleCreate = async (e) => {
            // e.layerType là 'circle', e.layer là đối tượng circle vừa vẽ
            if (e.layerType === 'circle') {
                const { lat, lng } = e.layer.getLatLng();
                const radius = e.layer.getRadius();

                const name = prompt("Nhập tên cho vùng cấm mới:", "Vùng cấm mới");
                if (!name) return; // Người dùng hủy

                const newZoneData = {
                    name,
                    description: "Mô tả...",
                    shape: 'Circle',
                    center: { lat, lng },
                    radius,
                    isActive: true
                };

                try {
                    const res = await api.post('/nfz', newZoneData);
                    setAllNoFlyZones(prev => [res.data, ...prev]);
                    toast.success(`Đã tạo vùng cấm "${name}"`);
                } catch (err) {
                    toast.error("Lỗi khi tạo vùng cấm.");
                }
            }
        };

        const handleDelete = async (zoneId) => {
            if (window.confirm("Bạn có chắc chắn muốn xóa vùng cấm này không?")) {
                try {
                    await api.delete(`/nfz/${zoneId}`);
                    setAllNoFlyZones(prev => prev.filter(z => z._id !== zoneId));
                    toast.success("Đã xóa vùng cấm.");
                } catch (err) {
                    toast.error("Lỗi khi xóa vùng cấm.");
                }
            }
        };

        const handleUpdate = async (e) => {
            e.preventDefault();
            try {
                const res = await api.put(`/nfz/${editingZone._id}`, editingZone);
                setAllNoFlyZones(prev => prev.map(z => z._id === editingZone._id ? res.data : z));
                toast.success("Đã cập nhật vùng cấm.");
                setEditingZone(null); // Đóng modal
            } catch (err) {
                toast.error("Lỗi khi cập nhật.");
            }
        };

        return (
            <div className="nfz-management-container">
                <div className="nfz-list-panel">
                    <h2>Quản lý vùng cấm </h2>

                    <div className="nfz-list">
                        {allNoFlyZones.map(zone => (
                            <div key={zone._id} className={`nfz-item ${!zone.isActive ? 'inactive' : ''}`}>
                                <div className="nfz-info">
                                    <strong>{zone.name}</strong>
                                    <span>{zone.isActive ? 'Đang hoạt động' : 'Tạm tắt'}</span>
                                </div>
                                <div className="nfz-actions">
                                    <button onClick={() => setEditingZone(zone)}>Sửa</button>
                                    <button className="danger" onClick={() => handleDelete(zone._id)}>Xóa</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="nfz-map-panel">
                    <MapContainer center={[21.0285, 105.8542]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <FeatureGroup>
                            <EditControl
                                position="topright"
                                onCreated={handleCreate}
                                draw={{
                                    rectangle: false,
                                    polygon: false, // Tạm thời tắt polygon cho đơn giản
                                    polyline: false,
                                    marker: false,
                                    circlemarker: false
                                }}
                                edit={{
                                    featureGroup: new L.FeatureGroup(), // Tắt chức năng sửa hình dạng trực tiếp
                                    edit: false,
                                    remove: false
                                }}
                            />
                        </FeatureGroup>
                        {/* Hiển thị các vùng đã có */}
                        {allNoFlyZones.map(zone => (
                            <Circle
                                key={zone._id}
                                center={zone.center}
                                radius={zone.radius}
                                pathOptions={{ color: zone.isActive ? 'red' : 'grey', fillColor: zone.isActive ? 'red' : 'grey', fillOpacity: 0.2 }}
                            >
                                <Popup><b>{zone.name}</b></Popup>
                            </Circle>
                        ))}
                    </MapContainer>
                </div>

                {/* Modal chỉnh sửa */}
                {editingZone && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Chỉnh sửa vùng cấm</h3>
                            <form onSubmit={handleUpdate}>
                                <label>Tên vùng </label>
                                <input
                                    type="text"
                                    value={editingZone.name}
                                    onChange={e => setEditingZone({...editingZone, name: e.target.value})}
                                />
                                <label>Mô tả</label>
                                <textarea
                                    rows="3"
                                    value={editingZone.description}
                                    onChange={e => setEditingZone({...editingZone, description: e.target.value})}
                                />
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={editingZone.isActive}
                                        onChange={e => setEditingZone({...editingZone, isActive: e.target.checked})}
                                    />
                                    Đang hoạt động
                                </label>
                                <div className="modal-actions">
                                    <button type="submit">Lưu</button>
                                    <button type="button" onClick={() => setEditingZone(null)}>Hủy</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    };
    // --- MAIN RETURN JSX ---
    return (
        <div className="dashboard-layout">
            <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="user-info">
                    <img src={`http://localhost:5000${user.avatar}`} alt="avatar" className="avatar" />
                    <div className="username">{user.name} (Admin)</div>
                </div>
                <nav className="menu-vertical">
                    <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                        <span>Tổng quan</span>
                    </button>
                    <button onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'active' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11.25a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 17.25c-3.142 0-6 1.343-6 3V21h12v-.75c0-1.657-2.858-3-6-3z" />

                        </svg>
                        <span>Quản lý người dùng</span>
                    </button>
                    <button onClick={() => setActiveTab('devices')} className={activeTab === 'devices' ? 'active' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                        <span>Quản lý thiết bị</span>
                    </button>
                    <button onClick={() => setActiveTab('nfz')} className={activeTab === 'nfz' ? 'active' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        <span>Vùng cấm bay</span>
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
            <div
                className={`main-content ${
                    (activeTab === 'overview' || activeTab === 'nfz')
                        ? 'main-content--full-bleed'
                        : ''
                }`}
            >
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'users' && renderUserManagement()}
                {activeTab === 'devices' && renderDeviceManagement()}
                {activeTab === 'nfz' && renderNfzManagement()}
            </div>

            {selectedDeviceForMap && (
                <div className="map-modal">
                    <div className="map-content">
                        <h3>Vị trí hiện tại của {selectedDeviceForMap.name}</h3>
                        <MapContainer
                            key={selectedDeviceForMap._id} // Dùng key để re-render map khi đổi thiết bị
                            center={[selectedDeviceForMap.location.lat, selectedDeviceForMap.location.lng]}
                            zoom={15}
                            style={{ height: '450px', width: '100%' }}
                        >
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker position={[selectedDeviceForMap.location.lat, selectedDeviceForMap.location.lng]}>
                                <Popup>
                                    <b>{selectedDeviceForMap.name}</b><br/>
                                    Chủ sở hữu: {selectedDeviceForMap.owner?.name || 'N/A'}
                                </Popup>
                            </Marker>
                        </MapContainer>
                        <button onClick={() => setSelectedDeviceForMap(null)} className="close-map">Đóng</button>
                    </div>
                </div>
            )}

            {showHistoryModal && selectedUserForHistory && (
                <div className="modal-overlay">
                    <div className="modal-content modal-lg"> {/* Thêm class modal-lg để rộng hơn */}
                        <h3>Lịch sử bay của {selectedUserForHistory.name}</h3>

                        <div className="history-modal-list">
                            {isHistoryLoading ? (
                                <p>Đang tải lịch sử...</p>
                            ) : userFlightHistory.length > 0 ? (
                                userFlightHistory.map(flight => (
                                    <div key={flight._id} className="history-modal-item">
                                        <div className="history-item-info">
                                            {/* Hiển thị tên thiết bị cho mỗi chuyến bay */}
                                            <h3>Thiết bị: {flight.deviceId?.name || 'Không xác định'}</h3>
                                            <p><strong>Từ:</strong> {flight.startAddress}</p>
                                            <p><strong>Đến:</strong> {flight.endAddress}</p>
                                            <p><strong>Thời gian bay:</strong> {flight.durationInSeconds} giây</p>
                                            <p style={{ fontSize: '0.8rem', color: '#95a5a6' }}>
                                                {new Date(flight.startTime).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>Người dùng này chưa có chuyến bay nào được ghi lại.</p>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button type="button" onClick={() => setShowHistoryModal(false)}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}

            {showAlertModal && alertData && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Gửi cảnh báo tới người dùng</h3>
                        <p>Thiết bị: <strong>{alertData.deviceName}</strong></p>
                        <p>Vi phạm vùng: <strong>{alertData.zoneName}</strong></p>
                        <form onSubmit={handleSendMessage}>
                            <textarea
                                value={alertMessage}
                                onChange={e => setAlertMessage(e.target.value)}
                                rows="4"
                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '15px' }}
                                required
                            />
                            <div className="modal-actions">
                                <button type="submit">Gửi</button>
                                <button type="button" onClick={() => setShowAlertModal(false)}>Hủy</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}