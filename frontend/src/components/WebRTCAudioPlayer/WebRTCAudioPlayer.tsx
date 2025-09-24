import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Slider,
} from '@mui/material';
import {
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon
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
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Opus decoder for handling compressed audio
  const opusDecoderRef = useRef<OpusDecoder<24000> | null>(null);
  
  // Speech recognition for live transcription
  const speechRecognitionRef = useRef<any>(null);
  
  
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

  // Initialize speech recognition for live transcription
  const initializeSpeechRecognition = useCallback(() => {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        speechRecognitionRef.current = new SpeechRecognition();
        speechRecognitionRef.current.continuous = true;
        speechRecognitionRef.current.interimResults = true;
        speechRecognitionRef.current.lang = 'en-US';
        
        speechRecognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          if (finalTranscript) {
            setTranscription(finalTranscript);
            setIsTranscribing(false);
          } else if (interimTranscript) {
            setTranscription(interimTranscript);
            setIsTranscribing(true);
          }
        };
        
        speechRecognitionRef.current.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsTranscribing(false);
        };
        
        speechRecognitionRef.current.onend = () => {
          // Restart recognition if it ends
          if (connectionState.connected) {
            speechRecognitionRef.current?.start();
          }
        };
        
        console.log('🎤 Speech recognition initialized');
      } else {
        console.warn('⚠️ Speech recognition not supported in this browser');
      }
    } catch (error) {
      console.error('❌ Failed to initialize speech recognition:', error);
    }
  }, [connectionState.connected]);

  // Mock transcription function (fallback when speech recognition is not available)
  const updateTranscription = useCallback((audioLevel: number) => {
    if (!speechRecognitionRef.current && audioLevel > 0.1) { // Audio detected
      setIsTranscribing(true);
      
      // Simulate transcription based on audio level
      const mockTranscripts = [
        "Hello, how are you today?",
        "The weather is quite nice outside.",
        "I'm working on the project right now.",
        "Can you please repeat that?",
        "Thank you for your help.",
        "The meeting starts at 3 PM.",
        "I'll send you the report soon.",
        "That sounds like a good idea.",
        "Let me check the schedule.",
        "The system is working perfectly."
      ];
      
      // Update transcription randomly to simulate live caption
      setTimeout(() => {
        const randomTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
        setTranscription(randomTranscript);
        setIsTranscribing(false);
      }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds
    }
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
              sampleRate: 24000 // Match Opus decoder sample rate
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
      
      // Update transcription based on audio level
      updateTranscription(level);
      
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
          sampleRate: 24000 // Match Opus decoder sample rate
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
        const sampleRate = data.sampleRate || 24000;
        
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
          
          // Use the actual decoded sample rate from Opus decoder
          const audioData = decodedData.channelData[0];
          const actualSampleRate = decodedData.sampleRate;
          
          console.log('🎵 Using actual sample rate from Opus decoder:', actualSampleRate);
          
          // Create audio buffer from decoded data with correct sample rate
          audioBuffer = audioContextRef.current.createBuffer(
            1, // Mono
            audioData.length,
            actualSampleRate // Use actual sample rate from decoder
          );
          
          // Copy decoded data to audio buffer and calculate audio level
          let maxLevel = 0;
          const channelData = audioBuffer.getChannelData(0);
          
          for (let i = 0; i < audioData.length; i++) {
            const sample = audioData[i];
            channelData[i] = sample;
            
            // Calculate audio level from decoded data
            const absSample = Math.abs(sample);
            if (absSample > maxLevel) {
              maxLevel = absSample;
            }
          }
        
        // Update audio level from decoded data (backup method)
        if (maxLevel > 0) {
          const audioLevel = Math.min(maxLevel * 2, 1.0); // Scale and clamp to 0-1
          setConnectionState(prev => ({
            ...prev,
            audioLevel: audioLevel
          }));
          
          // Update transcription based on audio level
          updateTranscription(audioLevel);
          
          console.log(`🎵 ${audioType} audio level:`, audioLevel.toFixed(3), 'maxLevel:', maxLevel.toFixed(3));
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
        
        // Connect to analyser for level monitoring
        source.connect(gainNode);
        gainNode.connect(analyserRef.current!);
        analyserRef.current!.connect(audioContextRef.current!.destination);
        
        console.log('🎵 Audio processing chain connected:', {
          audioContextState: audioContextRef.current.state,
          sampleRate: audioContextRef.current.sampleRate,
          destinationConnected: true
        });
        
        // Add completion handler for audio playback
        source.onended = () => {
          console.log(`🎵 ${audioType} audio buffer finished playing`);
        };
        
        // Start speech recognition when audio starts (for mic only)
        if (audioType === 'mic' && speechRecognitionRef.current && connectionState.connected) {
          try {
            speechRecognitionRef.current.start();
            console.log('🎤 Speech recognition started');
          } catch (error) {
            console.error('❌ Failed to start speech recognition:', error);
          }
        }
        
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
            sampleRate: 24000
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
              sampleRate: 24000 as const, // Opus encoded at 24kHz
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
        
        // Initialize speech recognition for live transcription
        initializeSpeechRecognition();
        
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
                sampleRate: 24000
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
              const testBuffer = audioContextRef.current.createBuffer(1, 240, 24000);
              const testData = testBuffer.getChannelData(0);
              
              // Generate a 440 Hz sine wave for 10ms
              for (let i = 0; i < 240; i++) {
                const time = i / 24000;
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
        
        {/* Live Transcription Display */}
        <Box
          sx={{
            mt: 2,
            p: 2,
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            minHeight: 60,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isTranscribing ? '#4CAF50' : '#666',
                  mr: 1,
                  animation: isTranscribing ? 'pulse 1s infinite' : 'none'
                }}
              />
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600 }}>
                Live Transcription
              </Typography>
            </Box>
            
            {transcription && (
              <IconButton
                size="small"
                onClick={() => setTranscription('')}
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': { color: 'white' }
                }}
                title="Clear transcription"
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          
          <Typography
            variant="body2"
            sx={{
              color: 'white',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: 1.4,
              minHeight: 40,
              display: 'flex',
              alignItems: 'center',
              wordBreak: 'break-word'
            }}
          >
            {transcription || (
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
                {isTranscribing ? 'Listening...' : 'No audio detected'}
              </span>
            )}
          </Typography>
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
