import axios from 'axios';

// Configure base URL for API calls
const API_URL = process.env.REACT_APP_API_URL || '';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
