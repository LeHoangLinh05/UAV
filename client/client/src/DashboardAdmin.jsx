import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

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
    // --- STATE ---
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({});
    const [users, setUsers] = useState([]);
    const [devices, setDevices] = useState([]);
    const [deviceTab, setDeviceTab] = useState('all');

    // --- LOGIC ---
    const fetchData = () => {
        Promise.all([
            axios.get(`${API_URL}/admin/stats`),
            axios.get(`${API_URL}/admin/users`),
            axios.get(`${API_URL}/admin/devices`),
        ]).then(([statsRes, usersRes, devicesRes]) => {
            setStats(statsRes.data);
            setUsers(usersRes.data);
            setDevices(devicesRes.data);
        }).catch(err => console.error("Lỗi khi tải dữ liệu admin:", err));
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleApproveDevice = async (id) => {
        await axios.put(`${API_URL}/admin/devices/${id}/approve`);
        fetchData();
    };

    const handleLockDevice = async (id) => {
        await axios.put(`${API_URL}/admin/devices/${id}/lock`);
        fetchData();
    };

    const handleLockUser = async (id) => {
        await axios.put(`${API_URL}/admin/users/${id}/lock`);
        fetchData();
    };

    // --- RENDER FUNCTIONS (Đã được khôi phục) ---

    const renderOverview = () => (
        <>
            <h2>Tổng quan hệ thống</h2>
            <div className="stats-grid">
                <StatCard title="Tổng người dùng" value={stats.userCount || 0} icon="👤" />
                <StatCard title="Tổng thiết bị" value={stats.deviceCount || 0} icon="🚁" />
                <StatCard title="Đang hoạt động" value={stats.flyingCount || 0} icon="✈️" />
                <StatCard title="Chờ phê duyệt" value={stats.pendingCount || 0} icon="📝" />
            </div>
        </>
    );

    // ✅ KHÔI PHỤC HÀM NÀY
    const renderDeviceManagement = () => {
        const pendingDevices = devices.filter(d => !d.isApproved);
        const lockedDevices = devices.filter(d => d.isLocked);

        let devicesToList = devices;
        if (deviceTab === 'pending') devicesToList = pendingDevices;
        if (deviceTab === 'locked') devicesToList = lockedDevices;

        return (
            <>
                <h2>Quản lý thiết bị</h2>
                <div className="sub-tabs">
                    <button onClick={() => setDeviceTab('all')} className={deviceTab === 'all' ? 'active' : ''}>Tất cả ({devices.length})</button>
                    <button onClick={() => setDeviceTab('pending')} className={deviceTab === 'pending' ? 'active' : ''}>Chờ duyệt ({pendingDevices.length})</button>
                    <button onClick={() => setDeviceTab('locked')} className={deviceTab === 'locked' ? 'active' : ''}>Bị khóa ({lockedDevices.length})</button>
                </div>
                <div className="device-list">
                    {devicesToList.map(device => (
                        <div key={device._id} className={`device-card ${device.isLocked ? 'locked' : ''}`}>
                            <img src={`http://localhost:5000${device.image}`} alt={device.name} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                            <h3>{device.name}</h3>
                            <p>Chủ sở hữu: {device.owner?.name || 'N/A'}</p>
                            <p>Trạng thái: {device.status}</p>
                            <div className="card-actions">
                                {!device.isApproved && <button onClick={() => handleApproveDevice(device._id)} className="approve">Duyệt</button>}
                                <button onClick={() => handleLockDevice(device._id)}>{device.isLocked ? 'Mở khóa' : 'Khóa'}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    // ✅ KHÔI PHỤC HÀM NÀY
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
                            <button onClick={() => handleLockUser(u._id)}>{u.isLocked ? 'Mở khóa' : 'Khóa'}</button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </>
    );

    const renderGlobalMap = () => {
        const validDevices = devices.filter(d => d.location && d.location.lat != null && d.location.lng != null);

        return (
            <>
                <h2>Bản đồ theo dõi toàn cục</h2>
                <MapContainer center={[21.0285, 105.8542]} zoom={9} style={{ height: '70vh', width: '100%' }}>
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
                </MapContainer>
            </>
        );
    };

    // --- MAIN RETURN JSX ---
    return (
        <div className="dashboard-layout">
            <div className="sidebar">
                <div className="user-info">
                    <img src={`http://localhost:5000${user.avatar}`} alt="avatar" className="avatar" />
                    <div className="username">{user.name} (Admin)</div>
                </div>
                <nav className="menu-vertical">
                    <button onClick={() => setActiveTab('overview')} className={activeTab === 'overview' ? 'active' : ''}>Tổng quan</button>
                    <button onClick={() => setActiveTab('users')} className={activeTab === 'users' ? 'active' : ''}>Quản lý người dùng</button>
                    <button onClick={() => setActiveTab('devices')} className={activeTab === 'devices' ? 'active' : ''}>Quản lý thiết bị</button>
                    <button onClick={() => setActiveTab('map')} className={activeTab === 'map' ? 'active' : ''}>Bản đồ toàn cục</button>
                    <button onClick={onLogout} className="logout-button">Đăng xuất</button>
                </nav>
            </div>
            <div className="main-content">
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'users' && renderUserManagement()}
                {activeTab === 'devices' && renderDeviceManagement()}
                {activeTab === 'map' && renderGlobalMap()}
            </div>
        </div>
    );
}