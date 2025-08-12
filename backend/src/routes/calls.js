import express from 'express';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   GET /api/calls
// @desc    Get call history with filters
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      agent = '', 
      team = '', 
      status = '', 
      sentiment = '',
      startDate = '',
      endDate = '',
      search = ''
    } = req.query;
    
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (c.customer_number ILIKE $${paramCount} OR c.call_id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (agent) {
      paramCount++;
      whereClause += ` AND u.name ILIKE $${paramCount}`;
      params.push(`%${agent}%`);
    }

    if (team) {
      paramCount++;
      whereClause += ` AND t.name ILIKE $${paramCount}`;
      params.push(`%${team}%`);
    }

    if (status) {
      paramCount++;
      whereClause += ` AND c.status = $${paramCount}`;
      params.push(status);
    }

    if (startDate) {
      paramCount++;
      whereClause += ` AND c.start_time >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND c.start_time <= $${paramCount}`;
      params.push(endDate);
    }

    // Get calls with pagination
    const callsResult = await query(
      `SELECT c.*, u.name as agent_name, t.name as team_name,
              cad.productivity_percentage, cad.overall_score
       FROM calls c 
       LEFT JOIN users u ON c.agent_id = u.id 
       LEFT JOIN teams t ON u.team_id = t.id 
       LEFT JOIN call_audit_data cad ON c.id = cad.call_id
       ${whereClause}
       ORDER BY c.start_time DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM calls c 
       LEFT JOIN users u ON c.agent_id = u.id 
       LEFT JOIN teams t ON u.team_id = t.id 
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      calls: callsResult.rows,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        totalRecords: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Get calls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/calls/:id
// @desc    Get call details by ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get call details
    const callResult = await query(
      `SELECT c.*, u.name as agent_name, t.name as team_name
       FROM calls c 
       LEFT JOIN users u ON c.agent_id = u.id 
       LEFT JOIN teams t ON u.team_id = t.id 
       WHERE c.id = $1`,
      [id]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const call = callResult.rows[0];

    // Get sentiment analysis data
    const sentimentResult = await query(
      'SELECT * FROM sentiment_analysis WHERE call_id = $1 ORDER BY timestamp',
      [id]
    );

    // Get call audit data
    const auditResult = await query(
      'SELECT * FROM call_audit_data WHERE call_id = $1',
      [id]
    );

    // Get call transcripts
    const transcriptResult = await query(
      'SELECT * FROM call_transcripts WHERE call_id = $1 ORDER BY timestamp',
      [id]
    );

    // Get events
    const eventsResult = await query(
      'SELECT * FROM events WHERE call_id = $1 ORDER BY timestamp',
      [id]
    );

    res.json({
      call,
      sentiment: sentimentResult.rows,
      audit: auditResult.rows[0] || null,
      transcripts: transcriptResult.rows,
      events: eventsResult.rows
    });

  } catch (error) {
    logger.error('Get call details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/calls
// @desc    Create new call
// @access  Private
router.post('/', async (req, res) => {
  try {
    const { agent_id, customer_number, call_type = 'conventional' } = req.body;

    if (!agent_id || !customer_number) {
      return res.status(400).json({ message: 'Agent ID and customer number are required' });
    }

    const call_id = `CALL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const callResult = await query(
      `INSERT INTO calls (call_id, agent_id, customer_number, start_time, call_type) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4) 
       RETURNING *`,
      [call_id, agent_id, customer_number, call_type]
    );

    // Update agent status to busy
    await query(
      'UPDATE agent_status SET status = $1, current_call_id = $2 WHERE user_id = $3',
      ['busy', callResult.rows[0].id, agent_id]
    );

    logger.info(`Call started: ${call_id} by agent ${agent_id}`);
    res.status(201).json({ call: callResult.rows[0] });

  } catch (error) {
    logger.error('Create call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/calls/:id/end
// @desc    End a call
// @access  Private
router.put('/:id/end', async (req, res) => {
  try {
    const { id } = req.params;

    // Get call details
    const callResult = await query(
      'SELECT * FROM calls WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({ message: 'Active call not found' });
    }

    const call = callResult.rows[0];
    const endTime = new Date();
    const duration = Math.floor((endTime - new Date(call.start_time)) / 1000);

    // Update call
    await query(
      `UPDATE calls 
       SET end_time = $1, duration = $2, status = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [endTime, duration, 'completed', id]
    );

    // Update agent status to idle
    await query(
      'UPDATE agent_status SET status = $1, current_call_id = $2 WHERE user_id = $3',
      ['idle', null, call.agent_id]
    );

    logger.info(`Call ended: ${call.call_id}, duration: ${duration}s`);
    res.json({ message: 'Call ended successfully', duration });

  } catch (error) {
    logger.error('End call error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
