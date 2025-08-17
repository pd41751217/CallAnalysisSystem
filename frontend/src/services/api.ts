import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Create axios instance with base configuration
const api: AxiosInstance = axios.create({
  // In development, use relative URLs to work with Vite proxy
  // In production, use the full URL
  baseURL: import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api'),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Log the base URL for debugging
console.log('Environment:', import.meta.env.DEV ? 'Development' : 'Production');
console.log('API Base URL:', import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:3001/api'));

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      // Redirect to login page or trigger logout
      window.location.href = '/login';
    }
    
    // Handle other errors
    if (error.response?.data?.message) {
      console.error('API Error:', error.response.data.message);
    } else {
      console.error('API Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
