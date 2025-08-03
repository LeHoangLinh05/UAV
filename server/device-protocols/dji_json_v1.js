// device-protocols/dji_json_v1.js
function parse(rawData) {
    // Luôn trả về một object có cấu trúc chuẩn
    return {
        deviceId: rawData.serial,
        location: {
            lat: rawData.location.latitude,
            lng: rawData.location.longitude,
        },
        battery: rawData.battery_percent,
        status: 'ok' // hoặc logic khác để xác định trạng thái
    };
}
module.exports = { parse };