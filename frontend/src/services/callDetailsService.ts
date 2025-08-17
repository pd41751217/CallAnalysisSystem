import api from './api';

export interface CallDetails {
  id: string;
  agentId: string;
  agentName: string;
  customerNumber: string;
  startTime: string;
  endTime?: string;
  duration: string;
  status: 'active' | 'completed' | 'disconnected';
  volume: {
    agent: number;
    customer: number;
    overall: number;
  };
  compliance: {
    score: number;
    issues: ComplianceIssue[];
    passed: boolean;
  };
  transcript: TranscriptEntry[];
  messages: Message[];
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
}

export interface ComplianceIssue {
  id: string;
  type: 'critical' | 'warning' | 'info';
  description: string;
  timestamp: string;
  resolved: boolean;
}

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  speaker: 'agent' | 'customer';
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface Message {
  id: string;
  sender: 'agent' | 'supervisor';
  text: string;
  timestamp: string;
  read: boolean;
}

export const callDetailsService = {
  // Get call details by ID
  getCallDetails: async (callId: string): Promise<CallDetails> => {
    const response = await api.get(`/call-details/${callId}`);
    return response.data;
  },

  // Send message to call
  sendMessage: async (callId: string, message: string): Promise<Message> => {
    const response = await api.post(`/call-details/${callId}/messages`, {
      text: message
    });
    return response.data;
  },

  // Get call transcript
  getTranscript: async (callId: string): Promise<TranscriptEntry[]> => {
    const response = await api.get(`/call-details/${callId}/transcript`);
    return response.data;
  },

  // Get call compliance report
  getComplianceReport: async (callId: string): Promise<any> => {
    const response = await api.get(`/call-details/${callId}/compliance`);
    return response.data;
  },
};
