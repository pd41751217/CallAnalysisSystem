import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
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
  const [volume, setVolume] = useState(1.0);

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
          
          // Set up audio context for analysis
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
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
      
      onAudioLevelChange?.(level);
      
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
    
    // Set up audio context for base64 streaming
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
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

  // Handle base64 audio data from backend
  const handleBase64AudioData = useCallback((data: any) => {
    if (data.callId === callId && data.audioType === audioType && audioContextRef.current) {
      try {
        // Log received data for debugging
                          console.log('🎵 Received audio data:', {
                    callId: data.callId,
                    audioType: data.audioType,
                    sampleRate: data.sampleRate,
                    bitsPerSample: data.bitsPerSample,
                    channels: data.channels,
                    audioDataLength: data.audioData ? data.audioData.length : 0,
                    firstBytes: data.audioData ? data.audioData.substring(0, 20) : 'none'
                  });
        
        // Decode base64 audio data
        const audioData = atob(data.audioData);
        const audioArray = new Uint8Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          audioArray[i] = audioData.charCodeAt(i);
        }
        
        // Get audio parameters
        const channels = data.channels || 1;
        const sampleRate = data.sampleRate || 48000;
        const bitsPerSample = data.bitsPerSample || 16;
        
        // Calculate correct buffer size (bytes per sample * channels)
        const bytesPerSample = bitsPerSample / 8;
        const samplesPerChannel = audioArray.length / (bytesPerSample * channels);
        
                          console.log('🎵 Processing audio:', {
                    channels,
                    sampleRate,
                    bitsPerSample,
                    audioDataLength: audioArray.length,
                    samplesPerChannel,
                    bytesPerSample,
                    firstSamples: audioArray.slice(0, 8)
                  });
        
        // Create audio buffer
        const audioBuffer = audioContextRef.current.createBuffer(
          channels,
          samplesPerChannel,
          sampleRate
        );
        
        // Fill audio buffer with decoded data
        for (let channel = 0; channel < channels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          
          for (let i = 0; i < samplesPerChannel; i++) {
            const byteIndex = (i * channels + channel) * bytesPerSample;
            
            // Check bounds to prevent array access errors
            if (byteIndex + bytesPerSample > audioArray.length) {
              console.warn('⚠️ Audio data bounds exceeded, stopping processing');
              break;
            }
            
            if (bitsPerSample === 32) {
              // Try both 32-bit integer and 32-bit float interpretations
              const sampleInt = (audioArray[byteIndex] | 
                               (audioArray[byteIndex + 1] << 8) | 
                               (audioArray[byteIndex + 2] << 16) | 
                               (audioArray[byteIndex + 3] << 24));
              
              // Create a DataView to read as 32-bit float
              const buffer = new ArrayBuffer(4);
              const view = new DataView(buffer);
              view.setUint8(0, audioArray[byteIndex]);
              view.setUint8(1, audioArray[byteIndex + 1]);
              view.setUint8(2, audioArray[byteIndex + 2]);
              view.setUint8(3, audioArray[byteIndex + 3]);
              const sampleFloat = view.getFloat32(0, true); // true = little-endian
              
              // Use float interpretation (more common for 32-bit audio)
              channelData[i] = sampleFloat;
              
              // Debug first few samples (only for first audio chunk)
              if (i < 3 && Math.random() < 0.01) {
                console.log(`🎵 Sample ${i}: int=${sampleInt}, float=${sampleFloat}, normalized=${channelData[i]}`);
              }
            } else if (bitsPerSample === 16) {
              // 16-bit signed integer (little-endian)
              const sample = (audioArray[byteIndex] | (audioArray[byteIndex + 1] << 8));
              channelData[i] = sample >= 0x8000 ? (sample - 0x10000) / 32768.0 : sample / 32768.0;
            } else if (bitsPerSample === 8) {
              // 8-bit unsigned integer
              channelData[i] = (audioArray[byteIndex] - 128) / 128.0;
            } else {
              // Default to 16-bit
              const sample = (audioArray[byteIndex] | (audioArray[byteIndex + 1] << 8));
              channelData[i] = sample >= 0x8000 ? (sample - 0x10000) / 32768.0 : sample / 32768.0;
            }
          }
        }
        
                          // Create and play audio source
                  const source = audioContextRef.current.createBufferSource();
                  source.buffer = audioBuffer;
                  
                  // Add volume control to reduce high volume
                  const gainNode = audioContextRef.current.createGain();
                  gainNode.gain.value = 0.5; // Increase volume back to 50%
                  
                  source.connect(gainNode);
                  gainNode.connect(analyserRef.current!);
        
        // Add completion handler for audio playback
        source.onended = () => {
          console.log('🎵 Audio buffer finished playing');
        };
        
        source.start();
        
        console.log('🎵 Audio buffer started playing:', {
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: audioBuffer.numberOfChannels,
          format: `${bitsPerSample}-bit ${channels > 1 ? 'stereo' : 'mono'}`
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
    <div className="webrtc-audio-player">
      <div className="audio-level">
        <div className="level-bar">
          <div 
            className="level-fill" 
            style={{ 
              width: `${connectionState.audioLevel * 100}%`,
              backgroundColor: connectionState.connected ? '#4CAF50' : '#f44336'
            }}
          />
        </div>
      </div>

      <div className="audio-controls">
        <button 
          className={`mute-button ${isMuted ? 'muted' : ''}`}
          onClick={handleMuteToggle}
          disabled={!connectionState.connected}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        
        <div className="volume-control">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            disabled={isMuted || !connectionState.connected}
            className="volume-slider"
          />
        </div>
      </div>

      <audio
        ref={audioElementRef}
        autoPlay={autoPlay}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default WebRTCAudioPlayer;
