import 'dotenv/config';
import RealtimeTranscriptionService from './src/services/realtimeTranscriptionService.js';
import { logger } from './src/utils/logger.js';

// Test the transcription service
async function testTranscription() {
    console.log('Testing Realtime Transcription Service...');
    
    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not found in environment variables');
        return;
    }

    const transcriptionService = new RealtimeTranscriptionService();
    const testCallId = 'test-call-' + Date.now();
    
    try {
        // Start transcription
        console.log(`Starting transcription for test call: ${testCallId}`);
        transcriptionService.startTranscription(testCallId);
        
        // Wait a bit for connection to establish
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Simulate some Opus audio data (this would normally come from C++ client)
        const opusData = Buffer.alloc(100, 0); // Simulated Opus packet
        console.log('Sending test Opus audio data...');
        await transcriptionService.sendAudioData(testCallId, opusData, 24000, 1);
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Commit the audio buffer
        transcriptionService.commitAudioBuffer(testCallId);
        
        // Wait a bit more
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Stop transcription
        console.log('Stopping transcription...');
        transcriptionService.stopTranscription(testCallId);
        
        console.log('Test completed successfully!');
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Cleanup
        transcriptionService.cleanup();
    }
}

// Run the test
testTranscription().then(() => {
    console.log('Test finished');
    process.exit(0);
}).catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});
