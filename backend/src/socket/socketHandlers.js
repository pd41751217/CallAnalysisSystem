import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

export const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user data
      const userResult = await query(
        `SELECT u.*, t.name as team_name 
         FROM users u 
         LEFT JOIN teams t ON u.team_id = t.id 
         WHERE u.id = $1 AND u.status = 'active'`,
        [decoded.user.id]
      );

      if (userResult.rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = {
        id: userResult.rows[0].id,
        name: userResult.rows[0].name,
        email: userResult.rows[0].email,
        role: userResult.rows[0].role,
        team: userResult.rows[0].team_name
      };

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
    } else if (socket.user.role === 'team_lead') {
      socket.join('team_leads');
      socket.join('all');
      if (socket.user.team) {
        socket.join(`team_${socket.user.team.toLowerCase().replace(/\s+/g, '_')}`);
      }
    } else {
      socket.join('agents');
      socket.join('all');
      if (socket.user.team) {
        socket.join(`team_${socket.user.team.toLowerCase().replace(/\s+/g, '_')}`);
      }
    }

    // Update agent status to online
    updateAgentStatus(socket.user.id, 'online');

    // Handle call start
    socket.on('call_start', async (data) => {
      try {
        const { agent_id, customer_number, call_type } = data;
        
        const call_id = `CALL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const callResult = await query(
          `INSERT INTO calls (call_id, agent_id, customer_number, start_time, call_type) 
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4) 
           RETURNING *`,
          [call_id, agent_id, customer_number, call_type || 'conventional']
        );

        // Update agent status to busy
        await updateAgentStatus(agent_id, 'busy', callResult.rows[0].id);

        // Emit to all connected clients
        io.emit('call_started', {
          call: callResult.rows[0],
          agent: socket.user
        });

        logger.info(`Call started via WebSocket: ${call_id} by ${socket.user.email}`);
      } catch (error) {
        logger.error('Call start error:', error);
        socket.emit('error', { message: 'Failed to start call' });
      }
    });

    // Handle call end
    socket.on('call_end', async (data) => {
      try {
        const { call_id } = data;
        
        const callResult = await query(
          'SELECT * FROM calls WHERE call_id = $1 AND status = $2',
          [call_id, 'active']
        );

        if (callResult.rows.length === 0) {
          socket.emit('error', { message: 'Call not found or already ended' });
          return;
        }

        const call = callResult.rows[0];
        const endTime = new Date();
        const duration = Math.floor((endTime - new Date(call.start_time)) / 1000);

        // Update call
        await query(
          `UPDATE calls 
           SET end_time = $1, duration = $2, status = $3, updated_at = CURRENT_TIMESTAMP 
           WHERE call_id = $4`,
          [endTime, duration, 'completed', call_id]
        );

        // Update agent status to idle
        await updateAgentStatus(call.agent_id, 'idle');

        // Emit to all connected clients
        io.emit('call_ended', {
          call_id,
          duration,
          agent: socket.user
        });

        logger.info(`Call ended via WebSocket: ${call_id}, duration: ${duration}s`);
      } catch (error) {
        logger.error('Call end error:', error);
        socket.emit('error', { message: 'Failed to end call' });
      }
    });

    // Handle sentiment update
    socket.on('sentiment_update', async (data) => {
      try {
        const { call_id, sentiment, confidence, speaker, text_segment } = data;
        
        const result = await query(
          `INSERT INTO sentiment_analysis (call_id, timestamp, sentiment, confidence, speaker, text_segment) 
           VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5) 
           RETURNING *`,
          [call_id, sentiment, confidence, speaker, text_segment]
        );

        // Emit to all connected clients
        io.emit('sentiment_updated', {
          sentiment: result.rows[0],
          call_id
        });

        logger.debug(`Sentiment updated via WebSocket: ${sentiment} for call ${call_id}`);
      } catch (error) {
        logger.error('Sentiment update error:', error);
        socket.emit('error', { message: 'Failed to update sentiment' });
      }
    });

    // Handle transcript update
    socket.on('transcript_update', async (data) => {
      try {
        const { call_id, speaker, text, confidence } = data;
        
        const result = await query(
          `INSERT INTO call_transcripts (call_id, timestamp, speaker, text, confidence) 
           VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4) 
           RETURNING *`,
          [call_id, speaker, text, confidence]
        );

        // Emit to all connected clients
        io.emit('transcript_updated', {
          transcript: result.rows[0],
          call_id
        });

        logger.debug(`Transcript updated via WebSocket for call ${call_id}`);
      } catch (error) {
        logger.error('Transcript update error:', error);
        socket.emit('error', { message: 'Failed to update transcript' });
      }
    });

    // Handle event
    socket.on('event', async (data) => {
      try {
        const { call_id, event_type, event_data } = data;
        
        const result = await query(
          `INSERT INTO events (call_id, event_type, event_data, timestamp) 
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
           RETURNING *`,
          [call_id, event_type, event_data]
        );

        // Emit to all connected clients
        io.emit('event_triggered', {
          event: result.rows[0],
          call_id
        });

        logger.info(`Event triggered via WebSocket: ${event_type} for call ${call_id}`);
      } catch (error) {
        logger.error('Event error:', error);
        socket.emit('error', { message: 'Failed to trigger event' });
      }
    });

    // Handle agent status update
    socket.on('status_update', async (data) => {
      try {
        const { status } = data;
        
        await updateAgentStatus(socket.user.id, status);

        // Emit to all connected clients
        io.emit('agent_status_updated', {
          agent_id: socket.user.id,
          agent_name: socket.user.name,
          status
        });

        logger.info(`Agent status updated via WebSocket: ${socket.user.email} -> ${status}`);
      } catch (error) {
        logger.error('Status update error:', error);
        socket.emit('error', { message: 'Failed to update status' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        // Update agent status to offline
        await updateAgentStatus(socket.user.id, 'offline');
        
        logger.info(`User disconnected: ${socket.user.email}`);
      } catch (error) {
        logger.error('Disconnect error:', error);
      }
    });
  });
};

// Helper function to update agent status
const updateAgentStatus = async (user_id, status, current_call_id = null) => {
  try {
    await query(
      `INSERT INTO agent_status (user_id, status, current_call_id, last_activity) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         status = $2, 
         current_call_id = $3, 
         last_activity = CURRENT_TIMESTAMP`,
      [user_id, status, current_call_id]
    );
  } catch (error) {
    logger.error('Update agent status error:', error);
    throw error;
  }
};
