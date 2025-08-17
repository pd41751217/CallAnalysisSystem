import api from './api';

export interface CallAuditData {
  id: string;
  agentName: string;
  customerNumber: string;
  startTime: string;
  endTime: string;
  duration: string;
  audioUrl: string;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  transcript: TranscriptEntry[];
  summary: string;
  keywords: string[];
  score: number;
}

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  speaker: 'agent' | 'customer';
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export const callAuditService = {
  // Get call audit data by ID
  getCallAudit: async (callId: string): Promise<CallAuditData> => {
    const response = await api.get(`/call-audit/${callId}`);
    return response.data;
  },

  // Download call audio
  downloadAudio: async (callId: string): Promise<Blob> => {
    const response = await api.get(`/call-audit/${callId}/audio`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get call transcript
  getTranscript: async (callId: string): Promise<TranscriptEntry[]> => {
    const response = await api.get(`/call-audit/${callId}/transcript`);
    return response.data;
  },
};
