import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from '../utils/logger.js';

class AudioStreamServer {
  constructor(io) {
    this.io = io;
    this.wss = null;
    this.clients = new Map(); // Map of client connections
    this.audioBuffers = new Map(); // Map of callId -> audio buffers
    this.bufferSize = 4096; // Audio buffer size
    this.sampleRate = 44100; // Default sample rate
  }

  start(port = 3001) {
    // Create HTTP server for WebSocket
    const server = createServer();
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });

    // Start HTTP server
    server.listen(port, () => {
      logger.info(`HTTP/WebSocket server started on port ${port}`);
    });

    return server;
  }

  handleWebSocketConnection(ws, req) {
    const clientId = this.generateClientId();
    this.clients.set(clientId, {
      ws,
      type: 'websocket',
      callId: null,
      audioType: null,
      buffer: Buffer.alloc(0)
    });

    logger.info(`WebSocket client connected: ${clientId}`);

    ws.on('message', (data) => {
      logger.debug(`Received WebSocket message from client ${clientId}: ${data.length} bytes`);
      this.handleAudioData(clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket client error: ${error.message}`);
      this.handleDisconnect(clientId);
    });
  }



  handleConnection(ws, req) {
    // Legacy method - now handled by handleWebSocketConnection
    this.handleWebSocketConnection(ws, req);
  }

  handleAudioData(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.debug(`Received WebSocket audio data from client ${clientId}: ${data.length} bytes`);

    try {
      // Parse audio packet header
      if (data.length < 28) {
        logger.warn(`Invalid audio packet size: ${data.length}`);
        return;
      }

      const header = this.parseAudioHeader(data);
      if (header.magic !== 0x41554449) { // "AUDI"
        logger.warn(`Invalid audio packet magic: 0x${header.magic.toString(16)}`);
        return;
      }

      // Extract audio data
      const audioData = data.slice(28, 28 + header.dataSize);
      
      // Convert to base64 for Socket.IO transmission
      const base64Audio = audioData.toString('base64');
      
      // Determine audio type
      const audioType = header.audioType === 0 ? 'speaker' : 'mic';
      
      // Get current timestamp
      const timestamp = new Date().toISOString();
      
      // Try to determine call ID from active calls or use a default
      // For now, we'll broadcast to all monitoring clients since we don't have call ID mapping
      this.broadcastAudioData({
        type: 'audio_data',
        callId: 'active_call', // Use a generic call ID for now
        audioData: base64Audio,
        timestamp,
        audioType,
        sampleRate: header.sampleRate,
        bitsPerSample: header.bitsPerSample,
        channels: header.channels
      });

      logger.debug(`Audio data received: ${audioType}, size: ${audioData.length}, callId: ${client.callId || 'unknown'}`);

    } catch (error) {
      logger.error(`Error processing audio data: ${error.message}`);
    }
  }



  parseAudioHeader(data) {
    return {
      magic: data.readUInt32LE(0),
      dataSize: data.readUInt32LE(4),
      timestamp: data.readUInt32LE(8),
      sampleRate: data.readUInt32LE(12),
      bitsPerSample: data.readUInt32LE(16),
      channels: data.readUInt32LE(20),
      audioType: data.readUInt32LE(24)
    };
  }

  broadcastAudioData(audioData) {
    if (this.io) {
      // Broadcast to all Socket.IO clients monitoring any call
      // This ensures audio reaches the frontend regardless of specific call ID
      this.io.emit('audio_data', audioData);
      
      // Also broadcast to specific call monitoring rooms if they exist
      this.io.to(`call_monitoring_${audioData.callId}`).emit(`call_audio_${audioData.callId}`, audioData);
      
      // Broadcast to general audio stream room
      this.io.to('audio_stream').emit('audio_data', audioData);
      
      logger.debug(`Broadcasting audio data: ${audioData.audioType}, size: ${audioData.audioData.length}`);
    }
  }

  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      logger.info(`Audio client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    }
  }

  generateClientId() {
    return `audio_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getConnectedClients() {
    return this.clients.size;
  }

  stop() {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    this.clients.clear();
    this.audioBuffers.clear();
  }
}

export default AudioStreamServer;
