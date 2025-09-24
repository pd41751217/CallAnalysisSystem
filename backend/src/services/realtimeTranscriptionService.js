// Real-time Speech Transcription Service using OpenAI's Real-time API
// Based on: https://medium.com/@anirudhgangwal/real-time-speech-transcription-with-openai-and-websockets-76eccf4fe51a

import WebSocket from 'ws';
import { logger } from '../utils/logger.js';

/**
 * Real-time Transcription Service using OpenAI's Real-time API
 * Provides low-latency, streaming transcription via WebSockets
 */
export class RealtimeTranscriptionService {
  constructor() {
    this.connections = new Map(); // callId -> WebSocket connection
    this.config = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      model: 'gpt-4o-realtime-preview',
      sampleRate: 24000, // OpenAI Real-time API expects 24kHz
      channels: 1,
      bitsPerSample: 16,
      chunkSize: 1024, // Audio chunk size in samples
      bufferDuration: 200, // Reduced buffer duration for more responsive VAD
      minBufferDuration: 200 // Minimum buffer duration in ms (200ms for responsive VAD)
    };
    
    // Initialize audio source configuration
    this.audioSource = this.getAudioSourceConfig();
    
    // Initialize audio buffer queues
    this.audioBuffers = new Map(); // callId -> { mic: [], speaker: [] }
    
    // Get max queue size from environment (in milliseconds)
    this.maxQueueSizeMs = parseInt(process.env.MAX_QUEUE_SIZE_FOR_OPENAI) || 5000; // Default 5000ms
    
