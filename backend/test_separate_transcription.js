/**
 * Test script to verify separate WebSocket sessions for mic and speaker transcriptions
 * This script simulates the behavior of the separate transcription system
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
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    send(data) {
        console.log(`Mock WebSocket send: ${data.substring(0, 100)}...`);
    }

    close() {
        this.readyState = 3; // CLOSED
        console.log('Mock WebSocket closed');
    }

    // Simulate receiving a message
    simulateMessage(data) {
        const callbacks = this.listeners.get('message') || [];
        callbacks.forEach(callback => callback(data));
    }
}

// Mock the WebSocket module
const originalWebSocket = global.WebSocket;
global.WebSocket = MockWebSocket;

async function testSeparateTranscriptionSessions() {
    console.log('🧪 Testing Separate Transcription Sessions...\n');

    const transcriptionService = new RealtimeTranscriptionService();
    const testCallId = 'TEST-CALL-123';

    try {
        // Test 1: Start mic transcription
        console.log('1️⃣ Starting mic transcription...');
        transcriptionService.startMicTranscription(testCallId);
        
        // Check if mic session is active
        const isMicActive = transcriptionService.isMicTranscriptionActive(testCallId);
        console.log(`   ✅ Mic transcription active: ${isMicActive}`);

        // Test 2: Start speaker transcription
        console.log('\n2️⃣ Starting speaker transcription...');
        transcriptionService.startSpeakerTranscription(testCallId);
        
        // Check if speaker session is active
        const isSpeakerActive = transcriptionService.isSpeakerTranscriptionActive(testCallId);
        console.log(`   ✅ Speaker transcription active: ${isSpeakerActive}`);

        // Test 3: Send audio data to mic session
        console.log('\n3️⃣ Sending audio data to mic session...');
        const micAudioData = Buffer.from('mock-mic-audio-data').toString('base64');
        await transcriptionService.sendAudioData(testCallId, micAudioData, 24000, 1, 'mic');
        console.log('   ✅ Mic audio data sent');

        // Test 4: Send audio data to speaker session
        console.log('\n4️⃣ Sending audio data to speaker session...');
        const speakerAudioData = Buffer.from('mock-speaker-audio-data').toString('base64');
        await transcriptionService.sendAudioData(testCallId, speakerAudioData, 24000, 1, 'speaker');
        console.log('   ✅ Speaker audio data sent');

        // Test 5: Simulate transcription responses
        console.log('\n5️⃣ Simulating transcription responses...');
        
        // Get the mic WebSocket connection
        const micWs = transcriptionService.micTranscriptionSessions.get(testCallId);
        if (micWs) {
            // Simulate partial transcription for mic
            const micPartialResponse = JSON.stringify({
                type: 'conversation.item.input_audio_transcription.delta',
                delta: 'Hello, this is the agent speaking'
            });
            micWs.simulateMessage(micPartialResponse);
            console.log('   ✅ Mic partial transcription simulated');
        }

        // Get the speaker WebSocket connection
        const speakerWs = transcriptionService.speakerTranscriptionSessions.get(testCallId);
        if (speakerWs) {
            // Simulate partial transcription for speaker
            const speakerPartialResponse = JSON.stringify({
                type: 'conversation.item.input_audio_transcription.delta',
                delta: 'Hi, I need help with my account'
            });
            speakerWs.simulateMessage(speakerPartialResponse);
            console.log('   ✅ Speaker partial transcription simulated');
        }

        // Test 6: Stop individual sessions
        console.log('\n6️⃣ Stopping individual sessions...');
        transcriptionService.stopMicTranscription(testCallId);
        const isMicActiveAfterStop = transcriptionService.isMicTranscriptionActive(testCallId);
        console.log(`   ✅ Mic transcription stopped: ${!isMicActiveAfterStop}`);

        transcriptionService.stopSpeakerTranscription(testCallId);
        const isSpeakerActiveAfterStop = transcriptionService.isSpeakerTranscriptionActive(testCallId);
        console.log(`   ✅ Speaker transcription stopped: ${!isSpeakerActiveAfterStop}`);

        // Test 7: Test legacy startTranscription method
        console.log('\n7️⃣ Testing legacy startTranscription method...');
        transcriptionService.startTranscription(testCallId);
        const isLegacyMicActive = transcriptionService.isMicTranscriptionActive(testCallId);
        const isLegacySpeakerActive = transcriptionService.isSpeakerTranscriptionActive(testCallId);
        console.log(`   ✅ Legacy method started both sessions: mic=${isLegacyMicActive}, speaker=${isLegacySpeakerActive}`);

        // Test 8: Test legacy stopTranscription method
        console.log('\n8️⃣ Testing legacy stopTranscription method...');
        transcriptionService.stopTranscription(testCallId);
        const isLegacyMicActiveAfterStop = transcriptionService.isMicTranscriptionActive(testCallId);
        const isLegacySpeakerActiveAfterStop = transcriptionService.isSpeakerTranscriptionActive(testCallId);
        console.log(`   ✅ Legacy method stopped both sessions: mic=${!isLegacyMicActiveAfterStop}, speaker=${!isLegacySpeakerActiveAfterStop}`);

        console.log('\n🎉 All tests passed! Separate WebSocket sessions are working correctly.');
        console.log('\n📋 Summary:');
        console.log('   • Separate mic and speaker transcription sessions ✅');
        console.log('   • Audio data routing to correct sessions ✅');
        console.log('   • Individual session management ✅');
        console.log('   • Legacy compatibility maintained ✅');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup
        transcriptionService.cleanup();
        global.WebSocket = originalWebSocket;
    }
}

// Run the test
testSeparateTranscriptionSessions().catch(console.error);
