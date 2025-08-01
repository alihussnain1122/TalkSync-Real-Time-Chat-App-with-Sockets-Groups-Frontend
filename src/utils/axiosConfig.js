// src/utils/axiosConfig.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://talksync-kvsb.onrender.com/api';
const SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL || 'https://talksync-kvsb.onrender.com';

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
  // If path already starts with /api, use SERVER_BASE_URL
  // If path starts with /uploads, convert to /api/uploads
  if (path.startsWith('/api/')) {
    return `${SERVER_BASE_URL}${path}`;
  } else if (path.startsWith('/uploads/')) {
    return `${SERVER_BASE_URL}/api${path}`;
  }
  return `${SERVER_BASE_URL}${path}`;
};

export default instance;
