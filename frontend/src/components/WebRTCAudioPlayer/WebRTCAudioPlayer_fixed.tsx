import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Chip, IconButton, Slider } from '@mui/material';
import { VolumeUp, VolumeOff } from '@mui/icons-material';

interface WebRTCAudioPlayerProps {
  callId: string;
  audioType: 'mic' | 'speaker';
  autoPlay?: boolean;
  onConnectionStateChange?: (state: string) => void;
  onAudioLevelChange?: (level: number) => void;
}

const WebRTCAudioPlayer: React.FC<WebRTCAudioPlayerProps> = ({
  callId,
  audioType,
  autoPlay = true,
  onConnectionStateChange,
  onAudioLevelChange
}) => {
  const [_isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionState, setConnectionState] = useState({
    connected: false,
    state: 'disconnected'
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // const _peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize audio context and analyzer
  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Start audio analysis
  const startAudioAnalysis = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length) / 255;
      
      setAudioLevel(rms);
      onAudioLevelChange?.(rms);
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };
    
    updateAudioLevel();
  }, [onAudioLevelChange]);

  // Stop audio analysis
  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  // Handle base64 audio data from backend (now Opus-encoded)
  const handleBase64AudioData = useCallback((data: any) => {
    if (data.callId === callId && data.audioType === audioType && audioContextRef.current) {
      try {
        // Log received data for debugging
        console.log('🎵 Received Opus audio data:', {
          callId: data.callId,
          audioType: data.audioType,
          sampleRate: data.sampleRate,
          bitsPerSample: data.bitsPerSample,
          channels: data.channels,
          audioDataLength: data.audioData ? data.audioData.length : 0,
          firstBytes: data.audioData ? data.audioData.substring(0, 20) : 'none'
        });
        
        // Decode base64 Opus data
        const audioData = atob(data.audioData);
        const opusArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          opusArray[i] = audioData.charCodeAt(i);
        }
        
        // Get audio parameters
        const channels = data.channels || 1;
        const sampleRate = data.sampleRate || 48000;
        
        console.log('🎵 Processing Opus audio:', {
          channels,
          sampleRate,
          opusDataLength: opusArray.length,
          firstBytes: opusArray.slice(0, 8)
        });
        
        // For now, create a simple audio buffer from Opus data
        // In a real implementation, you would decode the Opus data here
        const frameSize = 480; // 10ms at 48kHz
        const audioBuffer = audioContextRef.current.createBuffer(
          channels,
          frameSize,
          sampleRate
        );
        
        // Fill audio buffer with simple decoded data
        for (let channel = 0; channel < channels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          
          // Simple conversion: use Opus data as audio samples
          for (let i = 0; i < frameSize; i++) {
            if (i < opusArray.length) {
              // Convert byte to float sample (-1 to 1)
              let sample = (opusArray[i] - 128) / 128.0;
              
              // Apply noise reduction
              if (Math.abs(sample) < 0.01) {
                sample = 0;
              }
              
              // Limit amplitude to prevent distortion
              if (Math.abs(sample) > 0.8) {
                sample = sample > 0 ? 0.8 : -0.8;
              }
              
              channelData[i] = sample;
            } else {
              channelData[i] = 0; // Silence for remaining samples
            }
          }
        }
        
        // Create and play audio source
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        
        // Create audio processing chain for noise reduction
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = 0.4; // Slightly lower volume for noise reduction
        
        // Create low-pass filter to reduce high-frequency noise
        const lowPassFilter = audioContextRef.current.createBiquadFilter();
        lowPassFilter.type = 'lowpass';
        lowPassFilter.frequency.value = 8000; // 8kHz cutoff
        lowPassFilter.Q.value = 1.0;
        
        // Create high-pass filter to reduce low-frequency noise
        const highPassFilter = audioContextRef.current.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = 80; // 80Hz cutoff
        highPassFilter.Q.value = 1.0;
        
        // Create notch filter to reduce specific noise frequencies
        const notchFilter = audioContextRef.current.createBiquadFilter();
        notchFilter.type = 'notch';
        notchFilter.frequency.value = 60; // 60Hz power line noise
        notchFilter.Q.value = 10.0;
        
        // Create compressor to reduce dynamic range and noise
        const compressor = audioContextRef.current.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 30;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        
        // Connect audio processing chain
        source.connect(gainNode);
        gainNode.connect(lowPassFilter);
        lowPassFilter.connect(highPassFilter);
        highPassFilter.connect(notchFilter);
        notchFilter.connect(compressor);
        compressor.connect(analyserRef.current!);
        
        // Add completion handler for audio playback
        source.onended = () => {
          console.log('🎵 Audio buffer finished playing');
        };
        
        source.start();
        
        console.log('🎵 Audio buffer started playing:', {
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          format: `Opus-encoded ${channels > 1 ? 'stereo' : 'mono'}`
        });
        
      } catch (error) {
        console.error('❌ Error processing base64 audio data:', error);
      }
    }
  }, [callId, audioType]);

  // Connect to WebRTC server
  useEffect(() => {
    const connectToServer = async () => {
      try {
        // Import Socket.IO dynamically
        const { io } = await import('socket.io-client');
        
        // Connect to the WebRTC server
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002';
        socketRef.current = io(socketUrl, {
          transports: ['websocket'],
          path: '/webrtc'
        });

        socketRef.current.on('connect', () => {
          console.log('🔗 Connected to WebRTC server');
          setIsConnected(true);
          setConnectionState(prev => ({
            ...prev,
            connected: true,
            state: 'connected'
          }));
          
          // Join the call
          socketRef.current?.emit('join_call', {
            callId,
            audioType
          });
          
          // Start audio analysis
          if (autoPlay) {
            startAudioAnalysis();
          }
        });

        socketRef.current.on('disconnect', () => {
          console.log('🔌 Disconnected from WebRTC server');
          setIsConnected(false);
          setConnectionState(prev => ({
            ...prev,
            connected: false,
            state: 'disconnected'
          }));
          stopAudioAnalysis();
        });

        // Listen for audio data
        socketRef.current.on('audio_data', handleBase64AudioData);

        socketRef.current.on('connect_error', (error: any) => {
          console.error('❌ WebRTC connection error:', error);
          setConnectionState(prev => ({
            ...prev,
            connected: false,
            state: 'error'
          }));
        });

      } catch (error) {
        console.error('❌ Error connecting to WebRTC server:', error);
        setConnectionState(prev => ({
          ...prev,
          connected: false,
          state: 'error'
        }));
      }
    };

    connectToServer();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      stopAudioAnalysis();
    };
  }, [callId, audioType, autoPlay, startAudioAnalysis, stopAudioAnalysis, handleBase64AudioData]);

  // Handle volume changes
  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const newVolume = Array.isArray(newValue) ? newValue[0] : newValue;
    setVolume(newVolume);
  };

  // Handle mute toggle
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  // Update connection state callback
  useEffect(() => {
    onConnectionStateChange?.(connectionState.state);
  }, [connectionState.state, onConnectionStateChange]);

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        p: 3,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 200
      }}
    >
      {/* Decorative elements */}
      <Box
        sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          animation: 'pulse 2s infinite'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.05)',
          animation: 'pulse 3s infinite'
        }}
      />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                     <VolumeUp sx={{ color: 'white', fontSize: 24 }} />
          <Typography
            variant="h6"
            sx={{
              color: 'white',
              fontWeight: 600,
              background: 'linear-gradient(45deg, #fff, #f0f0f0)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            {audioType === 'mic' ? 'Microphone' : 'Speaker'} Audio
          </Typography>
        </Box>
        
        <Chip
          label={connectionState.connected ? 'Connected' : 'Disconnected'}
          color={connectionState.connected ? 'success' : 'error'}
          size="small"
          sx={{
            background: connectionState.connected 
              ? 'rgba(76, 175, 80, 0.2)' 
              : 'rgba(244, 67, 54, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        />
      </Box>

      {/* Audio Level Visualization */}
      <Box sx={{ mb: 3 }}>
        <Box
          sx={{
            height: 60,
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${audioLevel * 100}%`,
              background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
              borderRadius: 2,
              transition: 'width 0.1s ease-out',
              position: 'relative'
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 2s infinite'
              }}
            />
          </Box>
        </Box>
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255, 255, 255, 0.8)', mt: 1, display: 'block' }}
        >
          Audio Level: {Math.round(audioLevel * 100)}%
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton
          onClick={handleMuteToggle}
          sx={{
            background: isMuted ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            '&:hover': {
              background: isMuted ? 'rgba(244, 67, 54, 0.3)' : 'rgba(255, 255, 255, 0.2)'
            }
          }}
        >
                      {isMuted ? <VolumeOff /> : <VolumeUp />}
        </IconButton>
        
        <Box sx={{ flex: 1 }}>
          <Slider
            value={volume}
            onChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.01}
            sx={{
              color: 'white',
              '& .MuiSlider-track': {
                background: 'linear-gradient(90deg, #4CAF50, #8BC34A)'
              },
              '& .MuiSlider-thumb': {
                background: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
              }
            }}
          />
        </Box>
        
        <Typography
          variant="body2"
          sx={{ color: 'white', minWidth: 40, textAlign: 'center' }}
        >
          {Math.round(volume * 100)}%
        </Typography>
      </Box>

      {/* Status Info */}
      <Box sx={{ mt: 2, p: 2, background: 'rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block' }}
        >
          Call ID: {callId}
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'rgba(255, 255, 255, 0.8)', display: 'block' }}
        >
          Status: {connectionState.state}
        </Typography>
      </Box>
    </Box>
  );
};

export default WebRTCAudioPlayer;
