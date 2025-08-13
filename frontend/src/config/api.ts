// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  REFRESH_TOKEN: `${API_BASE_URL}/api/auth/refresh`,
  FORGOT_PASSWORD: `${API_BASE_URL}/api/auth/forgot-password`,
  RESET_PASSWORD: `${API_BASE_URL}/api/auth/reset-password`,

  // User endpoints
  USERS: `${API_BASE_URL}/api/users`,
  USER_PROFILE: `${API_BASE_URL}/api/users/profile`,
  UPDATE_PROFILE: `${API_BASE_URL}/api/users/profile`,

  // Call endpoints
  CALLS: `${API_BASE_URL}/api/calls`,
  CALL_DETAILS: (id: string) => `${API_BASE_URL}/api/calls/${id}`,
  CALL_ANALYSIS: (id: string) => `${API_BASE_URL}/api/calls/${id}/analysis`,
  LIVE_CALLS: `${API_BASE_URL}/api/calls/live`,

  // Analysis endpoints
  ANALYSIS: `${API_BASE_URL}/api/analysis`,
  SENTIMENT_ANALYSIS: `${API_BASE_URL}/api/analysis/sentiment`,
  COMPLIANCE_CHECK: `${API_BASE_URL}/api/analysis/compliance`,

  // Dashboard endpoints
  DASHBOARD: `${API_BASE_URL}/api/dashboard`,
  METRICS: `${API_BASE_URL}/api/dashboard/metrics`,
  AGENTS: `${API_BASE_URL}/api/dashboard/agents`,
  REAL_TIME_DATA: `${API_BASE_URL}/api/dashboard/real-time`,

  // Health check
  HEALTH: `${API_BASE_URL}/health`,
};

export default API_ENDPOINTS;
