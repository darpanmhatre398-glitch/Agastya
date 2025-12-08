import axios from 'axios';

// Configure base URL for API calls
// In Electron (file:// protocol), always use absolute localhost URL
// When served via nginx (Docker), use relative path - nginx proxies /api/ to backend
// This works for both localhost and network access since nginx handles the routing
const isElectron = window.location.protocol === 'file:' || window.electronAPI?.isElectron;

// Use relative path for web (nginx will proxy), absolute for Electron
const API_URL = isElectron 
  ? 'http://localhost:8765'
  : (import.meta.env.VITE_API_URL || ''); // Empty string = relative path, nginx proxies

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
