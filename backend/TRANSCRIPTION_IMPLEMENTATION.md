# Real-time Transcription Implementation

This document describes the real-time transcription implementation using OpenAI's Realtime API.

## Overview

The system now includes real-time transcription capabilities that automatically transcribe audio streams received from the C++ client. The transcription results are displayed in the backend console.

## Architecture

### Components

1. **RealtimeTranscriptionService** (`src/services/realtimeTranscriptionService.js`)
   - Manages OpenAI Realtime API connections
   - Handles audio data processing and transcription
   - Provides console logging of transcription results

2. **WebRTC Server Integration** (`src/webrtc/webrtcServer.js`)
   - Integrates transcription service with existing audio stream handling
   - Automatically starts transcription when audio streams are received
   - Handles cleanup when connections are closed

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# OpenAI Realtime API Configuration
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01
TRANSCRIPTION_LANGUAGE=en
TRANSCRIPTION_MODEL=gpt-4o-realtime-preview-2024-10-01
TRANSCRIPTION_PROMPT=
VAD_ENABLED=true
VAD_THRESHOLD=0.5
VAD_PREFIX_PADDING_MS=300
VAD_SILENCE_DURATION_MS=500
AUDIO_RATE=48000
```

### Required Dependencies

The following dependencies are already included in `package.json`:
- `ws` - WebSocket client for OpenAI Realtime API
- `openai` - OpenAI SDK (already present)

## How It Works

1. **Audio Stream Reception**: When the C++ client sends audio data via WebSocket, the system receives it in the `webrtcServer.js`

2. **Transcription Initialization**: For each new call, a transcription session is automatically started with OpenAI's Realtime API

3. **Audio Processing**: Mic audio data (Opus-encoded, base64) is decoded to PCM format and sent to OpenAI for transcription

4. **Real-time Results**: Transcription results are logged to the console in real-time:
   - Partial transcriptions (deltas) are shown as they arrive
   - Final transcriptions are displayed when speech segments complete

5. **Cleanup**: When connections are closed, transcription sessions are properly cleaned up

## Console Output

The system will display transcription results in the backend console:

```
[TRANSCRIPTION] Call call-123: Hello, how can I help you today?
[FINAL TRANSCRIPT] Call call-123: Hello, how can I help you today? I'm calling about my account.
```

## Testing

### Manual Testing

1. Start the backend server
2. Connect the C++ client and begin recording
3. Speak into the microphone
4. Check the backend console for transcription output

### Automated Testing

Run the test script to verify the transcription service:

```bash
cd backend
node test_transcription.js
```

## Features

- **Real-time Processing**: Audio is transcribed as it's received
- **Opus Decoding**: Automatically decodes Opus-encoded audio from C++ client to PCM format
- **Voice Activity Detection**: Uses OpenAI's server-side VAD for optimal performance
- **Multi-language Support**: Configurable language settings
- **Automatic Cleanup**: Sessions are properly closed when connections end
- **Error Handling**: Robust error handling and logging

## Limitations

- Currently only processes mic audio (not speaker audio)
- Requires valid OpenAI API key
- Transcription quality depends on audio quality and language settings

## Future Enhancements

- Support for speaker audio transcription
- Transcription storage in database
- Real-time transcription display in frontend
- Multiple language detection
- Custom vocabulary support
