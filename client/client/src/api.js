// File: src/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api',
});

api.interceptors.request.use(
    (config) => {
        // Thêm log ở đây để chắc chắn interceptor được thiết lập
        console.log('Interceptor is set up. Attaching token...');
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }
        return config;
    },
    (error) => {
        console.error('Interceptor error:', error);
        return Promise.reject(error);
    }
);

export default api;