// File này có nhiệm vụ import tất cả các file model khác
// để đăng ký chúng với Mongoose khi ứng dụng khởi động.

require('./User');
require('./Device');
require('./FlightSession');
require('./Manufacturer');
require('./DeviceModel');