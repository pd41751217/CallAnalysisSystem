import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { protect } from '../middleware/auth.js';
import { broadcastDashboardUpdate } from '../utils/dashboardBroadcast.js';
import { speechToTextService } from '../services/speechToTextService.js';

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'audio');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use the filename provided by the C++ client (ID_StartTime_Duration.mp3)
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (
      file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3' || name.endsWith('.mp3') ||
      file.mimetype === 'audio/wav' || name.endsWith('.wav')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 or WAV audio files are allowed'), false);
    }
  }
});

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

// @route   GET /api/calls/transcript/:callId
// @desc    Get real-time transcript for a call (SSE endpoint for C++ client)
// @access  Private
router.get('/transcript/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    // Validate call exists and user has access
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('call_id, user_id, status')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or access denied'
      });
    }

    // Set up Server-Sent Events for real-time transcript streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({
      type: 'connected',
      callId,
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Register callback for transcript updates
    const transcriptCallback = (transcriptData) => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'transcript',
          callId,
          transcript: transcriptData,
          timestamp: new Date().toISOString()
        })}\n\n`);
      } catch (error) {
        logger.error('Error sending transcript via SSE:', error);
      }
    };

    speechToTextService.onTranscript(callId, transcriptCallback);

    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({
          type: 'heartbeat',
          callId,
          timestamp: new Date().toISOString()
        })}\n\n`);
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      // Remove callback from STT service
      const callbacks = speechToTextService.transcriptCallbacks.get(callId);
      if (callbacks) {
        const index = callbacks.indexOf(transcriptCallback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
      logger.info(`Transcript SSE connection closed for call ${callId}`);
    });

  } catch (error) {
    logger.error('Transcript SSE error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to start transcript stream' 
    });
  }
});

// @route   GET /api/calls/transcript-poll/:callId
// @desc    Get latest transcript for a call (Simple polling endpoint for C++ client)
// @access  Private
router.get('/transcript-poll/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    // Validate call exists and user has access
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('call_id, user_id, status')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or access denied'
      });
    }

    // Get latest transcript from database
    const { data: transcripts, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('call_id', callId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (transcriptError) {
      logger.error('Error fetching transcript:', transcriptError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch transcript'
      });
    }

    // Return the latest transcript or empty response
    const latestTranscript = transcripts && transcripts.length > 0 ? transcripts[0] : null;
    
    res.json({
      success: true,
      callId,
      transcript: latestTranscript,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Transcript polling error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch transcript' 
    });
  }
});

// @route   GET /api/calls/stt-status/:callId
// @desc    Get STT processing status for a call
// @access  Private
router.get('/stt-status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    // Validate call exists and user has access
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('call_id, user_id')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or access denied'
      });
    }

    const status = speechToTextService.getStatus(callId);

    res.json({
      success: true,
      callId,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('STT status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get STT status' 
    });
  }
});

// @route   GET /api/call-history
// @desc    Get call history rows
// @access  Private
router.get('/history-all', async (req, res) => {
  try {
    // Basic list ordered by start_time desc
    const { data, error } = await supabase
      .from('call_histories')
      .select('*')
      .order('start_time', { ascending: false });

    if (error) throw error;

    res.json({ success: true, items: data || [] });
  } catch (error) {
    logger.error('Get call history error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch call history' });
  }
});

