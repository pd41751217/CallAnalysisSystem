import api from './api';

export interface Call {
  id: string;
  callId: string;
  agentId: string;
  agentName: string;
  customerNumber: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'active' | 'completed' | 'missed';
  recordingUrl?: string;
  analysis?: CallAnalysis;
}

export interface CallAnalysis {
  id: string;
  callId: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  summary: string;
  complianceScore: number;
  qualityScore: number;
  createdAt: string;
}

export interface CallFilters {
  startDate?: string;
  endDate?: string;
  agentId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const callService = {
  // Get all calls with optional filters
  getCalls: async (filters?: CallFilters): Promise<{ calls: Call[]; total: number }> => {
    const response = await api.get('/calls', { params: filters });
    return response.data;
  },

  // Get a specific call by ID
  getCallById: async (callId: string): Promise<Call> => {
    const response = await api.get(`/calls/${callId}`);
    return response.data;
  },

  // Get call analysis
  getCallAnalysis: async (callId: string): Promise<CallAnalysis> => {
    const response = await api.get(`/calls/${callId}/analysis`);
    return response.data;
  },

  // Start a new call
  startCall: async (callData: Partial<Call>): Promise<Call> => {
    const response = await api.post('/calls', callData);
    return response.data;
  },

  // End a call
  endCall: async (callId: string, endTime: string): Promise<Call> => {
    const response = await api.put(`/calls/${callId}/end`, { endTime });
    return response.data;
  },

  // Get live calls
  getLiveCalls: async (): Promise<Call[]> => {
    const response = await api.get('/calls/live');
    return response.data;
  },

  // Get call statistics
  getCallStats: async (filters?: CallFilters): Promise<any> => {
    const response = await api.get('/calls/stats', { params: filters });
    return response.data;
  },
};
