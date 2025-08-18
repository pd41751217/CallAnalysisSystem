import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import './WebRTCAudioPlayer.css';

interface WebRTCAudioPlayerProps {
  callId: string;
  audioType: 'speaker' | 'mic';
  autoPlay?: boolean;
  onAudioLevelChange?: (level: number) => void;
}



const WebRTCAudioPlayer: React.FC<WebRTCAudioPlayerProps> = ({
  callId,
  audioType,
  autoPlay = true,
  onAudioLevelChange
}) => {
  const { socket } = useSocket();
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Initialize WebRTC connection
  const initializeWebRTC = useCallback(async () => {
    if (!socket) {
      setError('Socket not connected');
      return;
    }

    try {
      setConnectionStatus('connecting');
      setError(null);

      // Connect to WebRTC server (simplified)
      socket.emit('frontend_client_connect', callId);

      // Request audio stream
      socket.emit('request_audio_stream', { callId });

      // Listen for audio stream info (simplified)
      socket.on('audio_stream_info', (data) => {
        console.log(`Audio stream info received for ${audioType}:`, data);
        
        // Simulate successful connection
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Simulate audio level (for testing)
        const simulateAudioLevel = () => {
          const level = Math.random() * 30 + 5; // 5-35% random level
          setAudioLevel(level);
          onAudioLevelChange?.(level);
          
          // Continue simulation
          setTimeout(simulateAudioLevel, 100);
        };
        
        simulateAudioLevel();
      });

      // Listen for audio stream not available
      socket.on('audio_stream_not_available', (data) => {
        console.log(`Audio stream not available for ${audioType}:`, data);
        setError(`Audio stream not available for ${audioType}`);
        setConnectionStatus('disconnected');
      });

      // Simulate connection success after a short delay
      setTimeout(() => {
        if (connectionStatus === 'connecting') {
          console.log(`Simulating WebRTC connection for ${audioType}`);
          setIsConnected(true);
          setConnectionStatus('connected');
          
          // Simulate audio level
          const simulateAudioLevel = () => {
            const level = Math.random() * 20 + 10; // 10-30% random level
            setAudioLevel(level);
            onAudioLevelChange?.(level);
            
            // Continue simulation
            setTimeout(simulateAudioLevel, 200);
          };
          
          simulateAudioLevel();
        }
      }, 2000);

    } catch (err) {
      console.error(`Failed to initialize WebRTC for ${audioType}:`, err);
      setError(`Failed to initialize WebRTC: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setConnectionStatus('disconnected');
    }
  }, [socket, callId, audioType, autoPlay, connectionStatus, onAudioLevelChange]);



  // Update audio level (simplified - simulated)
  const updateAudioLevel = useCallback(() => {
    // Simulate audio level for demonstration
    const simulatedLevel = Math.random() * 25 + 5; // 5-30% random level
    setAudioLevel(simulatedLevel);
    onAudioLevelChange?.(simulatedLevel);

    // Continue monitoring
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [onAudioLevelChange]);

  // Handle audio play/pause
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => {
        console.error(`Failed to play ${audioType} audio:`, err);
        setError(`Failed to play audio: ${err instanceof Error ? err.message : 'Unknown error'}`);
      });
      setIsPlaying(true);
    }
  }, [isPlaying, audioType]);

  // Handle audio ended
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Handle audio play
  const handleAudioPlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  // Handle audio pause
  const handleAudioPause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeWebRTC();

    return () => {
      // Cleanup
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      // Remove socket listeners
      if (socket) {
        socket.off('audio_stream_info');
        socket.off('audio_stream_not_available');
      }
    };
  }, [initializeWebRTC, socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className={`webrtc-audio-player ${audioType}`}>
      <div className="audio-header">
        <span className="audio-type">{audioType.toUpperCase()}</span>
        <span className={`connection-status ${connectionStatus}`}>
          {connectionStatus}
        </span>
      </div>

      <div className="audio-controls">
        <button 
          className={`play-button ${isPlaying ? 'playing' : ''}`}
          onClick={handlePlayPause}
          disabled={!isConnected}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>

        <div className="audio-level-container">
          <div 
            className="audio-level-bar"
            style={{ width: `${audioLevel}%` }}
          />
          <span className="audio-level-text">{Math.round(audioLevel)}%</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        autoPlay={autoPlay}
        muted={false}
      />

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      <div className="status-info">
        <div>Call ID: {callId}</div>
        <div>Type: {audioType}</div>
        <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
        <div>Playing: {isPlaying ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
};

export default WebRTCAudioPlayer;
