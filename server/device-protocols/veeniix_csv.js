// device-protocols/veeniix_csv.js
function parse(rawData) {
    const parts = rawData.split(';'); // Tách chuỗi
    const coords = parts[1].split(',');

    return {
        deviceId: parts[0],
        location: {
            lat: parseFloat(coords[0]),
            lng: parseFloat(coords[1]),
        },
        battery: parseInt(parts[2], 10),
        status: 'ok'
    };
}
module.exports = { parse };