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
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioData,
  audioType,
  sampleRate = 44100,
  bitsPerSample = 16,
  channels = 2,
  timestamp,
  autoPlay = true,
  onPlay
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Continuous audio streaming without gaps
  const isPlayingRef = useRef(false);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isStreamingRef = useRef(false);
  const audioContextTimeRef = useRef(0);
  const scheduledTimeRef = useRef(0);

  // Initialize audio context
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
        gainNodeRef.current.gain.value = isMuted ? 0 : volume;
        console.log(`AudioPlayer: AudioContext initialized - state: ${audioContextRef.current.state}`);
      } catch (error) {
        console.error('AudioPlayer: Failed to initialize AudioContext:', error);
      }
    }
  }, [volume, isMuted]);

  // Add audio to continuous stream without gaps
  const addToAudioStream = useCallback((audioData: Float32Array) => {
    if (!audioContextRef.current) {
      console.error('AudioPlayer: AudioContext not available');
      return;
    }

    try {
      console.log(`AudioPlayer [${audioType}]: Adding to continuous stream - samples: ${audioData.length}`);
      
      // Add audio data to queue
      audioQueueRef.current.push(audioData);
      
      // Calculate audio level
      let maxLevel = 0;
      for (let i = 0; i < Math.min(audioData.length, 1000); i++) {
        maxLevel = Math.max(maxLevel, Math.abs(audioData[i]));
      }
      setAudioLevel(maxLevel);
      
      // Start continuous streaming if not already streaming
      if (!isStreamingRef.current) {
        console.log(`AudioPlayer [${audioType}]: Starting continuous audio stream without gaps`);
        isStreamingRef.current = true;
        setIsPlaying(true);
        isPlayingRef.current = true;
        onPlay?.();
        
        // Initialize continuous streaming
        audioContextTimeRef.current = audioContextRef.current.currentTime;
        scheduledTimeRef.current = audioContextRef.current.currentTime;
        startContinuousStream();
      }
      
    } catch (error) {
      console.error(`AudioPlayer: Error adding to stream:`, error);
    }
  }, [audioType, onPlay]);

  // Start continuous audio streaming without gaps
  const startContinuousStream = useCallback(() => {
    if (!audioContextRef.current || !isStreamingRef.current) {
      return;
    }

    try {
      // Schedule the next chunk to play seamlessly
      scheduleNextChunk();
    } catch (error) {
      console.error(`AudioPlayer: Error in continuous stream:`, error);
      // Continue streaming even if there's an error
      if (isStreamingRef.current) {
        setTimeout(() => startContinuousStream(), 10);
      }
    }
  }, [audioType, sampleRate, channels]);

  // Schedule the next audio chunk to play seamlessly
  const scheduleNextChunk = useCallback(() => {
    if (!audioContextRef.current || !isStreamingRef.current || audioQueueRef.current.length === 0) {
      // No more chunks, but keep streaming active for future chunks
      if (isStreamingRef.current) {
        setTimeout(() => scheduleNextChunk(), 10);
      }
      return;
    }

    try {
      const audioData = audioQueueRef.current.shift()!;
      console.log(`AudioPlayer [${audioType}]: Scheduling chunk - samples: ${audioData.length}, scheduled time: ${scheduledTimeRef.current.toFixed(3)}s`);
      
      // Create audio buffer
      const audioBuffer = audioContextRef.current.createBuffer(channels, audioData.length, sampleRate);
      
      // Fill audio buffer with data
      for (let channel = 0; channel < channels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        if (channels === 1) {
          // Mono: use the same data for all channels
          channelData.set(audioData);
        } else {
          // Stereo: interleave the data
          for (let i = 0; i < audioData.length / channels; i++) {
            channelData[i] = audioData[i * channels + channel];
          }
        }
      }
      
      // Create source node
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current!);
      
      // Schedule the audio to start at the exact time for seamless playback
      source.start(scheduledTimeRef.current);
      
      // Update the scheduled time for the next chunk
      scheduledTimeRef.current += audioBuffer.duration;
      
      // Schedule the next chunk immediately
      setTimeout(() => {
        if (isStreamingRef.current) {
          scheduleNextChunk();
        }
      }, 0);

      console.log(`AudioPlayer [${audioType}]: Scheduled chunk - duration: ${audioBuffer.duration.toFixed(3)}s, next scheduled time: ${scheduledTimeRef.current.toFixed(3)}s`);
      
    } catch (error) {
      console.error(`AudioPlayer: Error scheduling chunk:`, error);
      // Continue scheduling even if there's an error
      if (isStreamingRef.current) {
        setTimeout(() => scheduleNextChunk(), 10);
      }
    }
  }, [audioType, sampleRate, channels]);



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

  // Play audio data immediately without buffering
  const playAudioData = useCallback(async (audioData: string) => {
    try {
      console.log(`AudioPlayer: Processing ${audioType} audio, size: ${audioData.length}`);
      
      // Initialize audio context if needed
      initializeAudioContext();
      
      // Ensure AudioContext is running
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log('AudioPlayer: Resuming suspended AudioContext');
        await audioContextRef.current.resume();
      }
      
      if (!audioContextRef.current) {
        console.error('AudioPlayer: AudioContext not available');
        return;
      }

      // Convert base64 to ArrayBuffer
      const arrayBuffer = base64ToArrayBuffer(audioData);
      
      if (arrayBuffer.byteLength === 0) {
        console.warn('AudioPlayer: Empty audio buffer received');
        return;
      }

      // Convert to Float32Array
      const float32Array = convertToFloat32Array(arrayBuffer);
      
      if (float32Array.length === 0) {
        console.warn('AudioPlayer: Empty Float32Array after conversion');
          return;
      }

      // Validate audio parameters
      const samplesPerChannel = float32Array.length / channels;
      if (samplesPerChannel <= 0) {
        console.error(`AudioPlayer: Invalid samples per channel: ${samplesPerChannel}`);
        return;
      }

      // Check for sample rate mismatch
      if (audioContextRef.current.sampleRate !== sampleRate) {
        console.warn(`AudioPlayer: Sample rate mismatch - Context: ${audioContextRef.current.sampleRate}, Audio: ${sampleRate}`);
      }

      // Add to continuous audio stream
      addToAudioStream(float32Array);

    } catch (error) {
      console.error(`AudioPlayer: Error processing ${audioType} audio:`, error);
    }
  }, [audioType, sampleRate, bitsPerSample, channels, initializeAudioContext, base64ToArrayBuffer, convertToFloat32Array, addToAudioStream]);

  // Initialize AudioContext on mount (browser security requirement)
  useEffect(() => {
    const initAudio = async () => {
      try {
        initializeAudioContext();
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          console.log(`AudioPlayer [${audioType}]: Starting AudioContext on mount`);
          await audioContextRef.current.resume();
        }
      } catch (error) {
        console.error(`AudioPlayer [${audioType}]: Failed to initialize AudioContext:`, error);
      }
    };
    
    initAudio();
  }, [audioType, initializeAudioContext]);

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
          {isPlaying ? 'Continuous Streaming' : 'Starting Stream'}
        </span>
        <span className="buffer-status">
          Gap-Free Audio
        </span>
      </div>
      
      <div className="audio-controls">
        <button 
          onClick={handleMuteToggle}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
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

