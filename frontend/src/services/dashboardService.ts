import api from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  status: 'online' | 'offline' | 'calling';
  lastActive: string;
}

export interface ActiveCall {
  id: string;
  user_id: string;
  agentName: string;
  agentEmail: string;
  customerNumber: string;
  startTime: string;
  duration: string;
  status: 'active' | 'on-hold' | 'transferring';
}

export interface DashboardMetrics {
  totalUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  callingUsers: number;
  liveCalls: number;
}

export interface DashboardData {
  users: {
    totalUsers: number;
    onlineUsers: number;
    offlineUsers: number;
    callingUsers: number;
    users: User[];
  };
  calls: {
    totalActive: number;
    activeCalls: ActiveCall[];
  };
}

export const dashboardService = {
  // Get all dashboard data (users and calls)
  getDashboardData: async (): Promise<DashboardData> => {
    const [usersResponse, callsResponse] = await Promise.all([
      api.get('/dashboard/users'),
      api.get('/dashboard/live')
    ]);

    return {
      users: usersResponse.data,
      calls: callsResponse.data
    };
  },

  // Get users with online/offline/calling status
  getUsers: async (): Promise<{ totalUsers: number; onlineUsers: number; offlineUsers: number; callingUsers: number; users: User[] }> => {
    const response = await api.get('/dashboard/users');
    return response.data;
  },

  // Get active calls
  getActiveCalls: async (): Promise<{ totalActive: number; activeCalls: ActiveCall[] }> => {
    const response = await api.get('/dashboard/live');
    return response.data;
  },

  // Get dashboard metrics
  getMetrics: async (): Promise<DashboardMetrics> => {
    const [usersResponse, callsResponse] = await Promise.all([
      api.get('/dashboard/users'),
      api.get('/dashboard/live')
    ]);

    const usersData = usersResponse.data;
    const callsData = callsResponse.data;

    return {
      totalUsers: usersData.totalUsers,
      onlineUsers: usersData.onlineUsers,
      offlineUsers: usersData.offlineUsers,
      callingUsers: usersData.callingUsers,
      liveCalls: callsData.totalActive
    };
  },

  // Get user statistics
  getUserStats: async (): Promise<any> => {
    const response = await api.get('/dashboard/user-stats');
    return response.data;
  },

  // Get call statistics
  getCallStats: async (): Promise<any> => {
    const response = await api.get('/dashboard/call-stats');
    return response.data;
  },

  // Get real-time updates (if needed for polling fallback)
  getRealtimeUpdates: async (): Promise<any> => {
    const response = await api.get('/dashboard/realtime');
    return response.data;
  },
};
