# Real-Time Speech-to-Text Implementation

## Overview
This implementation provides a complete real-time speech-to-text system where:
1. C++ project captures microphone and speaker audio
2. Audio is sent to backend via WebRTC/WebSocket
3. Backend processes audio with OpenAI Whisper API
4. Transcripts are sent back to C++ project in real-time
5. C++ project displays transcripts in the transcriptEdit control

## Implementation Details

### Backend Changes

#### 1. Environment Configuration
- Created `backend/.env` file with OpenAI API key configuration
- Added STT provider configuration (whisper)
- Added proper error handling for missing API keys

#### 2. WebRTC Server Enhancement (`backend/src/webrtc/webrtcServer.js`)
- Enhanced audio stream handling to process audio data with STT service
- Added real-time transcript delivery to C++ client via WebSocket
- Added transcript callback system for live transcript streaming
- Improved error handling and logging

#### 3. Speech-to-Text Service (`backend/src/services/speechToTextService.js`)
- Enhanced WhisperSTTClient with better error handling
- Added API key validation and fallback to mock service
- Improved audio processing and transcript formatting
- Added comprehensive logging for debugging

### C++ Project Changes

#### 1. WebRTC Client (`RecSendScAu/webrtc_client.cpp`)
- Added transcript message handling via WebSocket
- Implemented JSON parsing for transcript data
- Added transcript callback to main window
- Enhanced error handling and logging

#### 2. Main Window (`RecSendScAu/main_window.cpp`)
- Enhanced transcript display with better formatting
- Added speaker identification (Agent/Customer)
- Improved confidence score display
- Added real-time transcript statistics
- Enhanced error handling and logging

#### 3. Transcript Display Format
The transcripts now display in the following format:
```
[HH:MM:SS] Agent (from mic): Hello, I am an agent. (95.2%)
[HH:MM:SS] Customer (from speaker): Nice to meet you. (87.3%)
```

## Setup Instructions

### 1. Backend Setup
1. Add your OpenAI API key to `backend/.env`:
   ```
   OPENAI_API_KEY=your_actual_openai_api_key_here
   ```

2. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

3. Start the backend server:
   ```bash
   npm start
   ```

### 2. C++ Project Setup
1. Build the C++ project using the existing build scripts
2. Ensure the project is configured to connect to the backend server
3. The WebRTC client will automatically connect to `ws://localhost:3001/webrtc`

## Testing the System

### 1. Start the Backend
```bash
cd backend
npm start
```
The server should start on port 3002 and WebSocket server on port 3001.

### 2. Start the C++ Application
1. Run the C++ application
2. Login with valid credentials
3. Click "Start Recording" to begin audio capture and transcription

### 3. Test Audio Capture
1. Speak into the microphone - should appear as "Agent (from mic)" transcripts
2. Play audio through speakers - should appear as "Customer (from speaker)" transcripts
3. Check the transcript display for real-time updates

### 4. Expected Behavior
- Audio is captured from both microphone and speakers
- Audio is sent to backend via WebRTC/WebSocket
- Backend processes audio with OpenAI Whisper API
- Transcripts are sent back to C++ client in real-time
- Transcripts are displayed in the transcriptEdit control with proper formatting

## Troubleshooting

### Common Issues

1. **No transcripts appearing**
   - Check if OpenAI API key is correctly set in `.env`
   - Verify backend server is running and accessible
   - Check WebSocket connection in C++ client logs

2. **Audio not being captured**
   - Verify microphone permissions
   - Check audio capture initialization in C++ client
   - Ensure WebRTC connection is established

3. **Backend errors**
   - Check console logs for STT service errors
   - Verify OpenAI API key is valid and has credits
   - Check network connectivity to OpenAI API

### Debug Logging
- Backend logs are in `backend/logs/`
- C++ client logs are written to files in the application directory
- Enable detailed logging by checking the log files

## File Structure
```
backend/
├── .env                          # Environment configuration
├── src/
│   ├── webrtc/
│   │   └── webrtcServer.js       # Enhanced WebRTC server
│   └── services/
│       └── speechToTextService.js # Enhanced STT service

RecSendScAu/
├── webrtc_client.cpp             # Enhanced WebRTC client
├── webrtc_client.h               # WebRTC client header
├── main_window.cpp               # Enhanced main window
└── main_window.h                 # Main window header
```

## API Endpoints
- WebSocket: `ws://localhost:3001/webrtc` (for C++ client)
- HTTP API: `http://localhost:3002` (for web frontend)
- Audio processing: Automatic via WebSocket events

## Next Steps
1. Test the complete pipeline with real audio
2. Monitor performance and optimize if needed
3. Add additional error handling as required
4. Consider adding transcript export features
5. Implement transcript search functionality
