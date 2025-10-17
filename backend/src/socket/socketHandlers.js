import jwt from 'jsonwebtoken';
import { User, Call } from '../models/index.js';
import { AuthController, CallController } from '../controllers/index.js';
import { logger } from '../utils/logger.js';

export const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      // Verify token and get user
      const user = await AuthController.verifyToken(token);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.email}`);

    // Join user to appropriate rooms based on role
    if (socket.user.role === 'admin') {
      socket.join('admin');
      socket.join('all');
      socket.join('dashboard'); // Join dashboard room for real-time updates
    } else if (socket.user.role === 'team_lead') {
      socket.join('team_leads');
      socket.join('all');
      socket.join('dashboard'); // Join dashboard room for real-time updates
      if (socket.user.team) {
        socket.join(`team_${socket.user.team.toLowerCase().replace(/\s+/g, '_')}`);
      }
    } else {
      socket.join('agents');
      socket.join('all');
      socket.join('dashboard'); // Join dashboard room for real-time updates
      if (socket.user.team) {
        socket.join(`team_${socket.user.team.toLowerCase().replace(/\s+/g, '_')}`);
      }
    }

    // Join user-specific room
    socket.join(`user_${socket.user.id}`);

    // Update user's last activity
    User.updateLastLogin(socket.user.id);

    // Handle call start
    socket.on('call_start', async (data) => {
      try {
        const { customer_number, call_type } = data;
        
        const callData = {
          call_id: `CALL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          user_id: socket.user.id,
          analysis_data: {
            customer_number,
            call_type: call_type || 'conventional'
          }
        };

        const newCall = await CallController.createCall(callData);

        // Emit to all connected clients
        io.emit('call_started', {
          call: newCall,
          agent: socket.user
        });

        logger.info(`Call started via WebSocket: ${newCall.call_id} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Call start error:', error);
        socket.emit('error', { message: 'Failed to start call' });
      }
    });

    // Handle call end
    socket.on('call_end', async (data) => {
      try {
        const { call_id, duration } = data;
        
        const updates = {
          status: 'completed',
          duration: duration || 0
        };

        const updatedCall = await CallController.updateCall(call_id, updates);

        // Emit to all connected clients
        io.emit('call_ended', {
          call: updatedCall,
          agent: socket.user
        });

        logger.info(`Call ended via WebSocket: ${call_id} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Call end error:', error);
        socket.emit('error', { message: 'Failed to end call' });
      }
    });

    // Handle sentiment update
    socket.on('sentiment_update', async (data) => {
      try {
        const { call_id, sentiment, confidence, speaker, text_segment } = data;

        const sentimentData = {
          sentiment,
          confidence,
          speaker,
          text_segment
        };

        const updatedCall = await CallController.addSentimentAnalysis(call_id, sentimentData);

        // Emit to all connected clients
        io.emit('sentiment_updated', {
          call_id,
          sentiment: {
            timestamp: new Date().toISOString(),
            ...sentimentData
          },
          agent: socket.user
        });

        logger.info(`Sentiment updated via WebSocket: ${call_id} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Sentiment update error:', error);
        socket.emit('error', { message: 'Failed to update sentiment' });
      }
    });


    // Handle call event
    socket.on('event', async (data) => {
      try {
        const { call_id, event_type, event_data } = data;

        const eventData = {
          event_type,
          event_data: event_data || {}
        };

        const updatedCall = await CallController.addEvent(call_id, eventData);

        // Emit to all connected clients
        io.emit('event_triggered', {
          call_id,
          event: {
            timestamp: new Date().toISOString(),
            ...eventData
          },
          agent: socket.user
        });

        logger.info(`Event triggered via WebSocket: ${call_id} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Event error:', error);
        socket.emit('error', { message: 'Failed to trigger event' });
      }
    });

    // Handle status update
    socket.on('status_update', async (data) => {
      try {
        const { status } = data;

        // Update user's last activity
        await User.updateLastLogin(socket.user.id);

        // Emit to all connected clients
        io.emit('agent_status_updated', {
          agent: socket.user,
          status
        });

        logger.info(`Status updated via WebSocket: ${socket.user.email} - ${status}`);
      } catch (error) {
        logger.error('Status update error:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Handle call monitoring (admin only)
    socket.on('join_call_monitoring', async (data) => {
      try {
        const { callId } = data;
        
        // Check if user is admin
        if (socket.user.role !== 'admin') {
          socket.emit('error', { message: 'Access denied. Admin privileges required.' });
          return;
        }

        // Join the call monitoring room
        socket.join(`call_monitoring_${callId}`);
        
        logger.info(`Admin ${socket.user.email} joined call monitoring: ${callId}`);
        console.log(`Admin ${socket.user.email} joined call monitoring room: call_monitoring_${callId}`);
        
        // Send confirmation
        socket.emit('call_monitoring_joined', { callId });
        
      } catch (error) {
        logger.error('Join call monitoring error:', error);
        socket.emit('error', { message: 'Failed to join call monitoring' });
      }
    });

    socket.on('leave_call_monitoring', async (data) => {
      try {
        const { callId } = data;
        
        // Leave the call monitoring room
        socket.leave(`call_monitoring_${callId}`);
        
        logger.info(`Admin ${socket.user.email} left call monitoring: ${callId}`);
        
        // Send confirmation
        socket.emit('call_monitoring_left', { callId });
        
      } catch (error) {
        logger.error('Leave call monitoring error:', error);
        socket.emit('error', { message: 'Failed to leave call monitoring' });
      }
    });

    // Handle dashboard connection
    socket.on('join_dashboard', () => {
      try {
        logger.info(`User ${socket.user.email} joined dashboard`);
        socket.join('dashboard');
        socket.emit('dashboard_connected', { 
          message: 'Connected to dashboard updates',
          userId: socket.user.id,
          role: socket.user.role
        });
      } catch (error) {
        logger.error('Join dashboard error:', error);
        socket.emit('error', { message: 'Failed to join dashboard' });
      }
    });

    // Handle dashboard disconnect
    socket.on('leave_dashboard', () => {
      try {
        logger.info(`User ${socket.user.email} left dashboard`);
        socket.leave('dashboard');
        socket.emit('dashboard_disconnected', { message: 'Disconnected from dashboard updates' });
      } catch (error) {
        logger.error('Leave dashboard error:', error);
        socket.emit('error', { message: 'Failed to leave dashboard' });
      }
    });

    // Handle transcription monitoring request
    socket.on('join_transcription_monitoring', async (data) => {
      try {
        const { callId } = data;
        
        // Check if user has permission to monitor transcriptions
        if (socket.user.role !== 'admin' && socket.user.role !== 'team_lead') {
          socket.emit('error', { message: 'Access denied. Admin or team lead privileges required.' });
          return;
        }

        // Join the transcription monitoring room
        socket.join(`transcription_monitoring_${callId}`);
        
        logger.info(`User ${socket.user.email} joined transcription monitoring: ${callId}`);
        
        // Send confirmation
        socket.emit('transcription_monitoring_joined', { callId });
        
      } catch (error) {
        logger.error('Join transcription monitoring error:', error);
        socket.emit('error', { message: 'Failed to join transcription monitoring' });
      }
    });

    // Handle transcription monitoring leave
    socket.on('leave_transcription_monitoring', async (data) => {
      try {
        const { callId } = data;
        
        // Leave the transcription monitoring room
        socket.leave(`transcription_monitoring_${callId}`);
        
        logger.info(`User ${socket.user.email} left transcription monitoring: ${callId}`);
        
        // Send confirmation
        socket.emit('transcription_monitoring_left', { callId });
        
      } catch (error) {
        logger.error('Leave transcription monitoring error:', error);
        socket.emit('error', { message: 'Failed to leave transcription monitoring' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.user.email}`);
      
      // Emit to all connected clients
      io.emit('agent_disconnected', {
        agent: socket.user
      });
    });
  });
};

