import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Slider,
  Button
} from '@mui/material';
import {
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { OpusDecoder } from 'opus-decoder';
import './WebRTCAudioPlayer.css';

interface WebRTCAudioPlayerProps {
  callId: string;
  audioType: 'mic' | 'speaker';
  autoPlay?: boolean;
  onConnectionStateChange?: (state: string) => void;
  onAudioLevelChange?: (level: number) => void;
}

interface WebRTCConnectionState {
  connected: boolean;
  state: string;
  audioLevel: number;
  error?: string;
}

const WebRTCAudioPlayer: React.FC<WebRTCAudioPlayerProps> = ({
  callId,
  audioType,
  autoPlay = true,
  onConnectionStateChange,
  onAudioLevelChange
}) => {
  // Default audio level callback if none provided
  const defaultAudioLevelCallback = useCallback((_level: number) => {
    // Remove default logging for production
    // console.log(`${audioType === 'speaker' ? 'Speaker' : 'Mic'} audio level: ${Math.round(level * 100)}`);
  }, [audioType]);
  
  // Use provided callback or default
  const audioLevelCallback = onAudioLevelChange || defaultAudioLevelCallback;
  const { socket } = useSocket();
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>({
    connected: false,
    state: 'disconnected',
    audioLevel: 0
  });
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.6); // Default volume to 60%
  
  // Opus decoder for handling compressed audio
  const opusDecoderRef = useRef<OpusDecoder<48000> | null>(null);
  
  // Audio scheduling state - separate timing for mic and speaker
  const nextPlayTimeRef = useRef<number>(0);
  const isFirstAudioRef = useRef<boolean>(true);
  const lastAudioTimeRef = useRef<number>(0);
  
  // Separate timing for mic and speaker to prevent interference
  const micTimingRef = useRef<{ nextTime: number; isFirst: boolean }>({ nextTime: 0, isFirst: true });
  const speakerTimingRef = useRef<{ nextTime: number; isFirst: boolean }>({ nextTime: 0, isFirst: true });
  
  // Function to reset audio timing
  const resetAudioTiming = useCallback(() => {
    nextPlayTimeRef.current = 0;
    isFirstAudioRef.current = true;
    lastAudioTimeRef.current = 0;
    
    // Reset separate timing for mic and speaker
    micTimingRef.current = { nextTime: 0, isFirst: true };
    speakerTimingRef.current = { nextTime: 0, isFirst: true };
    
    console.log('🎵 Audio timing reset for both mic and speaker');
  }, []);

  // Initialize WebRTC connection
  const initializeWebRTC = useCallback(async () => {
    try {
      console.log('🔗 Initializing WebRTC for:', callId, audioType);

      // Create RTCPeerConnection
      peerConnectionRef.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Set up event handlers
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 Sending ICE candidate:', callId);
          socket?.emit('ice_candidate', {
            callId,
            candidate: event.candidate
          });
        }
      };

      peerConnectionRef.current.onconnectionstatechange = () => {
        const state = peerConnectionRef.current?.connectionState || 'disconnected';
        console.log('🔗 WebRTC connection state changed:', callId, state);
        
        setConnectionState(prev => ({
          ...prev,
          connected: state === 'connected',
          state
        }));
        
        onConnectionStateChange?.(state);
      };

      peerConnectionRef.current.onsignalingstatechange = () => {
        console.log('📡 Signaling state:', callId, peerConnectionRef.current?.signalingState);
      };

      // Handle incoming audio tracks
      peerConnectionRef.current.ontrack = (event) => {
        console.log('🎵 Received audio track:', callId, audioType);
        
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          
          // Set up audio context for analysis with correct sample rate
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext({
              sampleRate: 48000 // Match Opus decoder sample rate
            });
          }
          
          // Create analyser for audio level monitoring
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          
          // Create gain node for volume control
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.gain.value = isMuted ? 0 : volume;
          
          // Connect audio pipeline
          const source = audioContextRef.current.createMediaStreamSource(stream);
          source.connect(analyserRef.current);
          analyserRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
          
          // Start audio analysis
          startAudioAnalysis();
          
          // Set audio element source
          if (audioElementRef.current) {
            audioElementRef.current.srcObject = stream;
            if (autoPlay) {
              audioElementRef.current.play().catch(console.error);
            }
          }
        }
      };

      // Create and send offer
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('📡 Sending WebRTC offer:', callId);
      socket?.emit('webrtc_offer', {
        callId,
        offer: peerConnectionRef.current.localDescription
      });

    } catch (error) {
      console.error('❌ Error initializing WebRTC:', error);
      setConnectionState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [callId, audioType, socket, autoPlay, onConnectionStateChange]);

  // Audio analysis for level monitoring
  const startAudioAnalysis = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const level = rms / 255; // Normalize to 0-1
      
      setConnectionState(prev => ({
        ...prev,
        audioLevel: level
      }));
      
      // Call audio level callback (with default implementation)
      audioLevelCallback(level);
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
  }, [onAudioLevelChange]);

  // Handle WebRTC answer from backend
  const handleWebRTCAnswer = useCallback(async (data: any) => {
    try {
      if (data.callId === callId && peerConnectionRef.current) {
        console.log('📡 Received WebRTC answer:', callId);
        
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } catch (error) {
      console.error('❌ Error handling WebRTC answer:', error);
      
      // WebRTC failed, automatically fall back to base64 audio streaming
      console.log('🔄 WebRTC failed, falling back to base64 audio streaming');
      
      setConnectionState(prev => ({
        ...prev,
        error: 'WebRTC failed, using base64 streaming',
        state: 'fallback'
      }));
      
      // Initialize base64 audio streaming as fallback
      initializeBase64AudioStreaming();
    }
  }, [callId]);

  // Initialize base64 audio streaming as fallback
  const initializeBase64AudioStreaming = useCallback(() => {
    console.log('🎵 Initializing base64 audio streaming fallback for:', callId, audioType);
    
          // Set up audio context for base64 streaming with correct sample rate
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({
          sampleRate: 48000 // Match Opus decoder sample rate
        });
      }
    
    // Create analyser for audio level monitoring
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    
    // Create gain node for volume control
    gainNodeRef.current = audioContextRef.current.createGain();
    gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    
    // Connect audio nodes
    analyserRef.current.connect(gainNodeRef.current);
    gainNodeRef.current.connect(audioContextRef.current.destination);
    
    // Start audio analysis
    startAudioAnalysis();
    
    setConnectionState(prev => ({
      ...prev,
      connected: true,
      state: 'connected',
      error: undefined
    }));
    
    onConnectionStateChange?.('connected');
  }, [callId, audioType, isMuted, volume, startAudioAnalysis, onConnectionStateChange]);

  // Handle base64 audio data from backend (Opus-encoded)
  const handleBase64AudioData = useCallback(async (data: any) => {
    if (data.callId === callId && data.audioType === audioType && audioContextRef.current && opusDecoderRef.current) {
      try {
        // Log received data for debugging
        console.log('🎵 Received Opus audio data:', {
          callId: data.callId,
          audioType: data.audioType,
          sampleRate: data.sampleRate,
          channels: data.channels,
          audioDataLength: data.audioData ? data.audioData.length : 0
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
        
        console.log('🎵 Decoding Opus audio:', {
          channels,
          sampleRate,
          opusDataLength: opusArray.length
        });
        
        // Properly decode Opus data using the opus-decoder library
        let audioBuffer: AudioBuffer;
        
        try {
          // Use the opus-decoder library to decode the data
          if (!opusDecoderRef.current) {
            console.warn('⚠️ Opus decoder not initialized');
            return;
          }
          const decodedData = opusDecoderRef.current.decodeFrame(opusArray);
          
          if (!decodedData || decodedData.channelData.length === 0) {
            console.warn('⚠️ No decoded data received from Opus decoder');
            return;
          }
          
          console.log('🎵 Opus decoded successfully:', {
            numberOfChannels: decodedData.channelData.length,
            samplesDecoded: decodedData.samplesDecoded,
            sampleRate: decodedData.sampleRate,
            errors: decodedData.errors.length
          });
          
          // Create audio buffer from decoded data
          audioBuffer = audioContextRef.current.createBuffer(
            decodedData.channelData.length,
            decodedData.samplesDecoded,
            decodedData.sampleRate
          );
          
          // Copy decoded data to audio buffer
          for (let channel = 0; channel < decodedData.channelData.length; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            const decodedChannelData = decodedData.channelData[channel];
            
            for (let i = 0; i < decodedData.samplesDecoded; i++) {
              channelData[i] = decodedChannelData[i];
            }
          }
          
          console.log('🎵 Audio buffer created from Opus data:', {
            channels: audioBuffer.numberOfChannels,
            length: audioBuffer.length,
            sampleRate: audioBuffer.sampleRate,
            duration: audioBuffer.duration
          });
        } catch (error) {
          console.error('❌ Opus decoding failed:', error);
          return;
        }
        
        // Create and play audio source with simplified processing
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        
        // Create a simple gain node for volume control
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = volume;
        
        // Connect directly to destination for now (simplified)
        source.connect(gainNode);
        gainNode.connect(audioContextRef.current!.destination);
        
        // Also connect to analyser for level monitoring
        gainNode.connect(analyserRef.current!);
        
        console.log('🎵 Audio processing chain connected:', {
          audioContextState: audioContextRef.current.state,
          sampleRate: audioContextRef.current.sampleRate,
          destinationConnected: true
        });
        
        // Add completion handler for audio playback
        source.onended = () => {
          console.log(`🎵 ${audioType} audio buffer finished playing`);
        };
        
        // Schedule audio to play at the correct time
        const currentTime = audioContextRef.current.currentTime;
        const bufferDuration = audioBuffer.duration; // Should be 0.01 seconds (10ms)
        
        // Use separate timing for mic and speaker
        const timingRef = audioType === 'mic' ? micTimingRef : speakerTimingRef;
        
        // For the first audio buffer of this type, start immediately
        if (timingRef.current.isFirst) {
          timingRef.current.nextTime = currentTime;
          timingRef.current.isFirst = false;
          console.log(`🎵 First ${audioType} audio buffer - starting immediately at:`, timingRef.current.nextTime);
        }
        
        // Simple timing: just ensure we don't schedule in the past
        if (timingRef.current.nextTime < currentTime) {
          timingRef.current.nextTime = currentTime;
        }
        
        // CRITICAL: Check if audio context is closed and recreate if needed
        if (audioContextRef.current.state === 'closed') {
          console.log('🎵 Audio context is closed, creating new one');
          audioContextRef.current = new AudioContext({
            sampleRate: 48000
          });
          
          // Recreate analyser and gain node
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.gain.value = isMuted ? 0 : volume;
          
          // Reconnect nodes
          analyserRef.current.connect(gainNodeRef.current);
          gainNodeRef.current.connect(audioContextRef.current.destination);
        }
        
        // Ensure audio context is running
        if (audioContextRef.current.state === 'suspended') {
          console.log('🎵 Audio context suspended, resuming...');
          await audioContextRef.current.resume();
        }
        
        // Schedule this buffer to play at the next scheduled time
        source.start(timingRef.current.nextTime);
        
        // Update the next play time for the next buffer
        timingRef.current.nextTime += bufferDuration;
        
        console.log('🎵 Audio buffer scheduled:', {
          audioType: audioType,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          format: `Opus-encoded ${channels > 1 ? 'stereo' : 'mono'}`,
          scheduledTime: timingRef.current.nextTime,
          currentTime: currentTime,
          bufferDuration: bufferDuration,
          timingOffset: timingRef.current.nextTime - currentTime
        });
        
      } catch (error) {
        console.error('❌ Error processing base64 audio data:', error);
      }
    }
  }, [callId, audioType]);

  // Handle ICE candidates from backend
  const handleIceCandidate = useCallback(async (data: any) => {
    try {
      if (data.callId === callId && peerConnectionRef.current) {
        console.log('🧊 Received ICE candidate:', callId);
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }, [callId]);

  // Handle connection state changes from backend
  const handleConnectionStateChange = useCallback((data: any) => {
    if (data.callId === callId) {
      console.log('🔗 Connection state update:', callId, data.state);
      setConnectionState(prev => ({
        ...prev,
        connected: data.state === 'connected',
        state: data.state
      }));
    }
  }, [callId]);

  // Handle WebRTC errors
  const handleWebRTCError = useCallback((data: any) => {
    if (data.callId === callId) {
      console.error('❌ WebRTC error:', data.error);
      setConnectionState(prev => ({
        ...prev,
        error: data.error
      }));
    }
  }, [callId]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = newMuted ? 0 : volume;
      }
      return newMuted;
    });
  }, [volume]);

  // Handle volume change
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (gainNodeRef.current && !isMuted) {
      gainNodeRef.current.gain.value = newVolume;
    }
  }, [isMuted]);

  // Initialize WebRTC when component mounts
  useEffect(() => {
    if (socket && callId) {
              // Initialize Opus decoder
        const initOpusDecoder = async () => {
          try {
            opusDecoderRef.current = new OpusDecoder({
              sampleRate: 48000 as const,
              channels: 1,
              forceStereo: false
            });
            await opusDecoderRef.current.ready;
            console.log('🎵 Opus decoder initialized for:', audioType);
          } catch (error) {
            console.error('❌ Failed to initialize Opus decoder:', error);
          }
        };
      
              initOpusDecoder();
        
        // Add click handler to resume audio context on user interaction
        const handleUserInteraction = async () => {
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            console.log('🎵 User interaction detected, resuming audio context');
            await audioContextRef.current.resume();
          }
          // Remove the event listeners after first interaction
          document.removeEventListener('click', handleUserInteraction);
          document.removeEventListener('keydown', handleUserInteraction);
        };
        
        // Add event listeners for user interaction
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keydown', handleUserInteraction);
        
        // Test audio context with a simple tone
        const testAudioContext = async () => {
          try {
            if (!audioContextRef.current) {
              audioContextRef.current = new AudioContext({
                sampleRate: 48000
              });
            }
            
            // Resume audio context if suspended
            if (audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
            }
            
            console.log('🎵 Audio context state:', audioContextRef.current.state);
            
            // Only play test tone if context is running
            if (audioContextRef.current.state === 'running') {
              // Create a simple test tone to verify audio is working
              const testBuffer = audioContextRef.current.createBuffer(1, 480, 48000);
              const testData = testBuffer.getChannelData(0);
              
              // Generate a 440 Hz sine wave for 10ms
              for (let i = 0; i < 480; i++) {
                const time = i / 48000;
                testData[i] = 0.3 * Math.sin(2 * Math.PI * 440 * time); // Louder test tone
              }
              
              const testSource = audioContextRef.current.createBufferSource();
              testSource.buffer = testBuffer;
              testSource.connect(audioContextRef.current.destination);
              
              console.log('🎵 Playing test tone to verify audio context...');
              testSource.start();
              testSource.onended = () => {
                console.log('🎵 Test tone finished - audio context is working');
              };
            } else {
              console.warn('⚠️ Audio context not running, cannot play test tone');
            }
            
          } catch (error) {
            console.error('❌ Audio context test failed:', error);
          }
        };
        
        testAudioContext();
        
        // Set up socket event listeners
      socket.on('webrtc_answer', handleWebRTCAnswer);
      socket.on('ice_candidate', handleIceCandidate);
      socket.on('connection_state_change', handleConnectionStateChange);
      socket.on('webrtc_error', handleWebRTCError);
      socket.on('call_audio_' + callId, handleBase64AudioData);

      // Initialize WebRTC connection
      initializeWebRTC();

      // Cleanup function
      return () => {
        socket.off('webrtc_answer', handleWebRTCAnswer);
        socket.off('ice_candidate', handleIceCandidate);
        socket.off('connection_state_change', handleConnectionStateChange);
        socket.off('webrtc_error', handleWebRTCError);
        socket.off('call_audio_' + callId, handleBase64AudioData);
        
        // Clean up event listeners
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
      };
    }
  }, [socket, callId, handleWebRTCAnswer, handleIceCandidate, handleConnectionStateChange, handleWebRTCError, handleBase64AudioData, initializeWebRTC]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update gain when mute/volume changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [isMuted, volume]);

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        p: 3,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 40px rgba(102, 126, 234, 0.4)',
        }
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)',
          animation: 'pulse 3s infinite'
        }}
      />
      
      <Box position="relative" zIndex={1}>
        {/* Header */}
        <Box display="flex" alignItems="center" mb={2}>
          <VolumeUpIcon sx={{ fontSize: 28, mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {audioType === 'mic' ? 'Microphone' : 'Speaker'} Audio
          </Typography>
          <Chip
            label={connectionState.connected ? 'Connected' : 'Disconnected'}
            size="small"
            sx={{
              ml: 'auto',
              background: connectionState.connected ? 'rgba(76, 175, 80, 0.9)' : 'rgba(244, 67, 54, 0.9)',
              color: 'white',
              fontWeight: 600
            }}
          />
        </Box>

        {/* Audio Level Visualization */}
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Audio Level
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {Math.round(connectionState.audioLevel * 100)}%
            </Typography>
          </Box>
          <Box
            sx={{
              width: '100%',
              height: 8,
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 4,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <Box
              sx={{
                width: `${connectionState.audioLevel * 100}%`,
                height: '100%',
                background: connectionState.connected 
                  ? 'linear-gradient(90deg, #4CAF50, #8BC34A)' 
                  : 'linear-gradient(90deg, #f44336, #ff5722)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
                boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
              }}
            />
          </Box>
        </Box>

        {/* Controls */}
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton
            onClick={handleMuteToggle}
            disabled={!connectionState.connected}
            sx={{
              background: isMuted ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              '&:hover': {
                background: isMuted ? 'rgba(244, 67, 54, 0.3)' : 'rgba(255, 255, 255, 0.3)',
              }
            }}
          >
            {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
          
          <IconButton
            onClick={resetAudioTiming}
            disabled={!connectionState.connected}
            sx={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.3)',
              }
            }}
            title="Reset Audio Timing"
          >
            <RefreshIcon />
          </IconButton>
          
          <Box flex={1}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Volume
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {Math.round(volume * 100)}%
              </Typography>
            </Box>
            <Slider
              value={volume}
              onChange={(_, value) => handleVolumeChange(value as number)}
              disabled={isMuted || !connectionState.connected}
              sx={{
                color: 'white',
                '& .MuiSlider-track': {
                  background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
                },
                '& .MuiSlider-thumb': {
                  background: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                },
                '& .MuiSlider-rail': {
                  background: 'rgba(255, 255, 255, 0.3)',
                }
              }}
            />
          </Box>
        </Box>
      </Box>

      <audio
        ref={audioElementRef}
        autoPlay={autoPlay}
        style={{ display: 'none' }}
      />
    </Box>
  );
};

export default WebRTCAudioPlayer;
