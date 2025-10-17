// Simplified WebRTC implementation without wrtc package
// This will handle signaling and prepare for WebRTC implementation

import { WebSocketServer } from 'ws';
import { logger } from '../utils/logger.js';
import RealtimeTranscriptionService from '../services/realtimeTranscriptionService.js';

class WebRTCServer {
    constructor(io) {
        this.io = io;
        this.peerConnections = new Map(); // callId -> RTCPeerConnection
        this.audioStreams = new Map(); // callId -> MediaStream
        this.rawWebSocketConnections = new Map(); // socketId -> raw WebSocket connection
        this.transcriptionService = new RealtimeTranscriptionService();
        
        // Override the emitTranscriptionUpdate method to emit to Socket.IO clients
        this.transcriptionService.emitTranscriptionUpdate = (callId, transcriptionData) => {
            this.emitTranscriptionUpdate(callId, transcriptionData);
        };
        
        this.setupSocketHandlers();
        this.setupRawWebSocketHandler();
    }

    setupRawWebSocketHandler() {
        // Create a separate WebSocket server for raw connections (C++ client)
        this.wss = new WebSocketServer({ 
            port: 3003, // Different port for raw WebSocket connections
            path: '/webrtc'
        });

        this.wss.on('connection', (ws, req) => {
            logger.info('Raw WebSocket Client connected:', req.socket.remoteAddress);
            
            // Store the connection
            const connectionId = Date.now().toString();
            this.rawWebSocketConnections.set(connectionId, ws);
            
            // Store call ID for this connection
            let callId = null;

            ws.on('message', async (data) => {
                try {
                    // Handle both text and binary messages
                    let message;
                    if (typeof data === 'string') {
                        message = data;
                    } else {
                        // Convert Buffer to string, handling potential encoding issues
                        try {
                            message = data.toString('utf8');
                        } catch (encodingError) {
                            message = data.toString('latin1');
                        }
                    }
                    
                    // Handle Socket.IO format messages from C++ client
                    if (message.startsWith('42')) {
                        // Parse Socket.IO event message: "42["event",data]"
                        const eventMatch = message.match(/42\["([^"]+)",(.+)\]/);
                        if (eventMatch) {
                            const eventName = eventMatch[1];
                            let eventData;
                            try {
                                eventData = JSON.parse(eventMatch[2]);
                            } catch (error) {
                                // Try to fix common JSON issues with base64 data
                                let fixedJson = eventMatch[2];
                                // Remove any control characters that might be in base64
                                fixedJson = fixedJson.replace(/[\x00-\x1F\x7F]/g, '');
                                try {
                                    eventData = JSON.parse(fixedJson);
                                } catch (error2) {
                                    return;
                                }
                            }
                            
                            if (eventName === 'join_call') {
                                // Handle join call
                                logger.info('C++ client joined call:', eventData.callId);
                                callId = eventData.callId;
                                
                                // Send confirmation
                                const response = '42["call_joined",{"callId":"' + eventData.callId + '","status":"success"}]';
                                ws.send(response);
                                
                                
                            } else if (eventName === 'webrtc_offer') {
                                // Handle WebRTC offer
                                logger.info('Received WebRTC offer from C++ client:', eventData.callId);
                                
                                // Generate a simplified WebRTC SDP answer without DTLS
                                const sessionId = Math.floor(Math.random() * 1000000000);
                                const sessionVersion = Math.floor(Math.random() * 1000000000);
                                
                                const answer = {
                                    type: 'answer',
                                    sdp: `v=0\r
o=- ${sessionId} ${sessionVersion} IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0\r
a=msid-semantic: WMS\r
m=audio 9 RTP/AVP 111\r
c=IN IP4 0.0.0.0\r
a=mid:0\r
a=recvonly\r
        a=rtpmap:111 opus/24000/2\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:${this.generateIceUfrag()}\r
a=ice-pwd:${this.generateIcePwd()}`
                                };
                                
                                const response = '42["webrtc_answer",{"callId":"' + eventData.callId + '","answer":' + JSON.stringify(answer) + '}]';
                                ws.send(response);
                                
                                // Also broadcast to frontend via Socket.IO for WebRTC players
                                this.io.emit('webrtc_answer', {
                                    callId: eventData.callId,
                                    answer: answer
                                });
                                
                            } else if (eventName === 'audio_stream') {
                                const { callId, audioType, audioData, sampleRate, channels } = eventData;
                                
                                // Start appropriate transcription session if not already active
                                if (audioType === 'mic' && !this.transcriptionService.isMicTranscriptionActive(callId)) {
                                    this.transcriptionService.startMicTranscription(callId);
                                    logger.info(`Started mic transcription for call ${callId}`);
                                } else if (audioType === 'speaker' && !this.transcriptionService.isSpeakerTranscriptionActive(callId)) {
                                    this.transcriptionService.startSpeakerTranscription(callId);
                                    logger.info(`Started speaker transcription for call ${callId}`);
                                }

                                // Send audio data for transcription based on audio type
                                if (audioData) {
                                    try {
                                        // Send Opus-encoded audio data to appropriate transcription service
                                        this.transcriptionService.sendAudioData(
                                            callId, 
                                            audioData, 
                                            sampleRate || 24000, 
                                            channels || 1,
                                            audioType
                                        );
                                    } catch (transcriptionError) {
                                        logger.error(`Error sending ${audioType} audio for transcription:`, transcriptionError);
                                    }
                                } else {
                                    logger.warn(`[WEBRTC DEBUG] No audio data received for call ${callId} (${audioType})`);
                                }

                                // Broadcast to frontend via Socket.IO for monitoring
                                this.io.emit('call_audio_' + eventData.callId, {
                                    type: 'audio_stream',
                                    callId: eventData.callId,
                                    audioData: eventData.audioData,
                                    audioType: eventData.audioType,
                                    sampleRate: eventData.sampleRate || 24000,
                                    bitsPerSample: eventData.bitsPerSample,
                                    channels: eventData.channels,
                                    timestamp: eventData.timestamp
                                });
                            }
                        }
                    } else if (message === '40') {
                        // Handle Socket.IO connect message
                        logger.debug('C++ client sent connect message');
                        
                        // Send connect confirmation
                        ws.send('40');
                        
                    } else if (message.startsWith('2')) {
                        // Handle Engine.IO ping
                        logger.debug('C++ client ping received');
                        
                        // Send pong
                        ws.send('3');
                    }
                    
                } catch (error) {
                    logger.error('Error handling raw WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                logger.info('Raw WebSocket Client disconnected:', connectionId);
                // Stop transcription for this call if it was active
                if (callId) {
                    this.transcriptionService.stopTranscription(callId);
                }
                this.rawWebSocketConnections.delete(connectionId);
            });

            ws.on('error', (error) => {
                logger.error('Raw WebSocket error:', error.message);
                if (error.code === 'WS_ERR_INVALID_UTF8') {
                    logger.debug('UTF-8 encoding issue detected - this is normal for binary data');
                }
                this.rawWebSocketConnections.delete(connectionId);
            });
        });

        logger.info('Raw WebSocket server started on port 3003');
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.info('WebRTC Client connected:', socket.id);

            // Handle WebRTC offer from C++ client
            socket.on('webrtc_offer', async (data) => {
                logger.info('Received WebRTC offer from C++ client:', data.callId);
                await this.handleOffer(socket, data);
            });

            // Handle WebRTC answer from frontend
            socket.on('webrtc_answer', async (data) => {
                logger.info('Received WebRTC answer from frontend:', data.callId);
                await this.handleAnswer(socket, data);
            });

            // Handle ICE candidates
            socket.on('ice_candidate', (data) => {
                logger.debug('Received ICE candidate:', data.callId);
                this.handleIceCandidate(socket, data);
            });

            // Handle audio stream from C++ client
            socket.on('audio_stream', (data) => {
                logger.info('Received audio stream from C++ client:', data.callId);
                this.handleAudioStream(socket, data);
            });

            // Handle call monitoring request
            socket.on('request_call_monitoring', (data) => {
                logger.info('Call monitoring requested:', data.callId);
                this.handleCallMonitoringRequest(socket, data);
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                logger.info('WebRTC Client disconnected:', socket.id);
                this.cleanupPeerConnection(socket);
            });
        });
    }

