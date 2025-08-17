import express from 'express';
import { supabase } from '../config/supabase.js';
import { getOverviewStats, getDashboardStats } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { protect } from '../middleware/auth.js';
import { broadcastDashboardUpdate } from '../utils/dashboardBroadcast.js';

const router = express.Router();

// Apply auth middleware to all routes except SSE endpoints
router.use((req, res, next) => {
  // Skip authentication for SSE endpoints
  if (req.path === '/updates') {
    return next();
  }
  return protect(req, res, next);
});





// @route   GET /api/dashboard/overview
// @desc    Get dashboard overview data
// @access  Private
router.get('/overview', async (req, res) => {
  try {
    // Get total calls
    const { count: totalCalls } = await supabase
      .from('calls')
      .select('*', { count: 'exact' });

    // Get active calls
    const { count: activeCalls } = await supabase
      .from('calls')
      .select('*', { count: 'exact' })

    // Get total agents
    const { count: totalAgents } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('role', 'agent')
      .in('status', ['online', 'calling']);

    // Get total team leads
    const { count: totalTeamLeads } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('role', 'team_lead')
      .in('status', ['online', 'calling']);

    // Get average call duration
    const { data: durationData } = await supabase
      .from('calls')
      .select('duration')
      .not('duration', 'is', null);

    const avgDuration = durationData && durationData.length > 0 
      ? Math.round(durationData.reduce((sum, call) => sum + (call.duration || 0), 0) / durationData.length)
      : 0;

    // Get recent calls
    const { data: recentCalls } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      overview: {
        totalCalls: totalCalls || 0,
        activeCalls: activeCalls || 0,
        totalAgents: totalAgents || 0,
        totalTeamLeads: totalTeamLeads || 0,
        avgDuration
      },
      recentCalls: recentCalls || []
    });

  } catch (error) {
    logger.error('Get dashboard overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/users
// @desc    Get users with online/offline/calling status
// @access  Private
router.get('/users', async (req, res) => {
  try {
    // Get all users
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        role,
        last_login,
        team_id,
        status
      `)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    // Get teams data separately
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name');

    if (teamsError) {
      throw teamsError;
    }

    // Create team lookup map
    const teamMap = teams.reduce((map, team) => {
      map[team.id] = team.name;
      return map;
    }, {});

    // Get active calls to determine who is currently calling
    const { data: activeCalls, error: callsError } = await supabase
      .from('calls')
      .select('user_id')
      .eq('status', 'active')

    if (callsError) {
      throw callsError;
    }

    // Create a set of user IDs who are currently in calls
    const callingUserIds = new Set(activeCalls?.map(call => call.user_id) || []);

    // Determine online/offline/calling status based on database status and active calls
    const usersWithStatus = users.map(user => {
      const isCalling = callingUserIds.has(user.id);
      
      let status = user.status || 'offline';
      
      // Override status to 'calling' if user is in an active call
      if (isCalling) {
        status = 'calling';
      }
      
      return {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        team: teamMap[user.team_id] || 'No Team',
        status: status,
        lastActive: user.last_login
      };
    });

    res.json({
      users: usersWithStatus,
      totalUsers: usersWithStatus.length,
      onlineUsers: usersWithStatus.filter(u => u.status === 'online').length,
      offlineUsers: usersWithStatus.filter(u => u.status === 'offline').length,
      callingUsers: usersWithStatus.filter(u => u.status === 'calling').length
    });

  } catch (error) {
    logger.error('Get dashboard users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/analytics
// @desc    Get analytics data
// @access  Private
router.get('/analytics', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    // Get call statistics for the period
    const stats = await getOverviewStats();
    
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

    res.json({
      period,
      totalCalls,
      completedCalls,
      avgDuration,
      avgProductivity,
      callData: stats
    });

  } catch (error) {
    logger.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/live
// @desc    Get live call data
// @access  Private
router.get('/live', async (req, res) => {
  try {
    // Get active calls
    const { data: activeCalls } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false });

    // Convert IDs to strings for consistency
    const activeCallsWithStringIds = (activeCalls || []).map(call => ({
      ...call,
      id: call.id.toString(),
      user_id: call.user_id.toString()
    }));

    res.json({
      activeCalls: activeCallsWithStringIds,
      totalActive: activeCalls ? activeCalls.length : 0
    });

  } catch (error) {
    logger.error('Get live data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/updates
// @desc    Get real-time dashboard updates via Socket.IO (legacy endpoint - deprecated)
// @access  Public
router.get('/updates', (req, res) => {
  res.status(200).json({ 
    message: 'Dashboard updates now use Socket.IO. Please connect via WebSocket.',
    socketEndpoint: '/socket.io/'
  });
});





export default router;
