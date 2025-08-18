import React, { useRef, useState, useEffect, useCallback } from 'react';
import './AudioPlayer.css';

interface AudioPlayerProps {
  audioData: string; // base64 encoded audio data
  audioType: 'speaker' | 'mic';
  sampleRate?: number;
  bitsPerSample?: number;
  channels?: number;
  timestamp?: string;
  autoPlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioData,
  audioType,
  sampleRate = 44100,
  bitsPerSample = 16,
  channels = 2,
  timestamp,
  autoPlay = true,
  onPlay,
  onPause,
  onStop
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [audioBuffer, setAudioBuffer] = useState<Float32Array | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Initialize audio context
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Convert base64 to ArrayBuffer
  const base64ToArrayBuffer = useCallback((base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  // Convert raw audio data to Float32Array
  const convertToFloat32Array = useCallback((arrayBuffer: ArrayBuffer): Float32Array => {
    console.log(`AudioPlayer: Converting audio data - bitsPerSample: ${bitsPerSample}, channels: ${channels}, arrayBuffer size: ${arrayBuffer.byteLength}`);
    
    if (bitsPerSample === 16) {
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0; // Convert 16-bit to float
      }
      console.log(`AudioPlayer: Converted 16-bit audio - samples: ${int16Array.length}, max value: ${Math.max(...float32Array.map(Math.abs))}`);
      return float32Array;
    } else if (bitsPerSample === 32) {
      // For 32-bit, check if it's already float or integer
      const uint32Array = new Uint32Array(arrayBuffer);
      const float32Array = new Float32Array(arrayBuffer);
      
      // Check if the data looks like float32 (values between -1 and 1)
      // Use a more efficient approach to avoid stack overflow with large arrays
      let maxAbsValue = 0;
      for (let i = 0; i < Math.min(float32Array.length, 1000); i++) { // Check first 1000 samples
        maxAbsValue = Math.max(maxAbsValue, Math.abs(float32Array[i]));
      }
      console.log(`AudioPlayer: 32-bit audio - max abs value: ${maxAbsValue}, samples: ${float32Array.length}`);
      
      if (maxAbsValue > 1.0) {
        // Likely 32-bit integer, convert to float
        const int32Array = new Int32Array(arrayBuffer);
        const convertedArray = new Float32Array(int32Array.length);
        for (let i = 0; i < int32Array.length; i++) {
          convertedArray[i] = int32Array[i] / 2147483648.0; // Convert 32-bit int to float
        }
        
        // Calculate max value efficiently
        let convertedMax = 0;
        for (let i = 0; i < Math.min(convertedArray.length, 1000); i++) {
          convertedMax = Math.max(convertedMax, Math.abs(convertedArray[i]));
        }
        console.log(`AudioPlayer: Converted 32-bit int to float - max value: ${convertedMax}`);
        return convertedArray;
      } else {
        // Already float32
        console.log(`AudioPlayer: Using 32-bit float as-is - max value: ${maxAbsValue}`);
        return float32Array;
      }
    } else {
      // Default to 16-bit
      const uint8Array = new Uint8Array(arrayBuffer);
      const float32Array = new Float32Array(uint8Array.length);
      for (let i = 0; i < uint8Array.length; i++) {
        float32Array[i] = (uint8Array[i] - 128) / 128.0; // Convert 8-bit to float
      }
      
      // Calculate max value efficiently
      let maxValue = 0;
      for (let i = 0; i < Math.min(float32Array.length, 1000); i++) {
        maxValue = Math.max(maxValue, Math.abs(float32Array[i]));
      }
      console.log(`AudioPlayer: Converted 8-bit audio - samples: ${uint8Array.length}, max value: ${maxValue}`);
      return float32Array;
    }
  }, [bitsPerSample, channels]);

  // Play audio data immediately
  const playAudioData = useCallback(async (audioData: string) => {
    try {
      console.log(`AudioPlayer: Playing ${audioType} audio, size: ${audioData.length}`);
      
      // Initialize audio context if needed
      initializeAudioContext();
      
      if (!audioContextRef.current) {
        console.error('AudioPlayer: No audio context available');
        return;
      }

      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // Check for sample rate mismatch
      if (audioContextRef.current.sampleRate !== sampleRate) {
        console.warn(`AudioPlayer: Sample rate mismatch - context: ${audioContextRef.current.sampleRate}Hz, audio: ${sampleRate}Hz`);
        // This might cause audio distortion, but we'll continue anyway
      }

      // Convert base64 to audio buffer
      const arrayBuffer = base64ToArrayBuffer(audioData);
      
      // Validate array buffer
      if (arrayBuffer.byteLength === 0) {
        console.error('AudioPlayer: Empty array buffer');
        return;
      }
      
      const float32Array = convertToFloat32Array(arrayBuffer);
      
      // Validate float32 array
      if (float32Array.length === 0) {
        console.error('AudioPlayer: Empty float32 array');
        return;
      }
      
      console.log(`AudioPlayer: Creating audio buffer - channels: ${channels}, sampleRate: ${sampleRate}, float32Array length: ${float32Array.length}`);
      
      // Validate audio buffer parameters
      const samplesPerChannel = Math.floor(float32Array.length / channels);
      if (samplesPerChannel <= 0) {
        console.error(`AudioPlayer: Invalid samples per channel: ${samplesPerChannel}`);
        return;
      }
      
      // Create audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(
        channels,
        samplesPerChannel,
        sampleRate
      );
      
      console.log(`AudioPlayer: Audio buffer created - duration: ${audioBuffer.duration}s, length: ${audioBuffer.length}`);
      
      // Skip very short audio buffers that might cause issues
      if (audioBuffer.duration < 0.1) { // Less than 100ms
        console.log(`AudioPlayer: Skipping very short audio buffer (${audioBuffer.duration}s)`);
        return;
      }
      
      // Fill audio buffer with data
      for (let channel = 0; channel < channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          const sampleIndex = i * channels + channel;
          channelData[i] = float32Array[sampleIndex] || 0;
        }
        
        // Debug: Check channel data (efficient calculation)
        let channelMax = 0;
        for (let i = 0; i < Math.min(channelData.length, 1000); i++) {
          channelMax = Math.max(channelMax, Math.abs(channelData[i]));
        }
        console.log(`AudioPlayer: Channel ${channel} - max value: ${channelMax}, samples: ${channelData.length}`);
      }

      // Create source node
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current!);

      // Calculate audio level for visualization (efficient calculation)
      let maxLevel = 0;
      const step = Math.max(1, Math.floor(float32Array.length / 1000)); // Sample every Nth value
      for (let i = 0; i < float32Array.length; i += step) {
        maxLevel = Math.max(maxLevel, Math.abs(float32Array[i]));
      }
      setAudioLevel(maxLevel);

      // Play audio
      source.start(0);
      setIsPlaying(true);
      onPlay?.();

      // Set up cleanup
      source.onended = () => {
        setIsPlaying(false);
        onStop?.();
      };

      console.log(`AudioPlayer: Started playing ${audioType} audio`);
      
    } catch (error) {
      console.error(`AudioPlayer: Error playing ${audioType} audio:`, error);
    }
  }, [audioType, sampleRate, bitsPerSample, channels, initializeAudioContext, base64ToArrayBuffer, convertToFloat32Array, onPlay, onStop]);

  // Auto-play when audio data changes
  useEffect(() => {
    console.log(`AudioPlayer [${audioType}]: audioData changed:`, {
      hasData: !!audioData,
      dataLength: audioData ? audioData.length : 0,
      autoPlay,
      sampleRate,
      bitsPerSample,
      channels
    });
    
    if (audioData && audioData.length > 0 && autoPlay) {
      console.log(`AudioPlayer [${audioType}]: Attempting to play audio data`);
      playAudioData(audioData);
    } else {
      console.log(`AudioPlayer [${audioType}]: Skipping playback - no data or autoPlay disabled`);
    }
  }, [audioData, autoPlay, playAudioData]);

  // Update volume when it changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle mute toggle
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = !isMuted ? 0 : volume;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="audio-player">
      <div className="audio-info">
        <span className={`audio-type ${audioType}`}>{audioType.toUpperCase()}</span>
        <span className="audio-level">
          Level: {(audioLevel * 100).toFixed(1)}%
        </span>
        <span className="audio-status">
          {isPlaying ? 'Playing' : 'Stopped'}
        </span>
      </div>
      
      <div className="audio-controls">
        <button 
          onClick={handleMuteToggle}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
          disabled={!audioData || audioData.length === 0}
        >
          {isMuted ? '🔇 Unmute' : '🔊 Mute'}
        </button>
        
        <div className="volume-control">
          <label>Volume:</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="volume-slider"
            disabled={isMuted}
          />
          <span>{Math.round(volume * 100)}%</span>
        </div>
      </div>
      
      {timestamp && (
        <div className="audio-timestamp">
          {new Date(timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
