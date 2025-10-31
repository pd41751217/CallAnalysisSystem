import { logger } from '../utils/logger.js';

class AudioStreamServer {
  constructor(io) {
    this.io = io;
    this.activeStreams = new Map(); // Map of callId -> stream info
    this.clients = new Map(); // Map of clientId -> client info
  }

  start() {
    logger.info('Audio streaming server started');
    
    // Set up Socket.IO event handlers
    this.setupSocketHandlers();
    
    return this;
  }

  setupSocketHandlers() {
    if (!this.io) {
      logger.error('Socket.IO not available for audio streaming');
      return;
    }

    this.io.on('connection', (socket) => {
      logger.info(`Audio client connected: ${socket.id}`);
      
      // Store client info
      this.clients.set(socket.id, {
        socket,
      callId: null,
        type: 'monitor' // or 'streamer'
      });

      // Handle joining call monitoring
      socket.on('join_call_monitoring', (data) => {
        const { callId } = data;
        logger.info(`Client ${socket.id} joining call monitoring: ${callId}`);
        
        const client = this.clients.get(socket.id);
        if (client) {
          client.callId = callId;
          client.type = 'monitor';
          socket.join(`call_monitoring_${callId}`);
          
          // Send confirmation
          socket.emit('call_monitoring_joined', { callId });
        }
      });

      // Handle leaving call monitoring
      socket.on('leave_call_monitoring', (data) => {
        const { callId } = data;
        logger.info(`Client ${socket.id} leaving call monitoring: ${callId}`);
        
        socket.leave(`call_monitoring_${callId}`);
        
        const client = this.clients.get(socket.id);
        if (client) {
          client.callId = null;
        }
      });

      // Handle audio data from C++ client
      socket.on('audio_data', (data) => {
        this.handleAudioData(socket.id, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`Audio client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
      });
    });
  }

  handleAudioData(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn(`Unknown client ${clientId} sent audio data`);
        return;
      }

    logger.debug(`Received audio data from ${clientId}: ${data.audioType}, size: ${data.audioData ? data.audioData.length : 0}`);

    // Broadcast to all clients monitoring this call
    if (client.callId) {
      this.broadcastAudioData(client.callId, {
        type: 'audio_data',
        callId: client.callId,
        audioData: data.audioData,
        audioType: data.audioType,
        timestamp: data.timestamp || new Date().toISOString(),
        sampleRate: data.sampleRate || 48000,
        bitsPerSample: data.bitsPerSample || 16,
        channels: data.channels || 2
      });
    }
  }


  broadcastAudioData(callId, audioData) {
    if (!this.io) {
      logger.warn('Socket.IO not available for audio broadcasting');
      return;
    }

    // Broadcast to call monitoring room
    this.io.to(`call_monitoring_${callId}`).emit(`call_audio_${callId}`, audioData);
    
    // Also broadcast to general audio stream room
      this.io.to('audio_stream').emit('audio_data', audioData);
      
    logger.debug(`Broadcasted audio data for call ${callId}: ${audioData.audioType}, size: ${audioData.audioData ? audioData.audioData.length : 0}`);
  }

  getConnectedClients() {
    return this.clients.size;
  }

  getActiveStreams() {
    return this.activeStreams.size;
  }

  stop() {
    logger.info('Audio streaming server stopped');
    this.clients.clear();
    this.activeStreams.clear();
  }
}

export default AudioStreamServer;
