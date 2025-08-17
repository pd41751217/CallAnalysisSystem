import express from 'express';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { protect } from '../middleware/auth.js';
import { broadcastDashboardUpdate } from '../utils/dashboardBroadcast.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   POST /api/calls/start-recording
// @desc    Start recording session for a user
// @access  Private
router.post('/start-recording', async (req, res) => {
  try {
    const userId = req.user.id;
    const { customerNumber, notes } = req.body;

    // Create a new call record
    const callId = `CALL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { data: call, error } = await supabase
      .from('calls')
      .insert({
        call_id: callId,
        user_id: userId,
        status: 'active',
        created_at: new Date().toISOString(),
        analysis_data: {
          customer_number: customerNumber || 'Unknown',
          call_type: 'conventional'
        },

      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update user's last login and set status to calling
    try {
      const { data: updateResult, error: updateError } = await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          status: 'calling'
        })
        .eq('id', userId)
        .select();
        
      if (updateError) {
        // Try updating just last_login if status column doesn't exist
        await supabase
          .from('users')
          .update({ 
            last_login: new Date().toISOString()
          })
          .eq('id', userId);
      }
    } catch (error) {
      // Fallback: just update last_login
      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString()
        })
        .eq('id', userId);
    }

    // Get user info for broadcast
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, team_id')
      .eq('id', userId)
      .single();

    if (!userError && user) {
      // Get team name
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', user.team_id)
        .single();

      // Broadcast call started event
      broadcastDashboardUpdate('call_started', {
        call: {
          id: call.call_id,
          user_id: userId,
          customer_number: customerNumber || 'Unknown',
          start_time: call.created_at
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          team: team?.name || 'No Team'
        }
      });
    }

    logger.info(`User ${userId} started recording call ${call.call_id}`);

    res.json({
      success: true,
      callId: call.call_id,
      message: 'Recording started successfully'
    });

  } catch (error) {
    logger.error('Start recording error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start recording' 
    });
  }
});

// @route   POST /api/calls/stop-recording
// @desc    Stop recording session for a user
// @access  Private
router.post('/stop-recording', async (req, res) => {
  try {
    const userId = req.user.id;
    const { callId } = req.body;

    // Find and update the active call
    const { data: call, error } = await supabase
      .from('calls')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
        duration: req.body.duration || 0
      })
      .eq('call_id', callId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'No active call found'
      });
    }

    // Update user's last login and set status to online
    try {
      const { data: updateResult, error: updateError } = await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          status: 'online'
        })
        .eq('id', userId)
        .select();
        
      if (updateError) {
        // Try updating just last_login if status column doesn't exist
        await supabase
          .from('users')
          .update({ 
            last_login: new Date().toISOString()
          })
          .eq('id', userId);
      }
    } catch (error) {
      // Fallback: just update last_login
      await supabase
        .from('users')
        .update({ 
          last_login: new Date().toISOString()
        })
        .eq('id', userId);
    }

    // Get user info for broadcast
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, team_id')
      .eq('id', userId)
      .single();

    if (!userError && user) {
      // Get team name
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', user.team_id)
        .single();

      // Broadcast call ended event
      broadcastDashboardUpdate('call_ended', {
        call: {
          id: callId,
          user_id: userId,
          duration: req.body.duration || 0,
          end_time: new Date().toISOString()
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          team: team?.name || 'No Team'
        }
      });
    }

    logger.info(`User ${userId} stopped recording call ${callId}`);

    res.json({
      success: true,
      message: 'Recording stopped successfully'
    });

  } catch (error) {
    logger.error('Stop recording error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to stop recording' 
    });
  }
});

// @route   POST /api/calls/stream-audio
// @desc    Stream audio data from RecSendScAu client
// @access  Private
router.post('/stream-audio', async (req, res) => {
  try {
    const userId = req.user.id;
    const { callId, audioData, timestamp, audioType } = req.body; // audioType: 'speaker' or 'mic'

    // Validate call exists and is active
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('call_id, status')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        message: 'No active call found'
      });
    }

    // Broadcast audio data to admin monitors via Socket.IO
    const io = req.app.get('io');
    if (io) {
      console.log(`Broadcasting audio data for call ${callId}:`, {
        audioType,
        audioDataSize: audioData ? audioData.length : 0,
        timestamp,
        sampleRate: req.body.sampleRate || 44100,
        bitsPerSample: req.body.bitsPerSample || 16,
        channels: req.body.channels || 2
      });
      
      io.to(`call_monitoring_${callId}`).emit(`call_audio_${callId}`, {
        type: 'audio_data',
        callId,
        userId,
        audioData,
        timestamp,
        audioType,
        sampleRate: req.body.sampleRate || 44100,
        bitsPerSample: req.body.bitsPerSample || 16,
        channels: req.body.channels || 2
      });
      
      console.log(`Audio data broadcasted to call_monitoring_${callId} room`);
    } else {
      console.warn('Socket.IO not available for audio broadcasting');
    }

    // Update user's last login
    await supabase
      .from('users')
      .update({ 
        last_login: new Date().toISOString()
      })
      .eq('id', userId);

    res.json({
      success: true,
      message: 'Audio data received and broadcasted'
    });

  } catch (error) {
    logger.error('Stream audio error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process audio data' 
    });
  }
});

// @route   GET /api/calls/active/:userId
// @desc    Get active call for a specific user
// @access  Private
router.get('/active/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    res.json({
      success: true,
      call: call || null
    });

  } catch (error) {
    logger.error('Get active call error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get active call' 
    });
  }
});

// @route   GET /api/calls/stream/:callId
// @desc    Get audio stream for a specific call (for admin monitoring)
// @access  Private (Admin only)
router.get('/stream/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const { token } = req.query;
    
    // For SSE, we need to handle authentication differently since headers aren't available
    // In production, you might want to use WebSocket or implement a different auth mechanism
    let user = null;
    
    if (token) {
      try {
        // Verify token manually here since middleware won't work with SSE
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', decoded.userId)
          .single();
          
        if (userError || !userData) {
          throw new Error('User not found');
        }
        
        user = userData;
      } catch (authError) {
        logger.error('SSE authentication error:', authError);
        return res.status(401).json({
          success: false,
          message: 'Authentication failed'
        });
      }
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get call details
    const { data: call, error } = await supabase
      .from('calls')
      .select(`
        *,
        users (
          name,
          email
        )
      `)
      .eq('call_id', callId)
      .single();

    if (error || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or not active'
      });
    }

    // Set up SSE (Server-Sent Events) for real-time audio streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial call info
    res.write(`data: ${JSON.stringify({
      type: 'call_info',
      call: {
        id: call.call_id,
        agentName: call.users.name,
        agentEmail: call.users.email,
        customerNumber: call.analysis_data?.customer_number || 'Unknown',
        startTime: call.created_at
      }
    })}\n\n`);

    // Keep connection alive and send audio data when available
    const interval = setInterval(() => {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }, 30000); // Send heartbeat every 30 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      logger.info(`Admin ${user.id} stopped monitoring call ${callId}`);
    });

  } catch (error) {
    logger.error('Stream call error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start call stream' 
    });
  }
});

export default router;
