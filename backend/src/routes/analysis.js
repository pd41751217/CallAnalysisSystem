import express from 'express';
import { createCallAnalysis } from '../config/supabase.js';
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

    // Store sentiment data in the call's analysis_data JSONB field
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('analysis_data')
      .eq('id', call_id)
      .single();

    if (callError) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const currentAnalysis = call.analysis_data || {};
    const sentimentData = {
      timestamp: new Date().toISOString(),
      sentiment,
      confidence,
      speaker,
      text_segment
    };

    const updatedAnalysis = {
      ...currentAnalysis,
      sentiment_history: [...(currentAnalysis.sentiment_history || []), sentimentData]
    };

    const { data: updatedCall, error: updateError } = await supabase
      .from('calls')
      .update({ analysis_data: updatedAnalysis })
      .eq('id', call_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(201).json({ sentiment: sentimentData });

  } catch (error) {
    logger.error('Add sentiment error:', error);
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
      productivity_score, 
      speech_percentage, 
      silence_percentage, 
      crosstalk_percentage, 
      music_percentage, 
      analysis_summary, 
      detailed_results 
    } = req.body;

    if (!call_id) {
      return res.status(400).json({ message: 'Call ID is required' });
    }

    const analysisData = {
      call_id: parseInt(call_id),
      productivity_score: productivity_score || 0,
      speech_percentage: speech_percentage || 0,
      silence_percentage: silence_percentage || 0,
      crosstalk_percentage: crosstalk_percentage || 0,
      music_percentage: music_percentage || 0,
      analysis_summary: analysis_summary || '',
      detailed_results: detailed_results || {}
    };

    const result = await createCallAnalysis(analysisData);
    res.status(201).json({ audit: result });

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

    // Store event data in the call's analysis_data JSONB field
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('analysis_data')
      .eq('id', call_id)
      .single();

    if (callError) {
      return res.status(404).json({ message: 'Call not found' });
    }

    const currentAnalysis = call.analysis_data || {};
    const eventData = {
      timestamp: new Date().toISOString(),
      event_type,
      event_data: event_data || {}
    };

    const updatedAnalysis = {
      ...currentAnalysis,
      events: [...(currentAnalysis.events || []), eventData]
    };

    const { data: updatedCall, error: updateError } = await supabase
      .from('calls')
      .update({ analysis_data: updatedAnalysis })
      .eq('id', call_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(201).json({ event: eventData });

  } catch (error) {
    logger.error('Add event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