// @route   POST /api/calls/upload-audio
// @desc    Upload audio file for a call
// @access  Private
router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    const { callId, duration } = req.body;
    const userId = req.user.id;

    // Debug logging
    logger.info('Upload request received:', {
      callId: callId,
      duration: duration,
      userId: userId,
      hasFile: !!req.file,
      fileName: req.file?.filename,
      body: req.body
    });

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
    }

    if (!callId) {
      // Delete the uploaded file if no callId provided
      fs.unlinkSync(req.file.path);
      logger.error('No callId provided in audio stream');
      return res.status(400).json({
        success: false,
        message: 'Call ID is required'
      });
    }

    // Verify the call exists and belongs to the user
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('call_id, user_id')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !call) {
      // Delete the uploaded file if call not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Call not found or access denied'
      });
    }

    // If WAV, transcode to MP3 for consistent playback in UI
    let finalFileName = req.file.filename;
    const uploadDir = path.join(process.cwd(), 'uploads', 'audio');
    const filePath = path.join(uploadDir, req.file.filename);
    const lower = req.file.filename.toLowerCase();

    if (lower.endsWith('.wav')) {
      try {
        // Use fluent-ffmpeg to transcode to MP3; try to set binary path if available
        const ffmpegMod = (await import('fluent-ffmpeg')).default;
        try {
          const ffmpegInstaller = await import('@ffmpeg-installer/ffmpeg');
          if (ffmpegInstaller?.path) {
            ffmpegMod.setFfmpegPath(ffmpegInstaller.path);
          }
        } catch (e) {
          // ffmpeg installer not available; rely on system ffmpeg
          logger.warn('ffmpeg installer not found; using system ffmpeg if present');
        }

        const mp3Name = req.file.filename.replace(/\.wav$/i, '.mp3');
        const mp3Path = path.join(uploadDir, mp3Name);

        await new Promise((resolve, reject) => {
          ffmpegMod(filePath)
            .audioCodec('libmp3lame')
            .format('mp3')
            .on('end', resolve)
            .on('error', reject)
            .save(mp3Path);
        });

        // Replace final file name with mp3; optionally delete wav
        try { fs.unlinkSync(filePath); } catch (e) {}
        finalFileName = mp3Name;
      } catch (e) {
        logger.warn('Transcode to MP3 failed; keeping WAV:', e);
        // Fall back to serving WAV if transcode fails
        finalFileName = req.file.filename;
      }
    }

    // Note: We don't need to update the calls table with audio_file
    // The call_histories table already has the file_path field

    // Upsert into call_histories
    try {
      // Fetch agent name and customer from calls.analysis_data
      const { data: callRow } = await supabase
        .from('calls')
        .select(`call_id, user_id, duration, created_at, analysis_data, users(name)`)
        .eq('call_id', callId)
        .single();

      const agentName = callRow?.users?.name || 'Unknown';
      const customer = callRow?.analysis_data?.customer_number || 'Unknown';
      const startTime = callRow?.created_at || new Date().toISOString();
      const recordingDuration = parseInt(duration) || 0; // Use uploaded duration

      // Log all data being used for insert
      logger.info('Call_histories insert data:', {
        callId: callId,
        agentName: agentName,
        customer: customer,
        startTime: startTime,
        duration: recordingDuration,
        finalFileName: finalFileName,
        callRow: callRow
      });

      // Use Supabase upsert instead of raw SQL
      const insertData = {
        case_id: callId,
        agent: agentName,
        customer: customer,
        start_time: startTime,
        duration: recordingDuration,
        file_path: finalFileName
      };

      logger.info('Upserting data:', insertData);

      const { data: insertResult, error: insertError } = await supabase
        .from('call_histories')
        .upsert(insertData, {
          onConflict: 'case_id'
        })
        .select();

      if (insertError) {
        logger.error('Upsert error:', insertError);
        throw insertError;
      }

      logger.info('Upsert result:', insertResult);
      logger.info('Successfully upserted call_histories record for callId:', callId);
    } catch (e) {
      logger.error('Failed to upsert call_histories:', e);
    }

    logger.info(`Audio file uploaded for call ${callId}: ${req.file.filename}`);

    res.json({
      success: true,
      message: 'Audio file uploaded successfully',
      filename: req.file.filename
    });

  } catch (error) {
    logger.error('Upload audio error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload audio file'
    });
  }
});

// @route   GET /api/calls/audio/:callId
// @desc    Serve audio file for a call
// @access  Private
router.get('/audio/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    // Get call information from call_histories table
    const { data: callHistory, error: callError } = await supabase
      .from('call_histories')
      .select('file_path')
      .eq('case_id', callId)
      .single();

    if (callError || !callHistory) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or no audio file available'
      });
    }

    if (!callHistory.file_path) {
      return res.status(404).json({
        success: false,
        message: 'No audio file found for this call'
      });
    }

    const audioPath = path.join(process.cwd(), 'uploads', 'audio', callHistory.file_path);

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({
        success: false,
        message: 'Audio file not found on server'
      });
    }

    // Set appropriate headers for audio streaming
    const lowerName = callHistory.file_path.toLowerCase();
    const mime = lowerName.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${callHistory.file_path}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Stream the audio file
    const audioStream = fs.createReadStream(audioPath);
    audioStream.pipe(res);

    audioStream.on('error', (error) => {
      logger.error('Error streaming audio file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming audio file'
        });
      }
    });

  } catch (error) {
    logger.error('Serve audio error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve audio file'
    });
  }
});

// @route   DELETE /api/calls/:callId
// @desc    Delete a call record
// @access  Private
router.delete('/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    logger.info('Delete call request received:', {
      callId: callId,
      userId: userId
    });

    // Verify the call exists and belongs to the user
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('call_id, user_id')
      .eq('call_id', callId)
      .eq('user_id', userId)
      .single();

    if (callError || !call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found or access denied'
      });
    }

    // Delete the call record
    const { error: deleteError } = await supabase
      .from('calls')
      .delete()
      .eq('call_id', callId)
      .eq('user_id', userId);

    if (deleteError) {
      logger.error('Failed to delete call:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete call record'
      });
    }

    logger.info(`Call ${callId} deleted successfully`);

    res.json({
      success: true,
      message: 'Call record deleted successfully'
    });
  } catch (error) {
    logger.error('Delete call error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete call record'
    });
  }
});

export default router;