    async handleOffer(socket, data) {
        try {
            const { callId, offer } = data;
            
            logger.info('Received WebRTC offer from C++ client:', callId);
            
            // Simplified WebRTC handling - just acknowledge the offer
            // In a full implementation, this would create RTCPeerConnection
            
            // Store connection info
            this.peerConnections.set(callId, { 
                callId, 
                offer,
                state: 'connecting'
            });

            // Generate a simplified WebRTC SDP answer without DTLS
            const sessionId = Math.floor(Math.random() * 1000000000);
            const sessionVersion = Math.floor(Math.random() * 1000000000);
            
            const simplifiedAnswer = {
                type: 'answer',
                sdp: `v=0\r
o=- ${sessionId} ${sessionVersion} IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0\r
a=msid-semantic: WMS\r
m=audio 9 RTP/AVP 111\r
c=IN IP4 0.0.0.0\r
a=mid:0\r
a=recvonly\r
        a=rtpmap:111 opus/24000/2\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:${this.generateIceUfrag()}\r
a=ice-pwd:${this.generateIcePwd()}`
            };

            logger.info('Sending simplified WebRTC answer to C++ client:', callId);
            socket.emit('webrtc_answer', {
                callId,
                answer: simplifiedAnswer
            });

            // Broadcast to frontend that WebRTC is ready
            socket.emit('webrtc_ready', {
                callId,
                answer: simplifiedAnswer
            });

        } catch (error) {
            logger.error('Error handling WebRTC offer:', error);
            socket.emit('webrtc_error', {
                callId: data.callId,
                error: error.message
            });
        }
    }

