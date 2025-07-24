import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const API_URL = 'http://localhost:5000/api';

export default function DashboardUser({ user, onLogout, onUserUpdate}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [newDevice, setNewDevice] = useState({
    name: '',
    lat: '',
    lng: '',
    image: ''
  });
  const [activeSimulations, setActiveSimulations] = useState({});
  // const [historyModal, setHistoryModal] = useState({ isOpen: false, deviceId: null, flights: [] });
  const [viewingFlight, setViewingFlight] = useState(null);
  const [allFlightHistory, setAllFlightHistory] = useState([]);


  useEffect(() => {
    axios.get(`${API_URL}/devices`)
        .then(res => {
          const devicesData = res.data;
          setDevices(devicesData);

          // Sau khi có danh sách thiết bị, tải lịch sử của từng cái
          const historyPromises = devicesData.map(device =>
              axios.get(`${API_URL}/devices/${device._id}/history`)
          );

          Promise.all(historyPromises)
              .then(results => {
                // Gộp tất cả các chuyến bay vào một mảng duy nhất và sắp xếp
                const allFlights = results.flatMap(result => result.data);
                allFlights.sort((a, b) => new Date(b.startTime) - new Date(a.startTime)); // Mới nhất lên đầu
                setAllFlightHistory(allFlights);
              });
        })
        .catch(err => console.error('Lỗi khi tải dữ liệu:', err));
  }, []);

  const simulateMovement = (lat, lng) => {
    const latOffset = (Math.random() - 0.5) * 0.002;
    const lngOffset = (Math.random() - 0.5) * 0.002;
    return { lat: lat + latOffset, lng: lng + lngOffset };
  };

  const handleStartFlight = async (deviceId) => {
    try {
      const res = await axios.post(`${API_URL}/devices/${deviceId}/start`);
      const { device, session } = res.data;

      // Lưu thông tin mô phỏng ban đầu VÀO STATE
      setActiveSimulations(prevSims => ({
        ...prevSims,
        [deviceId]: {
          // Chúng ta sẽ thêm intervalId vào sau
          intervalId: null,
          sessionId: session._id,
          path: [device.location]
        }
      }));

      // Cập nhật trạng thái trên UI
      setDevices(prev => prev.map(d => d._id === deviceId ? { ...device, status: 'Đang bay' } : d));

      // Bây giờ tạo interval
      const intervalId = setInterval(() => {
        let newLocation = null;

        // Cập nhật cả hai state cùng lúc để đảm bảo đồng bộ
        // Cập nhật đường đi trong activeSimulations
        setActiveSimulations(currentSims => {
          const currentSim = currentSims[deviceId];
          if (!currentSim) {
            clearInterval(intervalId); // Tự hủy nếu sim không còn
            return currentSims;
          }

          // Lấy vị trí cuối cùng từ đường đi đã lưu
          const lastPosition = currentSim.path[currentSim.path.length - 1];
          newLocation = simulateMovement(lastPosition.lat, lastPosition.lng);

          return {
            ...currentSims,
            [deviceId]: {
              ...currentSim,
              path: [...currentSim.path, newLocation]
            }
          };
        });

        // Cập nhật vị trí trên bản đồ
        setDevices(currentDevices =>
            currentDevices.map(d => {
              if (d._id === deviceId && newLocation) {
                return { ...d, location: newLocation };
              }
              return d;
            })
        );
      }, 2000);

      // Sau khi tạo interval, cập nhật lại state simulation để lưu intervalId
      setActiveSimulations(prevSims => ({
        ...prevSims,
        [deviceId]: {
          ...prevSims[deviceId],
          intervalId: intervalId
        }
      }));

    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khi bắt đầu bay');
    }
  };

// HÀM DỪNG BAY
  const handleStopFlight = async (deviceId) => {
    const simulation = activeSimulations[deviceId];
    if (!simulation) {
      console.error("Không tìm thấy thông tin mô phỏng cho thiết bị:", deviceId);
      return;
    }

    // Tìm thiết bị TRƯỚC khi làm bất cứ điều gì khác
    const deviceToUpdate = devices.find(d => d._id === deviceId);

    // Thêm bước kiểm tra cực kỳ quan trọng
    if (!deviceToUpdate) {
      alert('Lỗi: Không tìm thấy thông tin thiết bị trên giao diện. Vui lòng thử tải lại trang.');
      return;
    }

    // Dừng interval
    clearInterval(simulation.intervalId);

    try {
      // Bây giờ chúng ta chắc chắn deviceToUpdate và simulation đều tồn tại
      await axios.post(`${API_URL}/devices/sessions/${simulation.sessionId}/stop`, {
        path: simulation.path,
        location: deviceToUpdate.location // Dòng này giờ đã an toàn
      });

      // Tải lại danh sách thiết bị để cập nhật trạng thái
      const res = await axios.get(`${API_URL}/devices`);
      setDevices(res.data);

      // Xóa khỏi danh sách mô phỏng đang hoạt động
      const newSims = { ...activeSimulations };
      delete newSims[deviceId];
      setActiveSimulations(newSims);

      alert('Chuyến bay đã kết thúc và được lưu lại.');

    } catch (err) {
      console.error('Lỗi khi gọi API dừng bay:', err);
      alert(err.response?.data?.error || 'Lỗi từ server khi dừng bay');
    }
  };

  // ✅ HÀM XEM LỊCH SỬ
  const showFlightHistory = async (deviceId) => {
    const res = await axios.get(`${API_URL}/devices/${deviceId}/history`);
    setHistoryModal({ isOpen: true, deviceId, flights: res.data });
  };

  const handleToggle = async (id) => {
    try {
      await axios.patch(`${API_URL}/devices/${id}/toggle`);
      setDevices(devices.map(d =>
          d._id === id ? {
            ...d,
            status: d.status === 'Đang bay' ? 'Không hoạt động' : 'Đang bay'
          } : d
      ));
    } catch (err) {
      console.error('Lỗi khi đổi trạng thái:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/devices/${id}`);
      setDevices(devices.filter(d => d._id !== id));
    } catch (err) {
      console.error('Lỗi khi xóa:', err);
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    if (!newDevice.name || !newDevice.lat || !newDevice.lng) return;

    try {
      const formData = new FormData();
      formData.append('name', newDevice.name);
      formData.append('lat', newDevice.lat);
      formData.append('lng', newDevice.lng);
      if (newDevice.image) {
        formData.append('image', newDevice.image);
      }

      await axios.post(`${API_URL}/devices`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // ✅ Tải lại từ DB thay vì chỉ thêm local
      const updated = await axios.get(`${API_URL}/devices`);
      setDevices(updated.data);
      setNewDevice({ name: '', lat: '', lng: '', image: '' });
      setShowAddModal(false);
    } catch (err) {
      console.error('Lỗi khi thêm thiết bị:', err);
    }
  };


  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // Giới hạn 5MB
      alert('Kích thước ảnh quá lớn (tối đa 5MB)');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await axios.put(`${API_URL}/users/${user._id}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      onUserUpdate(res.data);


    } catch (err) {
      console.error('Lỗi khi cập nhật avatar:', err);
      alert('Không thể cập nhật avatar. Vui lòng thử lại.');
    }
  };


  const [activeTab, setActiveTab] = useState('devices');
  const [username, setUsername] = useState(user?.name || '');
  const [passwords, setPasswords] = useState({ current: '', new: '' });

  return (
      <div className="dashboard-layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="user-info">
            <label htmlFor="avatar-upload">
              <img
                  // Sử dụng avatar từ object user, nếu không có thì dùng ảnh mặc định
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
            <button
                className={activeTab === 'devices' ? 'active' : ''}
                onClick={() => setActiveTab('devices')}
            >
              Thiết bị bay của tôi
            </button>
            <button
                className={activeTab === 'history' ? 'active' : ''}
                onClick={() => setActiveTab('history')}
            >
              Lịch sử bay
            </button>
            <button
                className={activeTab === 'settings' ? 'active' : ''}
                onClick={() => setActiveTab('settings')}
            >
              Cài đặt
            </button>

            <button onClick={onLogout} className="logout-button">Đăng xuất</button>
          </nav>
        </div>

        {/* Main content */}
        <div className="main-content">
          {activeTab === 'devices' && (
              <>
                <h2>Thiết bị bay</h2>
                <div className="device-list">
                  {/*<div className="device-card add-card" onClick={() => setShowAddModal(true)}>*/}
                  {/*  <div className="plus-icon">＋</div>*/}
                  {/*  <p>Thêm thiết bị</p>*/}
                  {/*</div>*/}

                  {devices.map((device) => (
                      <div key={device._id} className="device-card">
                        <img
                            src={`http://localhost:5000${device.image}`}
                            alt={device.name}
                            style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px' }}
                        />
                        <h3>{device.name}</h3>
                        <p><strong>Trạng thái:</strong> {device.status}</p>
                        <p><strong>Vị trí:</strong> {device.location?.lat}, {device.location?.lng}</p>

                        <div className="card-actions">
                          <button onClick={() => { setSelectedDevice(device); setViewingFlight(null); }}>Vị trí</button>
                          {device.status === 'Đang bay' ? (
                              <button onClick={() => handleStopFlight(device._id)} className="danger">Ngừng bay</button>
                          ) : (
                              <button onClick={() => handleStartFlight(device._id)}>Bắt đầu bay</button>
                          )}
                          {/*<button onClick={() => showFlightHistory(device._id)}>Lịch sử</button>*/}
                          <button onClick={() => handleDelete(device._id)} className="danger">Xóa</button>
                        </div>
                      </div>


                  ))}
                  <div className="device-card add-card" onClick={() => setShowAddModal(true)}>
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
                        // Tìm tên thiết bị tương ứng với chuyến bay
                        const device = devices.find(d => d._id === flight.deviceId);
                        return (
                            <div key={flight._id} className="history-item">
                              <div className="history-item-info">
                                <h3>{device ? device.name : 'Thiết bị đã xóa'}</h3>
                                <p><strong>Bắt đầu:</strong> {new Date(flight.startTime).toLocaleString('vi-VN')}</p>
                                <p><strong>Kết thúc:</strong> {flight.endTime ? new Date(flight.endTime).toLocaleString('vi-VN') : 'Đang bay'}</p>
                                <p><strong>Thời gian:</strong> {flight.durationInSeconds} giây</p>
                              </div>
                              <div className="history-item-actions">
                                <button
                                    onClick={() => {
                                      if(device) {
                                        setViewingFlight(flight);
                                        setSelectedDevice(device);
                                      } else {
                                        alert("Không thể xem lại vì thiết bị này đã bị xóa.");
                                      }
                                    }}
                                    disabled={!device}
                                >
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
                <h2>Cài đặt tài khoản</h2>

                {/* --- Card Đổi tên người dùng --- */}
                <div className="settings-card">
                  <h3>Thông tin cá nhân</h3>
                  <p className="card-description">Tên này sẽ được hiển thị trên hồ sơ của bạn.</p>
                  <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          const res = await axios.put(`${API_URL}/users/${user._id}`, { name: username });
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
                          await axios.put(`${API_URL}/users/${user._id}/password`, passwords);
                          alert('Đổi mật khẩu thành công');
                          setPasswords({ current: '', new: '' });
                        } catch (err) {
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
                    // Dùng key để React re-render map khi device thay đổi
                    key={selectedDevice._id + (viewingFlight ? viewingFlight._id : '')}
                    center={[selectedDevice.location.lat, selectedDevice.location.lng]}
                    zoom={13}
                    style={{ height: '400px', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  {/* Hiển thị đường đi của chuyến bay lịch sử */}
                  {viewingFlight && (
                      <Polyline
                          pathOptions={{ color: 'blue' }}
                          positions={viewingFlight.path.map(p => [p.lat, p.lng])}
                      />
                  )}

                  {/* Marker cho vị trí hiện tại hoặc điểm cuối của lịch sử */}
                  <Marker position={[selectedDevice.location.lat, selectedDevice.location.lng]}>
                    <Popup>{selectedDevice.name}</Popup>
                  </Marker>
                </MapContainer>
                <button onClick={() => setSelectedDevice(null)} className="close-map">Đóng</button>
              </div>
            </div>
        )}

        {/* Add Device Modal */}
        {showAddModal && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>Thêm thiết bị mới</h3>
                <form onSubmit={handleAddDevice}>
                  <input
                      type="text"
                      placeholder="Tên thiết bị"
                      value={newDevice.name}
                      onChange={e => setNewDevice({ ...newDevice, name: e.target.value })}
                      required
                  />
                  <input
                      type="number"
                      placeholder="Vĩ độ (lat)"
                      value={newDevice.lat}
                      onChange={e => setNewDevice({ ...newDevice, lat: e.target.value })}
                      required
                  />
                  <input
                      type="number"
                      placeholder="Kinh độ (lng)"
                      value={newDevice.lng}
                      onChange={e => setNewDevice({ ...newDevice, lng: e.target.value })}
                      required
                  />
                  <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setNewDevice({ ...newDevice, image: e.target.files[0] })}
                  />

                  <div className="modal-actions">
                    <button type="submit">Thêm</button>
                    <button type="button" onClick={() => setShowAddModal(false)}>Hủy</button>
                  </div>
                </form>
              </div>
            </div>
        )}

      </div>
  );
}
