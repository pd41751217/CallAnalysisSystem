import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, IconButton, Slider, Chip } from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  VolumeUp as VolumeIcon,
  Mic as MicIcon,
  Speaker as SpeakerIcon
} from '@mui/icons-material';

interface AudioPlayerProps {
  audioData: string; // Base64 encoded audio data
  audioType: 'speaker' | 'mic';
  sampleRate: number;
  bitsPerSample: number;
  channels: number;
  timestamp: string;
  autoPlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioData,
  audioType,
  sampleRate,
  bitsPerSample,
  channels,
  timestamp,
  autoPlay = false,
  onPlay,
  onPause,
  onStop
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  // Initialize audio context
  const initializeAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
  }, []);

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
  const convertToFloat32Array = useCallback((arrayBuffer: ArrayBuffer, bitsPerSample: number): Float32Array => {
    console.log(`AudioPlayer: Converting audio data - bitsPerSample: ${bitsPerSample}, buffer size: ${arrayBuffer.byteLength}`);
    
    if (bitsPerSample === 32) {
      // Try 32-bit float first (more common in modern audio)
      try {
        const float32Data = new Float32Array(arrayBuffer);
        console.log(`AudioPlayer: Using 32-bit float conversion, first 4 values:`, Array.from(float32Data.slice(0, 4)));
        return float32Data;
      } catch (error) {
        console.log(`AudioPlayer: 32-bit float failed, trying integer conversion`);
        // Fallback to 32-bit integer data (common in WASAPI)
        const int32Data = new Int32Array(arrayBuffer);
        const floatData = new Float32Array(int32Data.length);
        for (let i = 0; i < int32Data.length; i++) {
          // Use 2^31 - 1 for proper normalization
          floatData[i] = int32Data[i] / 2147483647.0;
        }
        console.log(`AudioPlayer: Using 32-bit integer conversion, first 4 values:`, Array.from(floatData.slice(0, 4)));
        return floatData;
      }
    } else if (bitsPerSample === 16) {
      // 16-bit PCM data
      const pcmData = new Int16Array(arrayBuffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768.0;
      }
      return floatData;
    } else {
      // 8-bit PCM data
      const pcmData = new Uint8Array(arrayBuffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = (pcmData[i] - 128) / 128.0;
      }
      return floatData;
    }
  }, []);

  // Create audio buffer from data
  const createAudioBuffer = useCallback(async (audioData: string) => {
    try {
      initializeAudioContext();
      
      const audioContext = audioContextRef.current;
      if (!audioContext) return null;

      const arrayBuffer = base64ToArrayBuffer(audioData);
      console.log(`AudioPlayer: Processing ${audioType} audio - buffer size: ${arrayBuffer.byteLength}, bitsPerSample: ${bitsPerSample}, channels: ${channels}, sampleRate: ${sampleRate}`);
      
      // Always log first few bytes to debug the issue
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log(`AudioPlayer: First 16 bytes:`, Array.from(uint8Array.slice(0, 16)));
      
      const floatData = convertToFloat32Array(arrayBuffer, bitsPerSample);
      
      // Debug: Check if audio data is all zeros
      let allZeros = true;
      for (let i = 0; i < Math.min(floatData.length, 100); i++) {
        if (Math.abs(floatData[i]) > 0.001) {
          allZeros = false;
          break;
        }
      }
      
      if (allZeros) {
        console.warn(`AudioPlayer: ${audioType} audio data appears to be all zeros or very quiet`);
        // Generate a test tone for debugging if audio is all zeros
        if (audioType === 'speaker') {
          console.log(`AudioPlayer: Generating frontend test tone for ${audioType} audio`);
          const duration = 0.1; // 100ms
          const frequency = 440; // A4 note
          const amplitude = 0.3;
          const numSamples = Math.floor(sampleRate * duration);
          
          for (let i = 0; i < numSamples; i++) {
            floatData[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
          }
          console.log(`AudioPlayer: Generated test tone with amplitude: ${amplitude}, sampleRate: ${sampleRate}`);
        }
      } else {
        const maxAmplitude = Math.max(...floatData.map(Math.abs));
        console.log(`AudioPlayer: ${audioType} audio data contains non-zero values, max amplitude: ${maxAmplitude}`);
      }
      
      // Amplify audio if it's too quiet
      const maxAmplitude = Math.max(...floatData.map(Math.abs));
      let amplificationFactor = 1.0;
      
      console.log(`AudioPlayer: ${audioType} max amplitude before amplification: ${maxAmplitude}`);
      
      if (maxAmplitude < 0.1) {
        // Audio is quiet, amplify it
        amplificationFactor = 10.0; // Amplify by 10x
        console.log(`AudioPlayer: ${audioType} audio is quiet (max amplitude: ${maxAmplitude}), amplifying by ${amplificationFactor}x`);
        
        for (let i = 0; i < floatData.length; i++) {
          floatData[i] *= amplificationFactor;
          // Prevent clipping
          if (floatData[i] > 1.0) floatData[i] = 1.0;
          if (floatData[i] < -1.0) floatData[i] = -1.0;
        }
        
        const newMaxAmplitude = Math.max(...floatData.map(Math.abs));
        console.log(`AudioPlayer: ${audioType} max amplitude after amplification: ${newMaxAmplitude}`);
      }
      
      // Calculate audio level (RMS for better representation)
      let sumSquares = 0;
      for (let i = 0; i < floatData.length; i++) {
        sumSquares += floatData[i] * floatData[i];
      }
      const rms = Math.sqrt(sumSquares / floatData.length);
      setAudioLevel(rms);
      
      console.log(`AudioPlayer: ${audioType} audio level (RMS): ${(rms * 100).toFixed(1)}% after amplification`);

      // Create audio buffer - use actual sample rate from audio data
      // Validate sample rate to prevent issues
      const validSampleRate = (sampleRate >= 8000 && sampleRate <= 192000) ? sampleRate : 48000;
      if (sampleRate !== validSampleRate) {
        console.warn(`AudioPlayer: Invalid sample rate ${sampleRate}Hz, using ${validSampleRate}Hz`);
      } else {
        console.log(`AudioPlayer: Using sample rate from audio data: ${sampleRate}Hz`);
      }
      
      // Check if we need to resample audio for better playback
      let finalSampleRate = validSampleRate;
      if (validSampleRate > 44100) {
        // If sample rate is too high, use 44.1kHz for better compatibility
        finalSampleRate = 44100;
        console.log(`AudioPlayer: Resampling from ${validSampleRate}Hz to ${finalSampleRate}Hz for better compatibility`);
      }
      
      console.log(`AudioPlayer: Creating audio buffer - channels: ${channels}, samples: ${floatData.length / channels}, sampleRate: ${finalSampleRate}`);
      
      const audioBuffer = audioContext.createBuffer(
        channels,
        floatData.length / channels,
        finalSampleRate
      );

      // Fill audio buffer with data - simplified approach
      console.log(`AudioPlayer: Filling audio buffer - channels: ${channels}, floatData length: ${floatData.length}`);
      
      if (channels === 1) {
        // Mono audio - copy directly
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < channelData.length; i++) {
          channelData[i] = floatData[i];
        }
        console.log(`AudioPlayer: Filled mono channel with ${channelData.length} samples`);
      } else {
        // Stereo audio - copy same data to both channels for now
        for (let channel = 0; channel < channels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          for (let i = 0; i < channelData.length; i++) {
            channelData[i] = floatData[i];
          }
        }
        console.log(`AudioPlayer: Filled ${channels} stereo channels with ${audioBuffer.getChannelData(0).length} samples each`);
      }

      audioBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);

      return audioBuffer;
    } catch (error) {
      console.error('Error creating audio buffer:', error);
      return null;
    }
  }, [audioData, bitsPerSample, channels, sampleRate, initializeAudioContext, base64ToArrayBuffer, convertToFloat32Array]);

  // Play audio
  const playAudio = useCallback(async () => {
    try {
      console.log(`AudioPlayer: playAudio called for ${audioType} - data length: ${audioData.length}`);
      
      if (!audioContextRef.current || !audioBufferRef.current) {
        console.log(`AudioPlayer: Creating new audio buffer for ${audioType}`);
        const audioBuffer = await createAudioBuffer(audioData);
        if (!audioBuffer) {
          console.error(`AudioPlayer: Failed to create audio buffer for ${audioType}`);
          return;
        }
      }

      const audioContext = audioContextRef.current;
      if (!audioContext) {
        console.error(`AudioPlayer: No audio context available for ${audioType}`);
        return;
      }

      if (audioContext.state === 'closed') {
        console.log(`AudioPlayer: Audio context is closed, creating new one for ${audioType}`);
        // Create a new audio context if the current one is closed
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainNodeRef.current = audioContextRef.current.createGain();
        gainNodeRef.current.connect(audioContextRef.current.destination);
        return; // Retry on next audio data
      } else if (audioContext.state === 'suspended') {
        console.log(`AudioPlayer: Resuming suspended audio context for ${audioType}`);
        await audioContext.resume();
      }

      // Stop any currently playing audio
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }

      // Create new source node
      sourceNodeRef.current = audioContext.createBufferSource();
      sourceNodeRef.current.buffer = audioBufferRef.current;
      sourceNodeRef.current.connect(gainNodeRef.current!);

      // Set volume
      gainNodeRef.current!.gain.value = volume;

      // Set up event handlers
      sourceNodeRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onStop?.();
      };

      // Start playing
      sourceNodeRef.current.start(0);
      setIsPlaying(true);
      onPlay?.();

      // Update current time
      const startTime = audioContext.currentTime;
      const updateTime = () => {
        if (sourceNodeRef.current && isPlaying) {
          const elapsed = audioContext.currentTime - startTime;
          setCurrentTime(Math.min(elapsed, duration));
          if (elapsed < duration) {
            requestAnimationFrame(updateTime);
          }
        }
      };
      updateTime();

    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [audioData, volume, duration, isPlaying, onPlay, onStop, createAudioBuffer]);

  // Pause audio
  const pauseAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    onPause?.();
  }, [onPause]);

  // Stop audio
  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    onStop?.();
  }, [onStop]);

  // Handle volume change
  const handleVolumeChange = useCallback((event: Event, newValue: number | number[]) => {
    const newVolume = newValue as number;
    setVolume(newVolume);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume;
    }
  }, []);

  // Auto-play when new audio data arrives
  useEffect(() => {
    if (autoPlay && audioData) {
      // Reduce console spam - only log occasionally
      const logCount = Math.floor(Math.random() * 10);
      if (logCount === 0) {
        console.log(`AudioPlayer: Auto-play triggered for ${audioType} audio (data length: ${audioData.length})`);
      }
      playAudio();
    }
  }, [audioData, autoPlay, playAudio, audioType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      // Don't close the audio context - let it be reused
      // if (audioContextRef.current) {
      //   audioContextRef.current.close();
      // }
    };
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getAudioTypeIcon = () => {
    return audioType === 'mic' ? <MicIcon /> : <SpeakerIcon />;
  };

  const getAudioTypeColor = () => {
    return audioType === 'mic' ? 'primary' : 'secondary';
  };

  return (
    <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Chip
          icon={getAudioTypeIcon()}
          label={audioType.toUpperCase()}
          color={getAudioTypeColor()}
          size="small"
          sx={{ mr: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ mr: 1 }}>
            Level: {(audioLevel * 100).toFixed(1)}%
          </Typography>
          <Box
            sx={{
              width: 50,
              height: 8,
              bgcolor: 'grey.300',
              borderRadius: 1,
              overflow: 'hidden'
            }}
          >
            <Box
              sx={{
                width: `${audioLevel * 100}%`,
                height: '100%',
                bgcolor: audioLevel > 0.5 ? 'error.main' : 'success.main',
                transition: 'width 0.1s ease'
              }}
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton
          onClick={isPlaying ? pauseAudio : playAudio}
          color="primary"
          size="small"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </IconButton>
        <IconButton onClick={stopAudio} color="secondary" size="small">
          <StopIcon />
        </IconButton>
        
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 2, flex: 1 }}>
          <VolumeIcon sx={{ mr: 1, fontSize: 16 }} />
          <Slider
            value={volume}
            onChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.01}
            size="small"
            sx={{ width: 100 }}
          />
        </Box>
      </Box>

      <Slider
        value={currentTime}
        max={duration}
        step={0.01}
        size="small"
        disabled
        sx={{ width: '100%' }}
      />

      <Typography variant="caption" color="text.secondary">
        {new Date(timestamp).toLocaleTimeString()} | 
        {sampleRate}Hz, {bitsPerSample}bit, {channels}ch
      </Typography>
    </Box>
  );
};

export default AudioPlayer;
