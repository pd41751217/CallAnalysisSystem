import api from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'team_lead' | 'agent';
  team?: string;
  status: 'active' | 'inactive';
  created_at: string;
  last_login?: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'team_lead' | 'agent';
  team?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: 'admin' | 'team_lead' | 'agent';
  team?: string;
  status?: 'active' | 'inactive';
}

export const userManagementService = {
  // Get all users
  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data.users || response.data;
  },

  // Get all teams
  getTeams: async (): Promise<Team[]> => {
    const response = await api.get('/users/teams');
    return response.data;
  },

  // Create a new user
  createUser: async (userData: CreateUserData): Promise<User> => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  // Update a user
  updateUser: async (userId: string, userData: UpdateUserData): Promise<User> => {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  },

  // Delete a user
  deleteUser: async (userId: string): Promise<void> => {
    await api.delete(`/users/${userId}`);
  },

  // Get user by ID
  getUserById: async (userId: string): Promise<User> => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
};
