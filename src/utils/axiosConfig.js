// src/utils/axiosConfig.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const instance = axios.create({
  baseURL: API_BASE_URL,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Export the server base URL for file URLs
export const getFileUrl = (path) => {
  if (path.startsWith('http')) {
    return path;
  }
  return `${SERVER_BASE_URL}${path}`;
};

export default instance;