    // Start background thread to process queues
    this.startQueueProcessor();
    
    
    // Validate API key
    if (!this.config.apiKey || this.config.apiKey === 'your_openai_api_key_here') {
      throw new Error('OPENAI_API_KEY is required for RealtimeTranscriptionService');
    }
  }


  /**
   * Process audio buffer queue and send to OpenAI
   * @param {string} callId - Call identifier
   * @param {string} audioType - Audio type (mic or speaker)
   * @param {Object} audioConnection - Audio connection object
   */
  processBufferQueue(callId, audioType, audioConnection) {
    const audioBufferQueue = this.audioBuffers.get(callId);
    if (!audioBufferQueue || !audioBufferQueue[audioType] || audioBufferQueue[audioType].length === 0) {
      return;
    }

    // Combine all buffered audio chunks
    const combinedBuffer = Buffer.concat(audioBufferQueue[audioType]);
    
    // Calculate duration
    const samplesPerSecond = 24000;
    const bytesPerSample = 2; // 16-bit = 2 bytes
    const durationMs = (combinedBuffer.length / bytesPerSample / samplesPerSecond) * 1000;
    
    // Send combined audio data to OpenAI
    const audioMessage = {
      type: 'input_audio_buffer.append',
      audio: combinedBuffer.toString('base64')
    };
    
    console.log(`📤 Sending buffered audio data for call ${callId}_${audioType}, length=${combinedBuffer.length}, duration=${durationMs}ms`);
    
    // audioConnection.ws.send(JSON.stringify(audioMessage));
        
    // With server VAD enabled, we don't need to manually commit
    // The server will automatically commit when it detects speech
    console.log(`📤 Buffered audio data sent to OpenAI (${combinedBuffer.length} bytes) - server VAD will handle commit`);
    
    // Clear the buffer queue after sending - properly clear heap
    this.clearAudioQueue(audioBufferQueue[audioType]);
    audioBufferQueue[audioType].length = 0;
  }

  /**
   * Start background thread to process audio queues
   */
  startQueueProcessor() {
    // Process queues every 100ms for responsive processing
    // function repeat() {
    //   this.processAllQueues();
    //   setTimeout(repeat, 100);
    // }
    setInterval(() => {
      this.processAllQueues();
    }, 100);
  }

  /**
   * Process all audio queues and send data to OpenAI
   */
  processAllQueues() {
    for (const [callId, audioBufferQueue] of this.audioBuffers.entries()) {
      // Process both mic and speaker queues
      for (const audioType of ['mic', 'speaker']) {
        if (audioBufferQueue[audioType] && audioBufferQueue[audioType].length > 0) {
          const connectionKey = `${callId}_${audioType}`;
          const audioConnection = this.connections.get(connectionKey);
          
          if (audioConnection && audioConnection.isConnected && audioConnection.isConfigured) {
            this.processBufferQueue(callId, audioType, audioConnection);
          }
        }
      }
    }
  }

  /**
   * Clear audio queue and free memory
   * @param {Array} audioQueue - Array of audio buffers to clear
   */
  clearAudioQueue(audioQueue) {
    if (!audioQueue || audioQueue.length === 0) return;
    
    // Clear each buffer explicitly to free memory
    audioQueue.forEach(buffer => {
      if (buffer && buffer.fill) {
        buffer.fill(0); // Zero out the buffer
      }
    });
    
    // Clear the array length
    audioQueue.length = 0;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get audio source configuration from environment variable
   * @returns {Object} Audio source configuration
   */
  getAudioSourceConfig() {
    const audioSourceEnv = process.env.AUDIO_SOURCE || '3'; // Default to both
    const audioSource = parseInt(audioSourceEnv);
    
    const config = {
      mic: false,
      speaker: false,
      both: false
    };
    
    switch (audioSource) {
      case 1:
        config.mic = true;
        break;
      case 2:
        config.speaker = true;
        break;
      case 3:
        config.both = true;
        config.mic = true;
        config.speaker = true;
        break;
      default:
        config.both = true;
        config.mic = true;
        config.speaker = true;
    }
    
    logger.info(`Audio source configuration: mic=${config.mic}, speaker=${config.speaker}, both=${config.both}`);
    return config;
  }

  /**
   * Check if audio type should be processed based on AUDIO_SOURCE setting
   * @param {string} audioType - 'mic' or 'speaker'
   * @returns {boolean} Whether to process this audio type
   */
  shouldProcessAudioType(audioType) {
    const shouldProcess = (audioType === 'mic' && this.audioSource.mic) || 
                         (audioType === 'speaker' && this.audioSource.speaker);
    
    return shouldProcess;
  }

  /**
   * Start real-time transcription for a call
   * @param {string} callId - Call identifier
   * @param {Function} onTranscript - Callback for transcript updates
   * @param {Function} onError - Callback for errors
   * @param {string} audioType - Audio type (mic or speaker)
   */
  async startTranscription(callId, onTranscript, onError, audioType = 'mic') {
    // Prevent multiple start attempts for the same call
    if (this.connections.has(callId)) {
      const existingConnection = this.connections.get(callId);
      if (existingConnection.isConnected || existingConnection.connectionStartTime) {
        logger.warn(`Real-time transcription already started for call ${callId}`);
        return;
      }
    }

    try {
      logger.info(`Starting real-time transcription for call ${callId}`);
      
      // Create WebSocket connection to OpenAI Real-time API with better options
      const ws = new WebSocket(this.config.baseUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        },
        handshakeTimeout: 30000, // 30 second timeout
        perMessageDeflate: false, // Disable compression for better performance
        maxPayload: 16 * 1024 * 1024 // 16MB max payload
      });

      // Store connection and callbacks
      this.connections.set(callId, {
        ws,
        onTranscript,
        onError,
        isConnected: false,
        sessionId: null,
        isConfigured: false,
        connectionStartTime: Date.now(),
        reconnectAttempts: 0,
        maxReconnectAttempts: 3
      });

      // No need to initialize audio buffer since we're not accumulating chunks

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers(callId, ws, onTranscript, onError);
      
    } catch (error) {
      console.error(`❌ Failed to start real-time transcription for call ${callId}:`, error.message);
      if (onError) onError(error);
    }
  }

  /**
   * Set up WebSocket event handlers
   * @param {string} callId - Call identifier
   * @param {WebSocket} ws - WebSocket connection
   * @param {Function} onTranscript - Transcript callback
   * @param {Function} onError - Error callback
   */
  setupWebSocketHandlers(callId, ws, onTranscript, onError) {
    const connection = this.connections.get(callId);

    ws.on('open', () => {
      const connectionTime = Date.now() - connection.connectionStartTime;
      console.log(`✅ Real-time transcription WebSocket connected for call ${callId} (${connectionTime}ms)`);
      console.log(`🔗 WebSocket readyState: ${ws.readyState} (1=OPEN)`);
      connection.isConnected = true;
      connection.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      
      // Send session configuration immediately after connection
      setTimeout(() => {
        this.sendSessionConfig(callId);
      }, 100);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`📨 Received WebSocket message for call ${callId}, type: ${message.type}:`, data.toString().substring(0, 200) + '...');
        this.handleMessage(callId, message, onTranscript, onError);
      } catch (error) {
        console.error(`❌ Error parsing message for call ${callId}:`, error.message);
        console.error(`❌ Raw message data:`, data.toString().substring(0, 200));
        // Don't call onError for parsing errors to avoid spam
      }
    });

    ws.on('error', (error) => {
      // Only log significant errors, not connection resets
      if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
        console.error(`❌ WebSocket error for call ${callId}:`, error.message);
      }
      
      // Attempt reconnection for certain errors
      if (this.shouldReconnect(error) && connection.reconnectAttempts < connection.maxReconnectAttempts) {
        this.attemptReconnect(callId, onTranscript, onError);
      } else if (onError) {
        onError(error);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Real-time transcription closed for call ${callId}. Code: ${code}, Reason: ${reason}`);
      connection.isConnected = false;
      
      // Attempt reconnection for unexpected closures
      if (this.shouldReconnect({ code }) && connection.reconnectAttempts < connection.maxReconnectAttempts) {
        this.attemptReconnect(callId, onTranscript, onError);
      } else {
        this.cleanup(callId);
      }
    });

    // Add ping/pong handling for connection health
    ws.on('ping', () => {
      ws.pong();
    });
  }

  /**
   * Send session configuration to OpenAI
   * @param {string} callId - Call identifier
   */
  sendSessionConfig(callId) {
    const connection = this.connections.get(callId);
    if (!connection || !connection.isConnected) {
      console.log(`Cannot send config for call ${callId} - not connected`);
      return;
    }

    const config = {
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        instructions: 'You are a real-time speech transcription service. Transcribe the audio accurately and provide timestamps.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        tools: [],
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    };

    console.log(`📤 Sending session config for call ${callId}`);
    console.log(`📤 WebSocket readyState before sending config: ${connection.ws.readyState}`);
    connection.ws.send(JSON.stringify(config));
    console.log(`📤 Session config sent successfully for call ${callId}`);
  }

  /**
   * Handle incoming messages from OpenAI
   * @param {string} callId - Call identifier
   * @param {Object} message - Message from OpenAI
   * @param {Function} onTranscript - Transcript callback
   * @param {Function} onError - Error callback
   */
  handleMessage(callId, message, onTranscript, onError) {
    console.log(`🔍 handleMessage called for call ${callId} with type: ${message.type}`);
    const connection = this.connections.get(callId);
    if (!connection) {
      console.log(`❌ No connection found for call ${callId}`);
      return;
    }

    switch (message.type) {
      case 'session.created':
        connection.sessionId = message.session.id;
        console.log(`✅ Session created for call ${callId}`);
        break;

      case 'session.updated':
        console.log(`✅ Session configured for call ${callId}`);
        connection.isConfigured = true;
        break;

      case 'input_audio_buffer.committed':
        console.log(`✅ Audio buffer committed for call ${callId}`);
        // No need to clear buffer since we're not accumulating chunks
        break;

      case 'conversation.item.created':
        console.log(`📄 Conversation item created for call ${callId}`);
        break;

      case 'conversation.item.input_audio_buffer.speech_started':
        // Reduced logging - only log once per session
        if (!connection.speechStarted) {
          console.log(`🎤 Speech detection started for call ${callId}`);
          connection.speechStarted = true;
        }
        break;

      case 'conversation.item.input_audio_buffer.speech_stopped':
        // Reduced logging
        break;

      case 'conversation.item.input_audio_transcription.delta':
        // Handle partial transcription from input audio
        if (message.delta && message.delta !== '') {
          const transcriptData = {
            speaker: callId.includes('_mic') ? 'You' : 'Speaker',
            text: message.delta,
            confidence: 0.9,
            timestamp: new Date().toISOString(),
            language: 'en',
            duration: 0,
            isPartial: true,
            audioType: callId.includes('_mic') ? 'mic' : 'speaker'
          };
          
          console.log(`📝 Input transcription delta [${transcriptData.audioType}]: ${message.delta}`);
          if (onTranscript) onTranscript(transcriptData);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Handle final transcription from input audio
        if (message.transcript && message.transcript !== '') {
          const audioType = callId.includes('_mic') ? 'mic' : 'speaker';
          const speaker = audioType === 'mic' ? 'You' : 'Speaker';
          
          const transcriptData = {
            speaker: speaker,
            text: message.transcript,
            confidence: 0.9,
            timestamp: new Date().toISOString(),
            language: 'en',
            duration: 0,
            isPartial: false,
            audioType: audioType
          };
          
          console.log(`✅ Input transcription completed [${audioType}]: ${message.transcript}`);
          if (onTranscript) onTranscript(transcriptData);
        } else {
          console.log(`⚠️ Empty transcription result for call ${callId}`);
        }
        break;

      case 'conversation.item.transcript.delta':
        // Handle partial transcript
        if (message.delta && message.delta.transcript) {
          const transcriptData = {
            speaker: 'agent', // Will be determined by audio source
            text: message.delta.transcript,
            confidence: 0.9, // Real-time API doesn't provide confidence
            timestamp: new Date().toISOString(),
            language: 'en',
            duration: 0,
            isPartial: true
          };
          
          // Only log significant partial transcripts (not every character)
          if (message.delta.transcript.length > 10) {
            console.log(`📝 Partial: ${message.delta.transcript.substring(0, 50)}...`);
          }
          if (onTranscript) onTranscript(transcriptData);
        }
        break;

      case 'conversation.item.transcript.completed':
        // Handle final transcript
        if (message.transcript) {
          // Extract audioType from callId (format: originalCallId_audioType)
          const audioType = callId.includes('_') ? callId.split('_').pop() : 'mic';
          const originalCallId = callId.includes('_') ? callId.split('_')[0] : callId;
          
          // Determine speaker based on audio type
          const speaker = audioType === 'mic' ? 'You' : 'Speaker';
          
          const transcriptData = {
            speaker: speaker,
            text: message.transcript,
            confidence: 0.9,
            timestamp: new Date().toISOString(),
            language: 'en',
            duration: 0,
            isPartial: false,
            audioType: audioType
          };
          
          console.log(`✅ Final transcript [${audioType}]: ${message.transcript}`);
          
          // Send transcript to C++ client via speechToTextService
          if (onTranscript) {
            onTranscript(transcriptData);
          }
        }
        break;

      case 'error':
        console.error(`❌ OpenAI Real-time API error for call ${callId}:`, message.error?.message || 'Unknown error');
        console.error(`❌ Error details:`, JSON.stringify(message.error, null, 2));
        if (onError) onError(new Error(message.error?.message || 'Unknown error'));
        break;

      default:
        // Only log unknown message types once per session
        if (!connection.unknownMessageLogged) {
          console.log(`ℹ️ Unhandled message type: ${message.type}`);
          connection.unknownMessageLogged = true;
        }
    }
  }

  /**
   * Process audio data for real-time transcription
   * @param {string} callId - Call identifier
   * @param {Object} audioData - Audio data object
   */
  async processAudioData(callId, audioData) {
    const { audioType, audioData: encodedAudio, timestamp } = audioData;
    
    // Check if this audio type should be processed based on AUDIO_SOURCE setting
    if (!this.shouldProcessAudioType(audioType)) {
      console.log(`⏭️ Skipping ${audioType} audio processing due to AUDIO_SOURCE configuration`);
      return; // Skip processing for this audio type
    }
    
    // Create separate connection key for mic vs speaker
    const connectionKey = `${callId}_${audioType}`;
    
    // Get or create connection for this audio type
    let audioConnection = this.connections.get(connectionKey);
    if (!audioConnection) {
      // Create new connection for this audio type
      await this.startTranscription(connectionKey, null, null, audioType);
      audioConnection = this.connections.get(connectionKey);
    }
    
    // Initialize audio buffer for this call if not exists
    if (!this.audioBuffers.has(callId)) {
      this.audioBuffers.set(callId, { mic: [], speaker: [] });
    }
    
    const audioBufferQueue = this.audioBuffers.get(callId);
    
    if (!audioConnection || !audioConnection.isConnected || !audioConnection.isConfigured) {
      // Only log once per session to avoid spam
      if (!audioConnection || !audioConnection.audioProcessingLogged) {
        console.log(`⚠️ Real-time transcription not ready for call ${connectionKey}`);
        if (audioConnection) {
          audioConnection.audioProcessingLogged = true;
        }
      }
      return;
    }
    
    try {
      // Decode base64 audio data
      const audioBuffer = Buffer.from(encodedAudio, 'base64');
      
      // Convert to PCM16 format if needed
      const pcm16Buffer = await this.convertToPCM16(audioBuffer, audioData);
      
      if (pcm16Buffer.length === 0) {
        console.log(`⚠️ Skipping empty audio buffer for call ${connectionKey}`);
        return; // Silent return for empty buffers
      }
      
      // Additional validation - check if buffer has meaningful audio data
      const hasAudioData = pcm16Buffer.some(byte => byte !== 0);
      if (!hasAudioData) {
        console.log(`⚠️ Skipping silent audio buffer for call ${connectionKey}`);
        return;
      }

      // Add audio buffer to queue
      audioBufferQueue[audioType].push(pcm16Buffer);
      
      // Calculate current queue duration
      const samplesPerSecond = 24000;
      const bytesPerSample = 2; // 16-bit = 2 bytes
      const totalBytes = audioBufferQueue[audioType].reduce((sum, buffer) => sum + buffer.length, 0);
      const currentDurationMs = (totalBytes / bytesPerSample / samplesPerSecond) * 1000;
      
      // Check if queue size exceeds the maximum limit
      if (currentDurationMs >= this.maxQueueSizeMs) {
        console.log(`📦 Queue size exceeded: ${currentDurationMs}ms >= ${this.maxQueueSizeMs}ms - clearing queue`);
        // Clear the queue when it exceeds the limit - properly clear heap
        this.clearAudioQueue(audioBufferQueue[audioType]);
        audioBufferQueue[audioType].length = 0;
      }
      // Audio chunk sent successfully

    } catch (error) {
      console.error(`❌ Error processing audio for call ${callId}:`, error.message);
      const connection = this.connections.get(connectionKey);
      if (connection && connection.onError) {
        connection.onError(error);
      }
    }
  }

  /**
   * Convert audio buffer to PCM16 format
   * @param {Buffer} audioBuffer - Input audio buffer
   * @param {Object} audioInfo - Audio format information
   * @returns {Buffer} PCM16 audio buffer
   */
  async convertToPCM16(audioBuffer, audioInfo) {
    try {
      // Check if this looks like Opus audio (small chunks, no explicit encoding)
      const isLikelyOpus = !audioInfo?.encoding || 
                          audioInfo.encoding === 'opus' || 
                          (audioBuffer.length < 100 && audioInfo?.sampleRate === 24000);
      
      // For Opus-encoded audio, we need to decode it first
      if (isLikelyOpus) {
        
        // Use opus-decoder package to decode Opus audio
      const { OpusDecoder } = await import('opus-decoder');
      
      const decoder = new OpusDecoder({
          sampleRate: 24000,  // Opus encoded at 24kHz
          channels: 1,        // Mono for STT
        forceStereo: false
      });
      
      await decoder.ready;

        // Decode the Opus data
        const decodedData = decoder.decodeFrame(audioBuffer);
        
        if (decodedData && decodedData.channelData.length > 0) {
          // Convert Float32Array to Int16Array for PCM16
          const floatData = decodedData.channelData[0];
          const int16Data = new Int16Array(floatData.length);
          
          for (let i = 0; i < floatData.length; i++) {
            // Clamp to [-1, 1] and convert to 16-bit integer
            const sample = Math.max(-1, Math.min(1, floatData[i]));
            int16Data[i] = Math.round(sample * 32767);
          }
          
          // Audio is already at 24kHz, no resampling needed
          const resampledData = int16Data;
          
          // Clean up decoder
          if (decoder.reset) {
            decoder.reset();
          }
          
          return Buffer.from(resampledData.buffer);
        }
        
        // Clean up decoder
        if (decoder.reset) {
          decoder.reset();
        }
        
        return Buffer.alloc(0);
      } else {
        // Assume the audio is already in PCM16 format
        return audioBuffer;
      }
    } catch (error) {
      console.error('Error converting audio to PCM16:', error);
      return Buffer.alloc(0);
    }
  }


  /**
   * Stop real-time transcription for a call
   * @param {string} callId - Call identifier
   */
  stopTranscription(callId) {
    console.log(`🛑 Stopping real-time transcription for call ${callId}`);
    const connection = this.connections.get(callId);
    if (connection && connection.ws) {
      connection.ws.close();
    }
    this.cleanup(callId);
  }

  /**
   * Clean up resources for a call
   * @param {string} callId - Call identifier
   */
  cleanup(callId) {
    console.log(`🧹 Cleaning up real-time transcription for call ${callId}`);
    
    const connection = this.connections.get(callId);
    if (connection) {
      // Clear all timeouts
      if (connection.timeouts) {
        connection.timeouts.forEach(timeout => clearTimeout(timeout));
        connection.timeouts.clear();
      }
      
      // Close WebSocket if still open
      if (connection.ws && connection.ws.readyState === 1) { // WebSocket.OPEN
        connection.ws.close();
      }
    }
    
    // Clear audio buffers for this call - properly clear heap
    const audioBufferQueue = this.audioBuffers.get(callId);
    if (audioBufferQueue) {
      // Clear both mic and speaker queues
      this.clearAudioQueue(audioBufferQueue.mic);
      this.clearAudioQueue(audioBufferQueue.speaker);
    }
    this.audioBuffers.delete(callId);
    
    this.connections.delete(callId);
  }

  /**
   * Check if real-time transcription is active for a call
   * @param {string} callId - Call identifier
   * @returns {boolean} Whether transcription is active
   */
  isActive(callId) {
    const connection = this.connections.get(callId);
    return connection && connection.isConnected && connection.isConfigured;
  }

  /**
   * Get connection status for a call
   * @param {string} callId - Call identifier
   * @returns {Object} Connection status
   */
  getStatus(callId) {
    const connection = this.connections.get(callId);
    return {
      isConnected: connection ? connection.isConnected : false,
      isConfigured: connection ? connection.isConfigured : false,
      sessionId: connection ? connection.sessionId : null,
      hasConnection: !!connection,
      reconnectAttempts: connection ? connection.reconnectAttempts : 0
    };
  }

  /**
   * Check if we should attempt reconnection for an error
   * @param {Error} error - The error object
   * @returns {boolean} Whether to attempt reconnection
   */
  shouldReconnect(error) {
    const reconnectableErrors = [
      'ECONNRESET',
      'EPIPE', 
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED'
    ];
    
    const reconnectableCodes = [1006, 1011, 1012]; // WebSocket close codes
    
    return reconnectableErrors.includes(error.code) || 
           reconnectableCodes.includes(error.code);
  }

  /**
   * Attempt to reconnect a WebSocket connection
   * @param {string} callId - Call identifier
   * @param {Function} onTranscript - Transcript callback
   * @param {Function} onError - Error callback
   */
  async attemptReconnect(callId, onTranscript, onError) {
    const connection = this.connections.get(callId);
    if (!connection) return;

    connection.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, connection.reconnectAttempts), 10000); // Exponential backoff, max 10s
    
    console.log(`🔄 Attempting reconnection ${connection.reconnectAttempts}/${connection.maxReconnectAttempts} for call ${callId} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        // Close existing connection if still open
        if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close();
        }
        
        // Start new connection
        await this.startTranscription(callId, onTranscript, onError);
      } catch (error) {
        console.error(`❌ Reconnection failed for call ${callId}:`, error.message);
        if (connection.reconnectAttempts >= connection.maxReconnectAttempts) {
          if (onError) onError(error);
        }
      }
    }, delay);
  }

  /**
   * Test WebSocket connection to OpenAI Real-time API
   * @returns {Promise<boolean>} Whether connection test was successful
   */
  async testConnection() {
    return new Promise((resolve) => {
      console.log('🧪 Testing WebSocket connection to OpenAI Real-time API...');
      
      const testWs = new WebSocket(this.config.baseUrl, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        },
        handshakeTimeout: 10000
      });

      const timeout = setTimeout(() => {
        console.log('⏰ Connection test timeout');
        testWs.close();
        resolve(false);
      }, 10000);

      testWs.on('open', () => {
        console.log('✅ Connection test successful');
        clearTimeout(timeout);
        testWs.close();
        resolve(true);
      });

      testWs.on('error', (error) => {
        console.error('❌ Connection test failed:', error.message);
        clearTimeout(timeout);
        resolve(false);
      });

      testWs.on('close', (code, reason) => {
        console.log(`🔌 Test connection closed. Code: ${code}, Reason: ${reason}`);
        clearTimeout(timeout);
      });
    });
  }
}

// Export singleton instance
export const realtimeTranscriptionService = new RealtimeTranscriptionService();