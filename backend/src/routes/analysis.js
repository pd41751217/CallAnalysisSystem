import express from 'express';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   POST /api/analysis/sentiment
// @desc    Add sentiment analysis data
// @access  Private
router.post('/sentiment', async (req, res) => {
  try {
    const { call_id, sentiment, confidence, speaker, text_segment } = req.body;

    if (!call_id || !sentiment || !confidence || !speaker) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await query(
      `INSERT INTO sentiment_analysis (call_id, timestamp, sentiment, confidence, speaker, text_segment) 
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5) 
       RETURNING *`,
      [call_id, sentiment, confidence, speaker, text_segment]
    );

    res.status(201).json({ sentiment: result.rows[0] });

  } catch (error) {
    logger.error('Add sentiment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/analysis/transcript
// @desc    Add call transcript
// @access  Private
router.post('/transcript', async (req, res) => {
  try {
    const { call_id, speaker, text, confidence } = req.body;

    if (!call_id || !speaker || !text) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await query(
      `INSERT INTO call_transcripts (call_id, timestamp, speaker, text, confidence) 
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4) 
       RETURNING *`,
      [call_id, speaker, text, confidence]
    );

    res.status(201).json({ transcript: result.rows[0] });

  } catch (error) {
    logger.error('Add transcript error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/analysis/audit
// @desc    Add call audit data
// @access  Private
router.post('/audit', async (req, res) => {
  try {
    const { 
      call_id, 
      productivity_percentage, 
      speech_percentage, 
      silence_percentage, 
      crosstalk_percentage, 
      music_percentage, 
      overall_score, 
      keywords, 
      compliance_issues 
    } = req.body;

    if (!call_id) {
      return res.status(400).json({ message: 'Call ID is required' });
    }

    const result = await query(
      `INSERT INTO call_audit_data (call_id, productivity_percentage, speech_percentage, silence_percentage, 
                                   crosstalk_percentage, music_percentage, overall_score, keywords, compliance_issues) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [call_id, productivity_percentage, speech_percentage, silence_percentage, 
       crosstalk_percentage, music_percentage, overall_score, keywords, compliance_issues]
    );

    res.status(201).json({ audit: result.rows[0] });

  } catch (error) {
    logger.error('Add audit data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/analysis/event
// @desc    Add call event
// @access  Private
router.post('/event', async (req, res) => {
  try {
    const { call_id, event_type, event_data } = req.body;

    if (!call_id || !event_type) {
      return res.status(400).json({ message: 'Call ID and event type are required' });
    }

    const result = await query(
      `INSERT INTO events (call_id, event_type, event_data, timestamp) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [call_id, event_type, event_data]
    );

    res.status(201).json({ event: result.rows[0] });

  } catch (error) {
    logger.error('Add event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
