import { Call, CallAnalysis } from '../models/index.js';
import { logger } from '../utils/logger.js';

export class CallController {
  static async getAllCalls(options = {}) {
    try {
      const calls = await Call.findAll(options);
      const total = await Call.count(options);
      
      return {
        calls,
        pagination: {
          current: options.page || 1,
          total: Math.ceil(total / (options.limit || total)),
          totalRecords: total,
          limit: options.limit || total
        }
      };
    } catch (error) {
      logger.error('Get all calls error:', error);
      throw error;
    }
  }

  static async getCallById(id) {
    try {
      const call = await Call.findById(id);
      if (!call) {
        throw new Error('Call not found');
      }
      return call;
    } catch (error) {
      logger.error('Get call by ID error:', error);
      throw error;
    }
  }

  static async getCallByCallId(callId) {
    try {
      const call = await Call.findByCallId(callId);
      if (!call) {
        throw new Error('Call not found');
      }
      return call;
    } catch (error) {
      logger.error('Get call by call ID error:', error);
      throw error;
    }
  }

  static async getCallsByUserId(userId, options = {}) {
    try {
      const calls = await Call.findByUserId(userId, options);
      return calls;
    } catch (error) {
      logger.error('Get calls by user ID error:', error);
      throw error;
    }
  }

  static async createCall(callData) {
    try {
      // Generate unique call ID if not provided
      if (!callData.call_id) {
        callData.call_id = `CALL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Set default status if not provided
      if (!callData.status) {
        callData.status = 'pending';
      }

      const newCall = await Call.create(callData);
      return newCall;
    } catch (error) {
      logger.error('Create call error:', error);
      throw error;
    }
  }

  static async updateCall(id, updates) {
    try {
      // Check if call exists
      const existingCall = await Call.findById(id);
      if (!existingCall) {
        throw new Error('Call not found');
      }

      // Update call
      const updatedCall = await Call.update(id, updates);
      return updatedCall;
    } catch (error) {
      logger.error('Update call error:', error);
      throw error;
    }
  }

  static async deleteCall(id) {
    try {
      // Check if call exists
      const existingCall = await Call.findById(id);
      if (!existingCall) {
        throw new Error('Call not found');
      }

      // Delete call
      await Call.delete(id);
      return { message: 'Call deleted successfully' };
    } catch (error) {
      logger.error('Delete call error:', error);
      throw error;
    }
  }

  static async addSentimentAnalysis(callId, sentimentData) {
    try {
      // Get existing call
      const call = await Call.findById(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      // Get current analysis data
      const currentAnalysis = call.analysis_data || {};
      
      // Add sentiment data
      const newSentimentData = {
        timestamp: new Date().toISOString(),
        ...sentimentData
      };

      const updatedAnalysis = {
        ...currentAnalysis,
        sentiment_history: [...(currentAnalysis.sentiment_history || []), newSentimentData]
      };

      // Update call with new analysis data
      const updatedCall = await Call.updateAnalysisData(callId, updatedAnalysis);
      return updatedCall;
    } catch (error) {
      logger.error('Add sentiment analysis error:', error);
      throw error;
    }
  }

  static async addTranscript(callId, transcriptData) {
    try {
      // Get existing call
      const call = await Call.findById(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      // Get current analysis data
      const currentAnalysis = call.analysis_data || {};
      
      // Add transcript data
      const newTranscriptData = {
        timestamp: new Date().toISOString(),
        ...transcriptData
      };

      const updatedAnalysis = {
        ...currentAnalysis,
        transcript: [...(currentAnalysis.transcript || []), newTranscriptData]
      };

      // Update call with new analysis data
      const updatedCall = await Call.updateAnalysisData(callId, updatedAnalysis);
      return updatedCall;
    } catch (error) {
      logger.error('Add transcript error:', error);
      throw error;
    }
  }

  static async addEvent(callId, eventData) {
    try {
      // Get existing call
      const call = await Call.findById(callId);
      if (!call) {
        throw new Error('Call not found');
      }

      // Get current analysis data
      const currentAnalysis = call.analysis_data || {};
      
      // Add event data
      const newEventData = {
        timestamp: new Date().toISOString(),
        ...eventData
      };

      const updatedAnalysis = {
        ...currentAnalysis,
        events: [...(currentAnalysis.events || []), newEventData]
      };

      // Update call with new analysis data
      const updatedCall = await Call.updateAnalysisData(callId, updatedAnalysis);
      return updatedCall;
    } catch (error) {
      logger.error('Add event error:', error);
      throw error;
    }
  }

  static async createCallAnalysis(analysisData) {
    try {
      const newAnalysis = await CallAnalysis.create(analysisData);
      return newAnalysis;
    } catch (error) {
      logger.error('Create call analysis error:', error);
      throw error;
    }
  }

  static async getCallAnalysis(callId) {
    try {
      const analysis = await CallAnalysis.findByCallId(callId);
      return analysis;
    } catch (error) {
      logger.error('Get call analysis error:', error);
      throw error;
    }
  }

  static async getCallStats(options = {}) {
    try {
      const stats = await Call.getStats(options);
      return stats;
    } catch (error) {
      logger.error('Get call stats error:', error);
      throw error;
    }
  }

  static async getCallCounts(options = {}) {
    try {
      const totalCalls = await Call.count();
      const activeCalls = await Call.count({ status: 'active' });
      const completedCalls = await Call.count({ status: 'completed' });
      const pendingCalls = await Call.count({ status: 'pending' });

      return {
        totalCalls,
        activeCalls,
        completedCalls,
        pendingCalls
      };
    } catch (error) {
      logger.error('Get call counts error:', error);
      throw error;
    }
  }
}
