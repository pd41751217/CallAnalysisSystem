import React, { useRef, useState, useEffect, useCallback } from 'react';
import './AudioPlayer.css';

interface AudioPlayerProps {
  audioData?: string; // base64 encoded audio data
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
  sampleRate = 24000,
  bitsPerSample = 16,
  channels = 2,
  // timestamp, // Unused - removed for deployment
  autoPlay = true,
  onPlay
}) => {
  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isStreamingRef = useRef(false);
  const scheduledTimeRef = useRef(0);
  
  // Canvas refs for visualization
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // State
  // const [isPlaying, setIsPlaying] = useState(false); // Unused - removed for deployment
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  // const [audioLevel, setAudioLevel] = useState(0); // Unused - removed for deployment
  const [peakLevel, setPeakLevel] = useState(0);
  // const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(128)); // Unused - removed for deployment
  
  // Prebuffering for gap-free playback
  const prebufferSize = 200; // 0.2 second prebuffer for smoother start
  const prebufferRef = useRef<Float32Array[]>([]);
  const isPrebufferingRef = useRef(true);
  const minQueueSize = 10; // More chunks for smoother start
  const initialDelayMs = 500; // 500ms delay before first playing to build up buffer

  // Initialize Web Audio API
  const initializeAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return;
    }

    try {
      console.log(`AudioPlayer [${audioType}]: Initializing Web Audio API`);
      
      // Create AudioContext
      audioContextRef.current = new AudioContext({
        sampleRate: sampleRate,
        latencyHint: 'interactive'
      });
      
      // Create GainNode for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
      
      // Create AnalyserNode for visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256; // 128 frequency bins
      analyserRef.current.smoothingTimeConstant = 0.8;
      analyserRef.current.minDecibels = -90;
      analyserRef.current.maxDecibels = -10;
      
      // Connect the audio graph
      gainNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      
      console.log(`AudioPlayer [${audioType}]: Web Audio API initialized successfully`);
      
    } catch (error) {
      console.error(`AudioPlayer [${audioType}]: Failed to initialize Web Audio API:`, error);
    }
  }, [audioType, sampleRate, volume, isMuted]);

  // Start visualization
  const startVisualization = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isStreamingRef.current) return;

      // Get frequency data
      analyser.getByteFrequencyData(dataArray);
      // setFrequencyData(new Uint8Array(dataArray)); // Unused - removed for deployment

      // Calculate audio level (RMS) - commented out for deployment
      // let sum = 0;
      // for (let i = 0; i < bufferLength; i++) {
      //   sum += dataArray[i] * dataArray[i];
      // }
      // const rms = Math.sqrt(sum / bufferLength);
      // const level = (rms / 255) * 100; // Convert to percentage - unused
      // setAudioLevel(level); // Unused - removed for deployment

      // Update peak level
      const maxValue = Math.max(...dataArray);
      const peak = (maxValue / 255) * 100;
      setPeakLevel(peak);

      // Draw visualization
      drawVisualization(ctx, dataArray, bufferLength);

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, []);

  // Draw real-time visualization
  const drawVisualization = useCallback((ctx: CanvasRenderingContext2D, dataArray: Uint8Array, bufferLength: number) => {
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw frequency spectrum
    const barWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * height;
      
      // Create gradient based on frequency
      const hue = (i / bufferLength) * 360;
      const gradient = ctx.createLinearGradient(x, height, x, height - barHeight);
      gradient.addColorStop(0, `hsl(${hue}, 70%, 50%)`);
      gradient.addColorStop(1, `hsl(${hue}, 70%, 80%)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
      
      x += barWidth;
    }

    // Draw peak indicator
    if (peakLevel > 0) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(0, height - (peakLevel / 100) * height - 2, width, 2);
    }
  }, [peakLevel]);

  // Add audio to continuous stream with prebuffering
  const addToAudioStream = useCallback((audioData: Float32Array) => {
    if (!audioContextRef.current) {
      console.error('AudioPlayer: AudioContext not available');
      return;
    }

    try {
      console.log(`AudioPlayer [${audioType}]: Adding to stream - samples: ${audioData.length}`);
      
      // Prebuffering logic
      if (isPrebufferingRef.current) {
        prebufferRef.current.push(audioData);
        
        // Calculate total buffered samples
        const totalBufferedSamples = prebufferRef.current.reduce((total, chunk) => total + chunk.length, 0);
        const bufferedDurationMs = (totalBufferedSamples / sampleRate) * 1000;
        
        console.log(`AudioPlayer [${audioType}]: Prebuffering - ${bufferedDurationMs.toFixed(1)}ms buffered`);
        
        // Start playback when we have enough buffer
        if (bufferedDurationMs >= prebufferSize) {
          console.log(`AudioPlayer [${audioType}]: Prebuffer complete, starting playback`);
          isPrebufferingRef.current = false;
          
          // Add all prebuffered data to the main queue
          audioQueueRef.current.push(...prebufferRef.current);
          prebufferRef.current = [];
          
          // Start streaming
          if (!isStreamingRef.current) {
            console.log(`AudioPlayer [${audioType}]: Starting continuous audio stream`);
            isStreamingRef.current = true;
            // setIsPlaying(true); // Unused - removed for deployment
            onPlay?.();
            
            // Initialize continuous streaming; schedule slightly in the future to avoid past starts
            scheduledTimeRef.current = audioContextRef.current.currentTime + 0.02; // 20ms safety lead
            startContinuousStream();
            startVisualization();
          }
        }
      } else {
        // Normal streaming mode - add directly to queue
        audioQueueRef.current.push(audioData);
        
        // Start streaming if not already streaming and we have enough chunks
        if (!isStreamingRef.current && audioQueueRef.current.length >= minQueueSize) {
          console.log(`AudioPlayer [${audioType}]: Starting continuous audio stream with ${audioQueueRef.current.length} chunks`);
          
          // Add initial delay to build up buffer before starting playback
          setTimeout(() => {
            if (isStreamingRef.current || !audioContextRef.current) return; // Already started by another chunk or no context
            
            isStreamingRef.current = true;
            // setIsPlaying(true); // Unused - removed for deployment
            onPlay?.();
            
            // Initialize continuous streaming
            scheduledTimeRef.current = audioContextRef.current.currentTime;
            startContinuousStream();
            startVisualization();
          }, initialDelayMs);
        }
      }
      
    } catch (error) {
      console.error(`AudioPlayer: Error adding to stream:`, error);
    }
  }, [audioType, sampleRate, onPlay, startVisualization]);

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
        setTimeout(() => startContinuousStream(), 1);
      }
    }
  }, [audioType, sampleRate, channels]);

  // Schedule the next audio chunk to play seamlessly
  const scheduleNextChunk = useCallback(() => {
    if (!audioContextRef.current || !isStreamingRef.current) {
      return;
    }
    
    if (audioQueueRef.current.length === 0) {
      // No more chunks, but keep streaming active for future chunks
      if (isStreamingRef.current) {
        // Use immediate scheduling to check for new chunks quickly
        setTimeout(() => scheduleNextChunk(), 1);
      }
      return;
    }

    try {
      const audioData = audioQueueRef.current.shift()!;
      // Reduce logging frequency to avoid spam
      const logCounter = Math.floor(Math.random() * 100);
      if (logCounter === 0) {
        console.log(`AudioPlayer [${audioType}]: Scheduling chunk - samples: ${audioData.length}, scheduled time: ${scheduledTimeRef.current.toFixed(3)}s`);
      }
      
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
      
      // Ensure we don't schedule in the past and maintain continuous flow
      const currentTime = audioContextRef.current.currentTime;
      const startTime = Math.max(scheduledTimeRef.current, currentTime + 0.005); // 5ms safety margin
      
      // Schedule the audio to start at the exact time for seamless playback
      source.start(startTime);
      
      // Update the scheduled time for the next chunk with minimal gap
      scheduledTimeRef.current = startTime + audioBuffer.duration + 0.001; // 1ms overlap to prevent gaps
      
      // Schedule the next chunk immediately for seamless playback
      if (isStreamingRef.current) {
        // Use immediate scheduling to prevent gaps
        scheduleNextChunk();
      }

      console.log(`AudioPlayer [${audioType}]: Scheduled chunk - duration: ${audioBuffer.duration.toFixed(3)}s, next scheduled time: ${scheduledTimeRef.current.toFixed(3)}s`);
      
    } catch (error) {
      console.error(`AudioPlayer: Error scheduling chunk:`, error);
      // Continue scheduling even if there's an error
      if (isStreamingRef.current) {
        setTimeout(() => scheduleNextChunk(), 5);
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
        let maxValue = 0;
        for (let i = 0; i < Math.min(convertedArray.length, 1000); i++) {
          maxValue = Math.max(maxValue, Math.abs(convertedArray[i]));
        }
        console.log(`AudioPlayer: Converted 32-bit int to float - samples: ${int32Array.length}, max value: ${maxValue}`);
        return convertedArray;
      } else {
        // Already float32
        console.log(`AudioPlayer: Already float32 - samples: ${float32Array.length}, max value: ${maxAbsValue}`);
        return float32Array;
      }
    } else {
      throw new Error(`Unsupported bits per sample: ${bitsPerSample}`);
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
      // Do NOT reset prebuffer on each new chunk; keep accumulating until threshold
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="audio-player">
      {/* Real-time Audio Visualization */}
      <div className="visualization-container">
        <canvas
          ref={canvasRef}
          width={300}
          height={100}
          className="audio-visualization"
        />
      </div>
      
      <div className="audio-controls">
        <button 
          onClick={handleMuteToggle}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        
        <div className="volume-control">
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
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;