    async handleAnswer(socket, data) {
        try {
            const { callId, answer } = data;
            const peerConnection = this.peerConnections.get(callId);
            
            if (peerConnection) {
                logger.info('Simplified WebRTC connection established:', callId);
                peerConnection.state = 'connected';
            }
        } catch (error) {
            logger.error('Error handling WebRTC answer:', error);
        }
    }

    handleIceCandidate(socket, data) {
        try {
            const { callId, candidate } = data;
            logger.debug('Simplified ICE candidate received:', callId);
            
            // In a full implementation, this would add the ICE candidate to the peer connection
            // For now, just acknowledge it
            socket.emit('ice_candidate_ack', { callId, candidate });
        } catch (error) {
            logger.error('Error handling ICE candidate:', error);
        }
    }

    handleAudioStream(socket, data) {
        try {
            const { callId, audioData, audioType, sampleRate, bitsPerSample, channels } = data;
            
            // Store audio stream data
            if (!this.audioStreams.has(callId)) {
                this.audioStreams.set(callId, { mic: [], speaker: [] });
            }
            
            const streamData = this.audioStreams.get(callId);
            streamData[audioType].push({
                audioData,
                sampleRate,
                bitsPerSample,
                channels,
                timestamp: Date.now()
            });

            // Start appropriate transcription session if not already active
            if (audioType === 'mic' && !this.transcriptionService.isMicTranscriptionActive(callId)) {
                this.transcriptionService.startMicTranscription(callId);
                logger.info(`Started mic transcription for call ${callId}`);
            } else if (audioType === 'speaker' && !this.transcriptionService.isSpeakerTranscriptionActive(callId)) {
                this.transcriptionService.startSpeakerTranscription(callId);
                logger.info(`Started speaker transcription for call ${callId}`);
            }

            // Send audio data for transcription based on audio type
            if (audioData) {
                try {
                    // Send Opus-encoded audio data to appropriate transcription service
                    this.transcriptionService.sendAudioData(callId, audioData, sampleRate, channels, audioType);
                } catch (transcriptionError) {
                    logger.error(`Error sending ${audioType} audio for transcription:`, transcriptionError);
                }
            }

            // Broadcast to frontend
            socket.emit('call_audio_' + callId, {
                callId,
                audioType,
                audioData,
                sampleRate,
                bitsPerSample,
                channels,
                timestamp: Date.now()
            });

            logger.debug('Audio stream broadcasted:', callId, audioType);
        } catch (error) {
            logger.error('Error handling audio stream:', error);
        }
    }

