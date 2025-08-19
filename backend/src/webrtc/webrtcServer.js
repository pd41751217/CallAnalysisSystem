// Simplified WebRTC implementation without wrtc package
// This will handle signaling and prepare for WebRTC implementation

import { WebSocketServer } from 'ws';

class WebRTCServer {
    constructor(io) {
        this.io = io;
        this.peerConnections = new Map(); // callId -> RTCPeerConnection
        this.audioStreams = new Map(); // callId -> MediaStream
        this.rawWebSocketConnections = new Map(); // socketId -> raw WebSocket connection
        
        this.setupSocketHandlers();
        this.setupRawWebSocketHandler();
    }

    setupRawWebSocketHandler() {
        // Create a separate WebSocket server for raw connections (C++ client)
        this.wss = new WebSocketServer({ 
            port: 3001, // Different port for raw WebSocket connections
            path: '/webrtc'
        });

        this.wss.on('connection', (ws, req) => {
            console.log('🔗 Raw WebSocket Client connected:', req.socket.remoteAddress);
            
            // Store the connection
            const connectionId = Date.now().toString();
            this.rawWebSocketConnections.set(connectionId, ws);

            ws.on('message', (data) => {
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
                                console.log('📞 C++ client joined call:', eventData.callId);
                                
                                // Send confirmation
                                const response = '42["call_joined",{"callId":"' + eventData.callId + '","status":"success"}]';
                                ws.send(response);
                                
                            } else if (eventName === 'webrtc_offer') {
                                // Handle WebRTC offer
                                console.log('📡 Received WebRTC offer from C++ client:', eventData.callId);
                                
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
a=rtpmap:111 opus/48000/2\r
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
                                // Handle audio stream - reduce logging frequency
                                if (Math.random() < 0.01) { // Log only 1% of audio streams
                                    console.log('🎵 Received audio stream from C++ client:', eventData.callId, 
                                              'Type:', eventData.audioType, 
                                              'Data length:', eventData.audioData ? eventData.audioData.length : 'undefined');
                                }
                                
                                // Broadcast to frontend via Socket.IO
                                this.io.emit('call_audio_' + eventData.callId, {
                                    type: 'audio_stream',
                                    callId: eventData.callId,
                                    audioData: eventData.audioData,
                                    audioType: eventData.audioType,
                                    sampleRate: eventData.sampleRate,
                                    bitsPerSample: eventData.bitsPerSample,
                                    channels: eventData.channels,
                                    timestamp: eventData.timestamp
                                });
                            }
                        }
                    } else if (message === '40') {
                        // Handle Socket.IO connect message
                        console.log('🔗 C++ client sent connect message');
                        
                        // Send connect confirmation
                        ws.send('40');
                        
                    } else if (message.startsWith('2')) {
                        // Handle Engine.IO ping
                        console.log('🏓 C++ client ping received');
                        
                        // Send pong
                        ws.send('3');
                    }
                    
                } catch (error) {
                    console.error('❌ Error handling raw WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('🔌 Raw WebSocket Client disconnected:', connectionId);
                this.rawWebSocketConnections.delete(connectionId);
            });

            ws.on('error', (error) => {
                console.error('❌ Raw WebSocket error:', error.message);
                if (error.code === 'WS_ERR_INVALID_UTF8') {
                    console.log('⚠️ UTF-8 encoding issue detected - this is normal for binary data');
                }
                this.rawWebSocketConnections.delete(connectionId);
            });
        });

        console.log('🔧 Raw WebSocket server started on port 3001');
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('🔗 WebRTC Client connected:', socket.id);

            // Handle WebRTC offer from C++ client
            socket.on('webrtc_offer', async (data) => {
                console.log('📡 Received WebRTC offer from C++ client:', data.callId);
                await this.handleOffer(socket, data);
            });

            // Handle WebRTC answer from frontend
            socket.on('webrtc_answer', async (data) => {
                console.log('📡 Received WebRTC answer from frontend:', data.callId);
                await this.handleAnswer(socket, data);
            });

            // Handle ICE candidates
            socket.on('ice_candidate', (data) => {
                console.log('🧊 Received ICE candidate:', data.callId);
                this.handleIceCandidate(socket, data);
            });

            // Handle audio stream from C++ client
            socket.on('audio_stream', (data) => {
                console.log('🎵 Received audio stream from C++ client:', data.callId);
                this.handleAudioStream(socket, data);
            });

            // Handle call monitoring request
            socket.on('request_call_monitoring', (data) => {
                console.log('📞 Call monitoring requested:', data.callId);
                this.handleCallMonitoringRequest(socket, data);
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                console.log('🔌 WebRTC Client disconnected:', socket.id);
                this.cleanupPeerConnection(socket);
            });
        });
    }

    async handleOffer(socket, data) {
        try {
            const { callId, offer } = data;
            
            console.log('📡 Received WebRTC offer from C++ client:', callId);
            
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
a=rtpmap:111 opus/48000/2\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:${this.generateIceUfrag()}\r
a=ice-pwd:${this.generateIcePwd()}`
            };

            console.log('📡 Sending simplified WebRTC answer to C++ client:', callId);
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
            console.error('❌ Error handling WebRTC offer:', error);
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
                console.log('✅ Simplified WebRTC connection established:', callId);
                peerConnection.state = 'connected';
            }
        } catch (error) {
            console.error('❌ Error handling WebRTC answer:', error);
        }
    }

    handleIceCandidate(socket, data) {
        try {
            const { callId, candidate } = data;
            console.log('🧊 Simplified ICE candidate received:', callId);
            
            // In a full implementation, this would add the ICE candidate to the peer connection
            // For now, just acknowledge it
            socket.emit('ice_candidate_ack', { callId, candidate });
        } catch (error) {
            console.error('❌ Error handling ICE candidate:', error);
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

            console.log('🎵 Audio stream broadcasted:', callId, audioType);
        } catch (error) {
            console.error('❌ Error handling audio stream:', error);
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
            console.error('❌ Error handling call monitoring request:', error);
        }
    }

    cleanupPeerConnection(socket) {
        // Clean up peer connections for this socket
        for (const [callId, peerConnection] of this.peerConnections.entries()) {
            try {
                console.log('🧹 Cleaned up simplified peer connection:', callId);
            } catch (error) {
                console.error('❌ Error cleaning up peer connection:', error);
            }
        }
        this.peerConnections.clear();
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
}

export default WebRTCServer;
