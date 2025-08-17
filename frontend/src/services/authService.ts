import api from './api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'team_lead' | 'agent';
  team?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  // Test API connection
  testConnection: async (): Promise<any> => {
    console.log('Testing API connection...');
    const response = await api.get('/test');
    return response.data;
  },

  // Login user
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    console.log('Attempting login with URL:', '/auth/login');
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Verify token
  verifyToken: async (): Promise<{ user: User }> => {
    const response = await api.post('/auth/verify');
    return response.data;
  },

  // Forgot password
  forgotPassword: async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
  },

  // Reset password
  resetPassword: async (token: string, password: string): Promise<void> => {
    await api.post('/auth/reset-password', { token, password });
  },

  // Logout (client-side only, server logout can be added if needed)
  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Even if server logout fails, we still want to clear local storage
      console.warn('Server logout failed, but clearing local storage');
    }
  },
};
