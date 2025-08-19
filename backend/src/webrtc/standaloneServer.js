import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class StandaloneWebRTCServer {
    constructor() {
        this.peerConnections = new Map(); // callId -> RTCPeerConnection
        this.audioStreams = new Map(); // callId -> MediaStream
        this.rawWebSocketConnections = new Map(); // socketId -> raw WebSocket connection
        
        this.setupRawWebSocketHandler();
    }

    setupRawWebSocketHandler() {
        // Create a separate WebSocket server for raw connections (C++ client)
        const webrtcPort = process.env.WEBRTC_PORT || 3001;
        this.wss = new WebSocketServer({ 
            port: webrtcPort,
            path: '/webrtc'
        });

        console.log(`🔧 Standalone WebRTC server started on port ${webrtcPort}`);

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
                                
                            } else if (eventName === 'audio_stream') {
                                // Handle audio stream - reduce logging frequency
                                if (Math.random() < 0.01) { // Log only 1% of audio streams
                                    console.log('🎵 Received audio stream from C++ client:', eventData.callId, 
                                               'type:', eventData.audioType, 'size:', eventData.audioData ? eventData.audioData.length : 0);
                                }
                                
                                // Process audio data (you can add your processing logic here)
                                // For now, just acknowledge receipt
                                const response = '42["audio_received",{"callId":"' + eventData.callId + '","status":"ok"}]';
                                ws.send(response);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('🔗 Raw WebSocket Client disconnected');
                this.rawWebSocketConnections.delete(connectionId);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.rawWebSocketConnections.delete(connectionId);
            });
        });
    }

    // Helper method to generate ICE ufrag
    generateIceUfrag() {
        return 'webrtc';
    }
    
    // Helper method to generate ICE password
    generateIcePwd() {
        return 'webrtcicepassword123456789';
    }

    stop() {
        if (this.wss) {
            this.wss.close();
            console.log('🔧 Standalone WebRTC server stopped');
        }
    }
}

// Start the standalone server
const webrtcServer = new StandaloneWebRTCServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down WebRTC server...');
    webrtcServer.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down WebRTC server...');
    webrtcServer.stop();
    process.exit(0);
});

export default webrtcServer;
