# Speech-to-Text Configuration Guide

This guide explains how to configure the Speech-to-Text (STT) service for your Call Analysis System.

## Environment Variables

Add these variables to your `.env` file:

```bash
# Speech-to-Text Configuration
STT_PROVIDER=whisper
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1

# Alternative STT Providers (uncomment to use)
# GOOGLE_APPLICATION_CREDENTIALS=path/to/google-credentials.json
# AZURE_SPEECH_KEY=your_azure_speech_key
# AZURE_SPEECH_REGION=your_azure_region

# Audio Processing Configuration
AUDIO_BUFFER_DURATION_MS=3000
AUDIO_MIN_LENGTH_MS=1000
AUDIO_SAMPLE_RATE=24000
AUDIO_CHANNELS=1
AUDIO_BITS_PER_SAMPLE=16
```

## STT Provider Options

### 1. OpenAI Whisper (Recommended)
- **Provider**: `whisper`
- **API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Pros**: High accuracy, supports multiple languages, easy setup
- **Cons**: API costs (~$0.006 per minute), requires internet
- **Best for**: Production systems with budget

### 2. Google Cloud Speech-to-Text
- **Provider**: `google`
- **Setup**: Download service account JSON from Google Cloud Console
- **Pros**: Real-time streaming, good accuracy, enterprise features
- **Cons**: Requires Google Cloud setup, costs
- **Best for**: Enterprise deployments

### 3. Azure Speech Services
- **Provider**: `azure`
- **Setup**: Create Speech resource in Azure Portal
- **Pros**: Real-time streaming, good accuracy, Microsoft ecosystem
- **Cons**: Requires Azure setup, costs
- **Best for**: Microsoft-based environments

## Audio Processing Configuration

### Buffer Settings
- `AUDIO_BUFFER_DURATION_MS`: How long to buffer audio before processing (default: 3000ms)
- `AUDIO_MIN_LENGTH_MS`: Minimum audio length to process (default: 1000ms)

### Audio Format
- `AUDIO_SAMPLE_RATE`: Audio sample rate (default: 24000Hz)
- `AUDIO_CHANNELS`: Number of audio channels (default: 1 for mono)
- `AUDIO_BITS_PER_SAMPLE`: Audio bit depth (default: 16)

## API Endpoints

### Real-time Transcript Stream
```
GET /api/calls/transcript/:callId
Authorization: Bearer <token>
```

**Response**: Server-Sent Events stream with transcript data:
```json
{
  "type": "transcript",
  "callId": "123",
  "transcript": {
    "speaker": "agent",
    "text": "Hello, how can I help you today?",
    "confidence": 0.95,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "language": "en",
    "duration": 2.5
  }
}
```

### STT Status
```
GET /api/calls/stt-status/:callId
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "callId": "123",
  "status": {
    "hasBuffer": true,
    "micBufferSize": 3,
    "speakerBufferSize": 2,
    "isProcessing": false,
    "lastProcessed": 1705312200000
  }
}
```

## C++ Client Integration

Your C++ client should:

1. **Send Audio**: Continue sending Opus-encoded audio via existing `/api/calls/stream-audio` endpoint
2. **Receive Transcripts**: Connect to `/api/calls/transcript/:callId` via HTTP/SSE to receive real-time transcripts
3. **Display Transcripts**: Show transcripts in your C++ application UI

### Example C++ Integration

```cpp
// Connect to transcript stream
std::string transcriptUrl = "http://localhost:3001/api/calls/transcript/" + callId;
// Use HTTP client to connect to SSE endpoint
// Parse incoming transcript data and display in UI
```

## Troubleshooting

### Common Issues

1. **No transcripts received**
   - Check if `OPENAI_API_KEY` is set correctly
   - Verify audio is being sent to `/api/calls/stream-audio`
   - Check STT status endpoint for processing errors

2. **High latency**
   - Reduce `AUDIO_BUFFER_DURATION_MS` for faster processing
   - Check network connectivity to STT provider
   - Monitor server CPU/memory usage

3. **Poor accuracy**
   - Ensure audio quality is good (clear, no background noise)
   - Check if audio format matches configuration
   - Consider using different STT provider

### Logs

Check backend logs for STT-related messages:
```bash
# Look for these log messages:
# "Audio data processed for STT for call"
# "Transcript processed for call"
# "STT processing error for call"
```

## Cost Considerations

### OpenAI Whisper Pricing
- **Whisper API**: $0.006 per minute of audio
- **Example**: 100 calls/day × 5 minutes = $3/day

### Optimization Tips
- Buffer audio efficiently to minimize API calls
- Use appropriate audio quality (don't over-sample)
- Implement error handling to avoid unnecessary retries
- Consider local Whisper model for high-volume deployments
