import express from 'express';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   GET /api/dashboard/overview
// @desc    Get dashboard overview data
// @access  Private
router.get('/overview', async (req, res) => {
  try {
    // Get total calls
    const totalCallsResult = await query('SELECT COUNT(*) as total FROM calls');
    const totalCalls = parseInt(totalCallsResult.rows[0].total);

    // Get active calls
    const activeCallsResult = await query('SELECT COUNT(*) as total FROM calls WHERE status = $1', ['active']);
    const activeCalls = parseInt(activeCallsResult.rows[0].total);

    // Get total agents
    const totalAgentsResult = await query('SELECT COUNT(*) as total FROM users WHERE role = $1 AND status = $2', ['agent', 'active']);
    const totalAgents = parseInt(totalAgentsResult.rows[0].total);

    // Get total team leads
    const totalTeamLeadsResult = await query('SELECT COUNT(*) as total FROM users WHERE role = $1 AND status = $2', ['team_lead', 'active']);
    const totalTeamLeads = parseInt(totalTeamLeadsResult.rows[0].total);

    // Get average call duration
    const avgDurationResult = await query('SELECT AVG(duration) as avg_duration FROM calls WHERE duration IS NOT NULL');
    const avgDuration = avgDurationResult.rows[0].avg_duration ? Math.round(avgDurationResult.rows[0].avg_duration) : 0;

    // Get call type distribution
    const callTypeResult = await query(`
      SELECT call_type, COUNT(*) as count 
      FROM calls 
      GROUP BY call_type
    `);

    // Get sentiment distribution
    const sentimentResult = await query(`
      SELECT sentiment, COUNT(*) as count 
      FROM sentiment_analysis 
      GROUP BY sentiment
    `);

    // Get recent calls
    const recentCallsResult = await query(`
      SELECT c.*, u.name as agent_name, t.name as team_name
      FROM calls c 
      LEFT JOIN users u ON c.agent_id = u.id 
      LEFT JOIN teams t ON u.team_id = t.id 
      ORDER BY c.start_time DESC 
      LIMIT 10
    `);

    // Get agent status
    const agentStatusResult = await query(`
      SELECT as.*, u.name as agent_name, t.name as team_name
      FROM agent_status as
      LEFT JOIN users u ON as.user_id = u.id 
      LEFT JOIN teams t ON u.team_id = t.id 
      WHERE u.role = 'agent' AND u.status = 'active'
      ORDER BY as.last_activity DESC
    `);

    res.json({
      overview: {
        totalCalls,
        activeCalls,
        totalAgents,
        totalTeamLeads,
        avgDuration
      },
      callTypes: callTypeResult.rows,
      sentiments: sentimentResult.rows,
      recentCalls: recentCallsResult.rows,
      agentStatus: agentStatusResult.rows
    });

  } catch (error) {
    logger.error('Get dashboard overview error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/dashboard/analytics
// @desc    Get analytics data
// @access  Private
router.get('/analytics', async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    
    let dateFilter = '';
    let params = [];
    
    if (period === '7d') {
      dateFilter = 'WHERE c.start_time >= CURRENT_DATE - INTERVAL \'7 days\'';
    } else if (period === '30d') {
      dateFilter = 'WHERE c.start_time >= CURRENT_DATE - INTERVAL \'30 days\'';
    } else if (period === '90d') {
      dateFilter = 'WHERE c.start_time >= CURRENT_DATE - INTERVAL \'90 days\'';
    }

    // Get calls per day
    const callsPerDayResult = await query(`
      SELECT DATE(c.start_time) as date, COUNT(*) as count
      FROM calls c 
      ${dateFilter}
      GROUP BY DATE(c.start_time)
      ORDER BY date DESC
      LIMIT 30
    `, params);

    // Get productivity trends
    const productivityResult = await query(`
      SELECT DATE(c.start_time) as date, AVG(cad.productivity_percentage) as avg_productivity
      FROM calls c 
      LEFT JOIN call_audit_data cad ON c.id = cad.call_id
      ${dateFilter}
      WHERE cad.productivity_percentage IS NOT NULL
      GROUP BY DATE(c.start_time)
      ORDER BY date DESC
      LIMIT 30
    `, params);

    // Get sentiment trends
    const sentimentTrendResult = await query(`
      SELECT DATE(sa.timestamp) as date, 
             COUNT(CASE WHEN sa.sentiment = 'positive' THEN 1 END) as positive,
             COUNT(CASE WHEN sa.sentiment = 'negative' THEN 1 END) as negative,
             COUNT(CASE WHEN sa.sentiment = 'neutral' THEN 1 END) as neutral
      FROM sentiment_analysis sa
      LEFT JOIN calls c ON sa.call_id = c.id
      ${dateFilter}
      GROUP BY DATE(sa.timestamp)
      ORDER BY date DESC
      LIMIT 30
    `, params);

    res.json({
      callsPerDay: callsPerDayResult.rows,
      productivity: productivityResult.rows,
      sentimentTrends: sentimentTrendResult.rows
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
    const activeCallsResult = await query(`
      SELECT c.*, u.name as agent_name, t.name as team_name
      FROM calls c 
      LEFT JOIN users u ON c.agent_id = u.id 
      LEFT JOIN teams t ON u.team_id = t.id 
      WHERE c.status = 'active'
      ORDER BY c.start_time ASC
    `);

    // Get recent sentiment updates
    const recentSentimentResult = await query(`
      SELECT sa.*, c.call_id, u.name as agent_name
      FROM sentiment_analysis sa
      LEFT JOIN calls c ON sa.call_id = c.id
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE sa.timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
      ORDER BY sa.timestamp DESC
      LIMIT 50
    `);

    // Get recent events
    const recentEventsResult = await query(`
      SELECT e.*, c.call_id, u.name as agent_name
      FROM events e
      LEFT JOIN calls c ON e.call_id = c.id
      LEFT JOIN users u ON c.agent_id = u.id
      WHERE e.timestamp >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
      ORDER BY e.timestamp DESC
      LIMIT 50
    `);

    res.json({
      activeCalls: activeCallsResult.rows,
      recentSentiment: recentSentimentResult.rows,
      recentEvents: recentEventsResult.rows
    });

  } catch (error) {
    logger.error('Get live data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
