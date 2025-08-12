import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'team_lead' | 'agent';
  team?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
      // Verify token with backend
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token: string) => {
    try {
      const response = await axios.get('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      localStorage.removeItem('authToken');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Mock authentication for frontend testing
      // In a real app, this would be an API call
      if (email && password) {
        const mockUser = {
          id: '1',
          name: email.split('@')[0] || 'Test User',
          email: email,
          role: 'admin' as const,
          team: 'General'
        };
        
        const mockToken = 'mock-jwt-token-' + Date.now();
        
        localStorage.setItem('authToken', mockToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${mockToken}`;
        setUser(mockUser);
      } else {
        throw new Error('Please enter both email and password.');
      }
    } catch (error) {
      throw new Error('Login failed. Please check your credentials.');
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const forgotPassword = async (email: string) => {
    try {
      await axios.post('/api/auth/forgot-password', { email });
    } catch (error) {
      throw new Error('Failed to send reset email. Please try again.');
    }
  };

  const resetPassword = async (token: string, password: string) => {
    try {
      await axios.post('/api/auth/reset-password', { token, password });
    } catch (error) {
      throw new Error('Failed to reset password. Please try again.');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    forgotPassword,
    resetPassword,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
