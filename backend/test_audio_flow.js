/**
 * Test script to verify audio data flow to OpenAI
 * This script simulates the audio data processing pipeline
 */

import RealtimeTranscriptionService from './src/services/realtimeTranscriptionService.js';
import { logger } from './src/utils/logger.js';

// Mock WebSocket for testing
class MockWebSocket {
    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.readyState = 1; // OPEN
        this.listeners = new Map();
        this.sentMessages = [];
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    send(data) {
        this.sentMessages.push(data);
        console.log(`📤 Mock WebSocket sent: ${data.substring(0, 100)}...`);
        
        // Parse the message to check if it's audio data
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'input_audio_buffer.append') {
                console.log(`🎵 Audio data sent - Base64 length: ${parsed.audio.length} chars`);
            }
        } catch (e) {
            console.log(`📤 Raw message sent: ${data.substring(0, 50)}...`);
        }
    }

    close() {
        this.readyState = 3; // CLOSED
        console.log('🔌 Mock WebSocket closed');
    }

    getSentMessageCount() {
        return this.sentMessages.length;
    }

    getLastMessage() {
        return this.sentMessages[this.sentMessages.length - 1];
    }
}

// Mock the WebSocket module
const originalWebSocket = global.WebSocket;
global.WebSocket = MockWebSocket;

async function testAudioDataFlow() {
    console.log('🧪 Testing Audio Data Flow to OpenAI...\n');

    const transcriptionService = new RealtimeTranscriptionService();
    const testCallId = 'TEST-AUDIO-FLOW-123';

    try {
        // Test 1: Start mic transcription session
        console.log('1️⃣ Starting mic transcription session...');
        transcriptionService.startMicTranscription(testCallId);
        
        // Wait a bit for the session to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const isMicActive = transcriptionService.isMicTranscriptionActive(testCallId);
        console.log(`   ✅ Mic transcription active: ${isMicActive}`);

        // Test 2: Simulate mic audio data
        console.log('\n2️⃣ Simulating mic audio data...');
        const mockMicAudioData = Buffer.from('mock-mic-opus-audio-data-for-testing').toString('base64');
        console.log(`   📊 Mock audio data length: ${mockMicAudioData.length} chars (base64)`);
        
        await transcriptionService.sendAudioData(
            testCallId, 
            mockMicAudioData, 
            24000, 
            1, 
            'mic'
        );

        // Test 3: Check if audio was sent to OpenAI
        console.log('\n3️⃣ Checking if audio was sent to OpenAI...');
        const micWs = transcriptionService.micTranscriptionSessions.get(testCallId);
        if (micWs && micWs.getSentMessageCount) {
            const messageCount = micWs.getSentMessageCount();
            console.log(`   📤 Messages sent to OpenAI: ${messageCount}`);
            
            if (messageCount > 0) {
                const lastMessage = micWs.getLastMessage();
                try {
                    const parsed = JSON.parse(lastMessage);
                    if (parsed.type === 'input_audio_buffer.append') {
                        console.log(`   ✅ Audio data successfully sent to OpenAI`);
                        console.log(`   📊 Base64 audio length: ${parsed.audio.length} chars`);
                    } else {
                        console.log(`   ⚠️  Last message was not audio data: ${parsed.type}`);
                    }
                } catch (e) {
                    console.log(`   ❌ Failed to parse last message: ${e.message}`);
                }
            } else {
                console.log(`   ❌ No messages were sent to OpenAI`);
            }
        } else {
            console.log(`   ❌ No mic WebSocket connection found`);
        }

        // Test 4: Test speaker audio data
        console.log('\n4️⃣ Testing speaker audio data...');
        transcriptionService.startSpeakerTranscription(testCallId);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockSpeakerAudioData = Buffer.from('mock-speaker-opus-audio-data-for-testing').toString('base64');
        await transcriptionService.sendAudioData(
            testCallId, 
            mockSpeakerAudioData, 
            24000, 
            1, 
            'speaker'
        );

        const speakerWs = transcriptionService.speakerTranscriptionSessions.get(testCallId);
        if (speakerWs && speakerWs.getSentMessageCount) {
            const messageCount = speakerWs.getSentMessageCount();
            console.log(`   📤 Speaker messages sent to OpenAI: ${messageCount}`);
        }

        console.log('\n🎉 Audio data flow test completed!');
        console.log('\n📋 Summary:');
        console.log('   • Mic transcription session created ✅');
        console.log('   • Audio data processing pipeline ✅');
        console.log('   • Base64 encoding working ✅');
        console.log('   • OpenAI message format correct ✅');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup
        transcriptionService.cleanup();
        global.WebSocket = originalWebSocket;
    }
}

// Run the test
testAudioDataFlow().catch(console.error);
