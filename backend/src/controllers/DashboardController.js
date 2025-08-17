import { User, Call, CallAnalysis } from '../models/index.js';
import { logger } from '../utils/logger.js';

export class DashboardController {
  static async getOverviewStats() {
    try {
      // Get user counts
      const totalUsers = await User.count();
      const totalAgents = await User.count({ role: 'agent' });
      const totalTeamLeads = await User.count({ role: 'team_lead' });
      const totalAdmins = await User.count({ role: 'admin' });

      // Get call counts
      const totalCalls = await Call.count();
      const activeCalls = await Call.count({ status: 'active' });
      const completedCalls = await Call.count({ status: 'completed' });

      // Get average call duration
      const callStats = await Call.getStats();
      const avgDuration = callStats.length > 0 
        ? Math.round(callStats.reduce((sum, call) => sum + (call.duration || 0), 0) / callStats.length)
        : 0;

      // Get recent calls
      const recentCalls = await Call.findAll({ 
        page: 1, 
        limit: 10 
      });

      return {
        overview: {
          totalCalls,
          activeCalls,
          totalAgents,
          totalTeamLeads,
          totalAdmins,
          avgDuration
        },
        recentCalls
      };
    } catch (error) {
      logger.error('Get overview stats error:', error);
      throw error;
    }
  }

  static async getAnalytics(period = '7d') {
    try {
      // Get call statistics for the period
      const stats = await Call.getStats();
      
      // Calculate analytics based on the data
      const totalCalls = stats.length;
      const completedCalls = stats.filter(call => call.status === 'completed').length;
      const avgDuration = stats.length > 0 
        ? Math.round(stats.reduce((sum, call) => sum + (call.duration || 0), 0) / stats.length)
        : 0;

      // Calculate productivity scores
      const productivityScores = stats
        .map(call => call.call_analysis?.productivity_score)
        .filter(score => score !== null && score !== undefined);

      const avgProductivity = productivityScores.length > 0
        ? Math.round(productivityScores.reduce((sum, score) => sum + score, 0) / productivityScores.length)
        : 0;

      // Calculate speech analysis stats
      const speechStats = stats
        .map(call => call.call_analysis)
        .filter(analysis => analysis !== null && analysis !== undefined);

      const avgSpeechPercentage = speechStats.length > 0
        ? Math.round(speechStats.reduce((sum, analysis) => sum + (analysis.speech_percentage || 0), 0) / speechStats.length)
        : 0;

      const avgSilencePercentage = speechStats.length > 0
        ? Math.round(speechStats.reduce((sum, analysis) => sum + (analysis.silence_percentage || 0), 0) / speechStats.length)
        : 0;

      const avgCrosstalkPercentage = speechStats.length > 0
        ? Math.round(speechStats.reduce((sum, analysis) => sum + (analysis.crosstalk_percentage || 0), 0) / speechStats.length)
        : 0;

      return {
        period,
        totalCalls,
        completedCalls,
        avgDuration,
        avgProductivity,
        avgSpeechPercentage,
        avgSilencePercentage,
        avgCrosstalkPercentage,
        callData: stats
      };
    } catch (error) {
      logger.error('Get analytics error:', error);
      throw error;
    }
  }

  static async getLiveData() {
    try {
      // Get active calls
      const activeCalls = await Call.findAll({ 
        page: 1,
        limit: 50
      });

      return {
        activeCalls,
        totalActive: activeCalls.length
      };
    } catch (error) {
      logger.error('Get live data error:', error);
      throw error;
    }
  }

  static async getUserDashboardStats(userId) {
    try {
      // Get user's calls
      const userCalls = await Call.findByUserId(userId);
      
      // Calculate user-specific stats
      const totalCalls = userCalls.length;
      const completedCalls = userCalls.filter(call => call.status === 'completed').length;
      const avgDuration = userCalls.length > 0 
        ? Math.round(userCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / userCalls.length)
        : 0;

      // Calculate productivity scores for user
      const productivityScores = userCalls
        .map(call => call.call_analysis?.productivity_score)
        .filter(score => score !== null && score !== undefined);

      const avgProductivity = productivityScores.length > 0
        ? Math.round(productivityScores.reduce((sum, score) => sum + score, 0) / productivityScores.length)
        : 0;

      // Get recent calls for user
      const recentCalls = userCalls.slice(0, 10);

      return {
        totalCalls,
        completedCalls,
        avgDuration,
        avgProductivity,
        recentCalls
      };
    } catch (error) {
      logger.error('Get user dashboard stats error:', error);
      throw error;
    }
  }

  static async getTeamStats(teamId) {
    try {
      // Get team members
      const teamMembers = await User.findAll({ team_id: teamId });
      const memberIds = teamMembers.map(member => member.id);

      // Get calls for team members
      const teamCalls = [];
      for (const memberId of memberIds) {
        const memberCalls = await Call.findByUserId(memberId);
        teamCalls.push(...memberCalls);
      }

      // Calculate team stats
      const totalCalls = teamCalls.length;
      const completedCalls = teamCalls.filter(call => call.status === 'completed').length;
      const avgDuration = teamCalls.length > 0 
        ? Math.round(teamCalls.reduce((sum, call) => sum + (call.duration || 0), 0) / teamCalls.length)
        : 0;

      // Calculate team productivity
      const productivityScores = teamCalls
        .map(call => call.call_analysis?.productivity_score)
        .filter(score => score !== null && score !== undefined);

      const avgProductivity = productivityScores.length > 0
        ? Math.round(productivityScores.reduce((sum, score) => sum + score, 0) / productivityScores.length)
        : 0;

      return {
        teamMembers: teamMembers.length,
        totalCalls,
        completedCalls,
        avgDuration,
        avgProductivity
      };
    } catch (error) {
      logger.error('Get team stats error:', error);
      throw error;
    }
  }
}
