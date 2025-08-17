# RecSendScAu C++ Project Integration Guide

This guide provides the API endpoints and integration details for your C++ RecSendScAu project to work with the Call Analysis System.

## Base URL
```
http://localhost:3001/api
```

## Authentication

All API calls require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### 1. User Authentication

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "agent"
  }
}
```

### 2. Call Recording Management

#### Start Recording
```
POST /calls/start-recording
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerNumber": "+1234567890",
  "notes": "Optional call notes"
}
```

**Response:**
```json
{
  "success": true,
  "callId": 123,
  "message": "Recording started successfully"
}
```

#### Stop Recording
```
POST /calls/stop-recording
Authorization: Bearer <token>
Content-Type: application/json

{
  "callId": 123,
  "duration": 300
}
```

**Response:**
```json
{
  "success": true,
  "message": "Recording stopped successfully"
}
```

#### Stream Audio Data
```
POST /calls/stream-audio
Authorization: Bearer <token>
Content-Type: application/json

{
  "callId": 123,
  "audioData": "base64_encoded_audio_data",
  "timestamp": "2025-08-14T22:30:00.000Z",
  "audioType": "speaker" // or "mic"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Audio data received"
}
```

#### Get Active Call
```
GET /calls/active/{userId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "call": {
    "id": 123,
    "user_id": 1,
    "customer_number": "+1234567890",
    "start_time": "2025-08-14T22:30:00.000Z"
  }
}
```

### 3. User Information

#### Get User Profile
```
GET /users/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com",
    "role": "agent",
    "team": "Sales Team"
  }
}
```

## C++ Implementation Guide

### 1. HTTP Client Setup

Use a library like `libcurl` or `cpp-httplib` for HTTP requests:

```cpp
#include <curl/curl.h>
#include <string>
#include <json/json.h>

class CallAnalysisAPI {
private:
    std::string baseUrl;
    std::string authToken;
    
public:
    CallAnalysisAPI(const std::string& url) : baseUrl(url) {}
    
    void setAuthToken(const std::string& token) {
        authToken = token;
    }
    
    // Login method
    bool login(const std::string& email, const std::string& password) {
        // Implementation here
    }
    
    // Start recording method
    int startRecording(const std::string& customerNumber, const std::string& notes = "") {
        // Implementation here
    }
    
    // Stop recording method
    bool stopRecording(int callId, int duration) {
        // Implementation here
    }
    
    // Stream audio method
    bool streamAudio(int callId, const std::string& audioData, 
                    const std::string& timestamp, const std::string& audioType) {
        // Implementation here
    }
};
```

### 2. Audio Streaming Implementation

For real-time audio streaming, you can:

1. **Capture audio** using Windows APIs (WASAPI) or libraries like PortAudio
2. **Encode audio** to base64 or send raw PCM data
3. **Send in chunks** every few seconds to maintain real-time streaming

```cpp
// Example audio capture and streaming
void streamAudioToServer(int callId) {
    // Initialize audio capture
    // Capture audio in chunks
    // Encode to base64
    // Send via HTTP POST to /calls/stream-audio
    // Repeat every 1-2 seconds
}
```

### 3. Tray Menu Integration

For the system tray menu showing user info:

```cpp
// After successful login, store user info
struct UserInfo {
    std::string name;
    std::string email;
    std::string role;
};

// Update tray menu with user info
void updateTrayMenu(const UserInfo& user) {
    // Update menu items to show user name and email
    // Add "Start Recording" and "Stop Recording" options
}
```

### 4. Recording State Management

```cpp
class RecordingManager {
private:
    int currentCallId;
    bool isRecording;
    std::thread audioStreamThread;
    
public:
    void startRecording(const std::string& customerNumber) {
        // Call API to start recording
        // Start audio streaming thread
        // Update UI state
    }
    
    void stopRecording() {
        // Stop audio streaming
        // Call API to stop recording
        // Update UI state
    }
};
```

## Error Handling

Handle these common error scenarios:

1. **Network errors** - Retry with exponential backoff
2. **Authentication errors** - Re-login user
3. **Server errors** - Show appropriate error messages
4. **Audio capture errors** - Fallback to different audio devices

## Security Considerations

1. **Store tokens securely** - Use Windows Credential Manager or encrypted storage
2. **Validate server certificates** - Prevent man-in-the-middle attacks
3. **Sanitize user input** - Prevent injection attacks
4. **Handle sensitive data** - Don't log audio data or tokens

## Testing

Test your integration with these scenarios:

1. **Login/logout** - Verify authentication works
2. **Start/stop recording** - Verify call lifecycle
3. **Audio streaming** - Verify real-time audio transmission
4. **Network interruption** - Verify reconnection logic
5. **Multiple users** - Verify concurrent recordings

## Dashboard Integration

The web dashboard will automatically show:

- **User status**: Online when logged in, Calling when recording
- **Active calls**: Real-time list of users currently recording
- **Admin monitoring**: "Show" button for admins to monitor calls

## Next Steps

1. Implement the HTTP client in your C++ application
2. Add audio capture and streaming functionality
3. Integrate with your existing tray menu system
4. Test the complete workflow
5. Add error handling and user feedback
6. Deploy and monitor in production

## Support

For API issues or questions, check the server logs or contact the development team.