    handleCallMonitoringRequest(socket, data) {
        try {
            const { callId } = data;
            
            // Check if we have audio data for this call
            const streamData = this.audioStreams.get(callId);
            if (streamData) {
                socket.emit('call_monitoring_ready', {
                    callId,
                    hasMicAudio: streamData.mic.length > 0,
                    hasSpeakerAudio: streamData.speaker.length > 0
                });
            } else {
                socket.emit('call_monitoring_not_available', {
                    callId,
                    reason: 'No audio data available'
                });
            }
        } catch (error) {
            logger.error('Error handling call monitoring request:', error);
        }
    }

    cleanupPeerConnection(socket) {
        // Clean up peer connections for this socket
        for (const [callId, peerConnection] of this.peerConnections.entries()) {
            try {
                logger.debug('Cleaned up simplified peer connection:', callId);
                // Stop transcription for this call
                this.transcriptionService.stopTranscription(callId);
            } catch (error) {
                logger.error('Error cleaning up peer connection:', error);
            }
        }
        this.peerConnections.clear();
    }

    // Emit transcription updates to Socket.IO clients
    emitTranscriptionUpdate(callId, transcriptionData) {
        try {
            // Emit to all clients monitoring this call
            this.io.emit('transcription_update', {
                callId,
                ...transcriptionData
            });
            
            // Also emit to call-specific room
            this.io.to(`call_monitoring_${callId}`).emit('transcription_update', {
                callId,
                ...transcriptionData
            });
            
            // Emit to transcription monitoring room
            this.io.to(`transcription_monitoring_${callId}`).emit('transcription_update', {
                callId,
                ...transcriptionData
            });

            // Broadcast to raw WebSocket clients (C++ app) using Socket.IO framing
            // Event name: "transcript"
            const speaker = transcriptionData.audioType === 'mic' ? 'agent' : 'customer';
            const payload = {
                type: 'transcript',
                callId,
                speaker,
                text: transcriptionData.text || '',
                confidence: typeof transcriptionData.confidence === 'number' ? transcriptionData.confidence : 0.0,
                timestamp: transcriptionData.timestamp || new Date().toISOString(),
                language: 'en',
                duration: typeof transcriptionData.duration === 'number' ? transcriptionData.duration : 0.0,
            };
            const socketIoMsg = '42["transcript",' + JSON.stringify(payload) + ']';
            for (const [, ws] of this.rawWebSocketConnections.entries()) {
                try {
                    // Send as a plain text message; ws library will frame it as a text frame (opcode 0x1)
                    ws.send(socketIoMsg);
                } catch {}
            }
            
            logger.debug(`Transcription update emitted for call ${callId}:`, transcriptionData);
        } catch (error) {
            logger.error(`Error emitting transcription update for call ${callId}:`, error);
        }
    }

    // Method to get WebRTC server instance
    getInstance() {
        return this;
    }



    // Helper method to generate ICE ufrag
    generateIceUfrag() {
        // Use a fixed, known-good ICE ufrag format
        // This follows RFC 5245 exactly and is known to work with WebRTC
        return 'webrtc';
    }

    // Helper method to generate ICE password
    generateIcePwd() {
        // Use a fixed, known-good ICE password format
        // This follows RFC 5245 exactly and is known to work with WebRTC
        return 'webrtcicepassword123456789';
    }
    
    // Create WebSocket frame according to RFC 6455
    createWebSocketFrame(message) {
        const payload = Buffer.from(message, 'utf8');
        const payloadLength = payload.length;
        
        let frame;
        
        if (payloadLength <= 125) {
            frame = Buffer.alloc(2 + payloadLength);
            frame[0] = 0x81; // FIN + text frame
            frame[1] = payloadLength;
            payload.copy(frame, 2);
        } else if (payloadLength <= 65535) {
            frame = Buffer.alloc(4 + payloadLength);
            frame[0] = 0x81; // FIN + text frame
            frame[1] = 126;
            frame[2] = (payloadLength >> 8) & 0xFF;
            frame[3] = payloadLength & 0xFF;
            payload.copy(frame, 4);
        } else {
            frame = Buffer.alloc(10 + payloadLength);
            frame[0] = 0x81; // FIN + text frame
            frame[1] = 127;
            for (let i = 0; i < 8; i++) {
                frame[2 + i] = (payloadLength >> (8 * (7 - i))) & 0xFF;
            }
            payload.copy(frame, 10);
        }
        
        return frame;
    }
    
}

export default WebRTCServer;
