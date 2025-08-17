import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,

  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  People as PeopleIcon,
  Phone as PhoneIcon,

  Schedule as ScheduleIcon,
  Circle as CircleIcon,
  Visibility as VisibilityIcon,
  Call as CallIcon,
  Person as PersonIcon,

  Stop as StopIcon,
  VolumeUp as VolumeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services';
import type { DashboardUser, ActiveCall, DashboardMetrics } from '../../services';
import { useSocket } from '../../contexts/SocketContext';

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monitoringCall, setMonitoringCall] = useState<string | null>(null);
  const [monitoringDialog, setMonitoringDialog] = useState(false);
  const [audioStream, setAudioStream] = useState<EventSource | null>(null);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing' | 'error'>('idle');
  const [sseConnected, setSseConnected] = useState(false);
  const processedEventsRef = useRef<Set<string>>(new Set());
  const [dashboardConnected, setDashboardConnected] = useState(false);
  const { user } = useAuth();
  const { socket, isConnected: socketConnected } = useSocket();
  const navigate = useNavigate();

  // Setup Socket.IO dashboard connection
  useEffect(() => {
    if (socket && socketConnected) {
      // Join dashboard room
      socket.emit('join_dashboard');
      
      // Listen for dashboard updates
      socket.on('dashboard_update', (event) => {
        console.log('Dashboard update received:', event);
        
        // Create unique event ID to prevent duplicates
        const eventId = `${event.type}_${event.timestamp}_${event.data?.user?.id || event.data?.call?.id || JSON.stringify(event.data)}`;
        
        // Skip if event already processed
        if (processedEventsRef.current.has(eventId)) {
          console.log('Skipping duplicate event:', event.type, eventId);
          return;
        }
        
        // Mark event as processed
        processedEventsRef.current.add(eventId);
        console.log('Processing new event:', event.type, eventId);
        
        switch (event.type) {
          case 'user_logged_in':
            console.log('user_logged_in event received:', event.data);
            handleUserLoggedIn(event.data);
            break;
          case 'user_logged_out':
            console.log('user_logged_out event received:', event.data);
            handleUserLoggedOut(event.data);
            break;
          case 'call_started':
            console.log('call_started event received:', event.data);
            handleCallStarted(event.data);
            break;
          case 'user_status_update':
            console.log('user_status_update event received:', event.data);
            handleUserStatusUpdate(event.data);
            break;
          case 'call_ended':
            console.log('call_ended event received:', event.data);
            console.log('Call ended data structure:', JSON.stringify(event.data, null, 2));
            handleCallEnded(event.data);
            break;
          case 'sentiment_update':
            console.log('sentiment_update event received:', event.data);
            handleSentimentUpdate(event.data);
            break;
          default:
            console.log('Unknown dashboard event:', event);
        }
      });
      
      // Listen for dashboard connection confirmation
      socket.on('dashboard_connected', (data) => {
        console.log('Dashboard connected:', data);
        setDashboardConnected(true);
        setSseConnected(true);
      });
      
      // Listen for dashboard disconnection
      socket.on('dashboard_disconnected', (data) => {
        console.log('Dashboard disconnected:', data);
        setDashboardConnected(false);
        setSseConnected(false);
      });
      
      // Cleanup function
      return () => {
        socket.emit('leave_dashboard');
        socket.off('dashboard_update');
        socket.off('dashboard_connected');
        socket.off('dashboard_disconnected');
        // Clear processed events on cleanup
        processedEventsRef.current.clear();
      };
    }
  }, [socket, socketConnected]);

  // Log socket connection status
  useEffect(() => {
    console.log('Dashboard: Socket connection status:', socketConnected);
    if (socket) {
      console.log('Dashboard: Socket ID:', socket.id);
    }
  }, [socketConnected, socket]);

  useEffect(() => {
    fetchDashboardData();
    
    console.log('Dashboard data loaded');
    
    // Fallback: Show dashboard after 5 seconds if Socket.IO doesn't connect
    const fallbackTimeout = setTimeout(() => {
      if (!dashboardConnected) {
        console.log('Socket.IO timeout, showing dashboard anyway');
        setSseConnected(true);
      }
      }, 5000);

    return () => {
      console.log('Cleaning up dashboard connection');
      clearTimeout(fallbackTimeout);
      // Clean up audio stream
      if (audioStream) {
        audioStream.close();
      }
      // Clean up processed events (keep only last 100)
      const eventsArray = Array.from(processedEventsRef.current);
      if (eventsArray.length > 100) {
        processedEventsRef.current = new Set(eventsArray.slice(-100));
      }
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch dashboard data using the service
      const dashboardData = await dashboardService.getDashboardData();
      
      // Update metrics
      const dashboardMetrics: DashboardMetrics = {
        totalUsers: dashboardData.users.totalUsers,
        onlineUsers: dashboardData.users.onlineUsers,
        offlineUsers: dashboardData.users.offlineUsers,
        callingUsers: dashboardData.users.callingUsers,
        liveCalls: dashboardData.calls.totalActive
      };

      console.log('Loaded users from API:', dashboardData.users.users);
      console.log('Loaded active calls from API:', dashboardData.calls.activeCalls);
      setMetrics(dashboardMetrics);
      setUsers(dashboardData.users.users);
      setActiveCalls(dashboardData.calls.activeCalls || []);
      
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserLoggedIn = (data: { user: any }) => {
    setUsers(prev => {
      const existingUserIndex = prev.findIndex(u => u.id === data.user.id.toString());
      if (existingUserIndex >= 0) {
        // Update existing user
        const updatedUsers = [...prev];
        const oldStatus = updatedUsers[existingUserIndex].status;
        updatedUsers[existingUserIndex] = {
          ...updatedUsers[existingUserIndex],
          status: 'online',
          lastActive: data.user.last_login || new Date().toISOString()
        };
        
        // Update metrics only if status changed
        setMetrics(prev => {
          if (!prev) return prev;
          let newMetrics = { ...prev };
          
          if (oldStatus === 'offline') {
            newMetrics.onlineUsers = newMetrics.onlineUsers + 1;
            newMetrics.offlineUsers = Math.max(0, newMetrics.offlineUsers - 1);
          } else if (oldStatus === 'calling') {
            newMetrics.onlineUsers = newMetrics.onlineUsers + 1;
            newMetrics.callingUsers = Math.max(0, newMetrics.callingUsers - 1);
          }
          // If already online, no change needed
          
          return newMetrics;
        });
        
        return updatedUsers;
      } else {
        // Add new user
        const newUser: DashboardUser = {
          id: data.user.id.toString(),
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          team: data.user.team,
          status: 'online' as const,
          lastActive: data.user.last_login || new Date().toISOString()
        };
    
        // Update metrics for new user
    setMetrics(prev => prev ? { 
      ...prev, 
      onlineUsers: prev.onlineUsers + 1,
          totalUsers: prev.totalUsers + 1
    } : null);
        
        return [...prev, newUser];
      }
    });
  };

  const handleUserLoggedOut = (data: { user: any }) => {
    setUsers(prev => prev.map(user => 
      user.id === data.user.id.toString() 
        ? { ...user, status: 'offline' }
        : user
    ));
    
    // Update metrics
    setMetrics(prev => prev ? { 
      ...prev, 
      onlineUsers: Math.max(0, prev.onlineUsers - 1),
      offlineUsers: prev.offlineUsers + 1
    } : null);
  };

  const handleUserStatusUpdate = (data: { user: { id: number; name: string; email: string; role: string; team: string; status: string } }) => {
    console.log('handleUserStatusUpdate called with:', data);
    setUsers(prev => {
      const updatedUsers = prev.map(user => 
        user.id === data.user.id.toString() 
          ? { ...user, status: data.user.status as 'online' | 'offline' | 'calling' }
        : user
      );
      
      return updatedUsers;
    });
    
    // Update metrics based on the status change
    setMetrics(prev => {
      if (!prev) return prev;
      
      // Find the user in the current users state to get their old status
      const currentUser = users.find(u => u.id === data.user.id.toString());
      const oldStatus = currentUser?.status || 'offline';
      const newStatus = data.user.status;
      
      let newMetrics = { ...prev };
      
      // Decrease count for old status
      if (oldStatus === 'online') newMetrics.onlineUsers = Math.max(0, newMetrics.onlineUsers - 1);
      else if (oldStatus === 'calling') newMetrics.callingUsers = Math.max(0, newMetrics.callingUsers - 1);
      else if (oldStatus === 'offline') newMetrics.offlineUsers = Math.max(0, newMetrics.offlineUsers - 1);
      
      // Increase count for new status
      if (newStatus === 'online') newMetrics.onlineUsers = newMetrics.onlineUsers + 1;
      else if (newStatus === 'calling') newMetrics.callingUsers = newMetrics.callingUsers + 1;
      else if (newStatus === 'offline') newMetrics.offlineUsers = newMetrics.offlineUsers + 1;
      
      return newMetrics;
    });
  };

  const handleCallStarted = (data: { call: any; user: any }) => {
    console.log('handleCallStarted called with:', data);
    
    // Update user status to 'calling' only if not already calling
    setUsers(prev => {
      const updatedUsers = prev.map(user => {
        if (user.id === data.user.id.toString()) {
          const oldStatus = user.status;
          
          // Only update if not already calling
          if (oldStatus !== 'calling') {
            // Update metrics for status change
            setMetrics(prevMetrics => {
              if (!prevMetrics) return prevMetrics;
              
              let newMetrics = { ...prevMetrics };
              
              // Decrease count for old status
              if (oldStatus === 'online') newMetrics.onlineUsers = Math.max(0, newMetrics.onlineUsers - 1);
              else if (oldStatus === 'offline') newMetrics.offlineUsers = Math.max(0, newMetrics.offlineUsers - 1);
              else if (oldStatus === 'calling') {
                return prevMetrics; // Don't update if already calling
              }
              
              // Increase count for calling status
              newMetrics.callingUsers = newMetrics.callingUsers + 1;
              newMetrics.liveCalls = newMetrics.liveCalls + 1;
              
              return newMetrics;
            });
            
            return { ...user, status: 'calling' as const };
          }
        }
        return user;
      });
      
      return updatedUsers;
    });
    

    
    // Check if call already exists
    setActiveCalls(prev => {
      const callExists = prev.some(call => call.id === data.call.id);
      if (callExists) {
        console.log('Call already exists, skipping:', data.call.id);
        return prev; // Call already exists, don't add again
      }
      
      console.log('Adding new call:', data.call.id);
      // Add new call
      const newCall: ActiveCall = {
        id: data.call.id,
        user_id: data.call.user_id.toString(),
        agentName: data.user.name,
        agentEmail: data.user.email,
        customerNumber: data.call.customer_number || 'Unknown',
        startTime: data.call.start_time,
        duration: '0',
        status: 'active'
      };
      
      return [...prev, newCall];
    });
    
  };

  const handleCallEnded = (data: { call: any; user: any }) => {
    console.log('handleCallEnded called with:', data);
    
    // Check if call exists before removing
    setActiveCalls(prev => {
      console.log('Current active calls:', prev);
      console.log('Looking for call with ID:', data.call.id, 'Type:', typeof data.call.id);
      console.log('Active call IDs:', prev.map(call => ({ id: call.id, type: typeof call.id })));
      const callExists = prev.some(call => call.id === data.call.id);
      if (!callExists) {
        console.log('Call not found in active calls, nothing to remove');
        return prev; // Call doesn't exist, nothing to remove
      }
      console.log('Removing call from active calls:', data.call.id);
      return prev.filter(call => call.id !== data.call.id);
    });
    
    // Update user status to 'online' only if currently calling
    setUsers(prev => {
      console.log('Current users:', prev);
      console.log('Looking for user with ID:', data.user.id.toString());
      const updatedUsers = prev.map(user => {
        if (user.id === data.user.id.toString()) {
          console.log('Found user:', user.name, 'Current status:', user.status);
          const oldStatus = user.status;
          // Only update if currently calling
          if (oldStatus === 'calling') {
            console.log('Updating user status from calling to online');
            // Update metrics for status change
            setMetrics(prevMetrics => {
              if (!prevMetrics) return prevMetrics;
              
              let newMetrics = { ...prevMetrics };
              
              // Decrease count for calling status
              newMetrics.callingUsers = Math.max(0, newMetrics.callingUsers - 1);
              newMetrics.liveCalls = Math.max(0, newMetrics.liveCalls - 1);
              
              // Increase count for online status
              newMetrics.onlineUsers = newMetrics.onlineUsers + 1;
              
              console.log('Updated metrics:', newMetrics);
              return newMetrics;
            });
            
            return { ...user, status: 'online' as const };
          }
        }
        return user;
      });
      
      return updatedUsers;
    });
  };

  const handleSentimentUpdate = (data: { callId: string; sentiment: string }) => {
    setActiveCalls(prev => prev.map(call => 
      call.id === data.callId 
        ? { ...call, sentiment: data.sentiment as 'positive' | 'negative' | 'neutral' }
        : call
    ));
  };

  const handleShowCall = async (callId: string) => {
    if (!user || user.role !== 'admin') {
      alert('Only administrators can monitor calls.');
      return;
    }

    setMonitoringCall(callId);
    setMonitoringDialog(true);

    // Initialize audio context on user interaction (required by browsers)
    try {
      if (!audioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('AudioContext created on user interaction:', ctx.state);
        setAudioContext(ctx);
        audioContextRef.current = ctx;
      }
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
    }

    try {
      // Use Socket.IO for real-time audio streaming
      if (socket && socket.connected) {
        // Join the call monitoring room
        socket.emit('join_call_monitoring', { callId });
        
        // Listen for audio data
        socket.on(`call_audio_${callId}`, (data) => {
          console.log('Audio data received:', data);
          console.log('Audio data size:', data.audioData ? data.audioData.length : 0);
          console.log('Audio type:', data.audioType);
          console.log('Call ID:', data.callId);
          console.log('User ID:', data.userId);
          console.log('Audio format:', {
            sampleRate: data.sampleRate,
            bitsPerSample: data.bitsPerSample,
            channels: data.channels
          });
          
          if (data.type === 'audio_data' && data.audioData) {
            // Convert base64 audio data to audio buffer and play
            playAudioData(data.audioData, data.audioType, data.sampleRate, data.bitsPerSample, data.channels);
          } else {
            console.warn('Invalid audio data received:', data);
          }
        });

        // Listen for call info updates
        socket.on(`call_info_${callId}`, (data) => {
          console.log('Call info update:', data);
        });

        console.log('Started monitoring call:', callId);
      } else {
        throw new Error('Socket.IO not connected');
      }

    } catch (error) {
      console.error('Failed to start call monitoring:', error);
      alert('Failed to start call monitoring. Please try again.');
      setMonitoringDialog(false);
      setMonitoringCall(null);
    }
  };

  // Audio context for real-time playback
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioQueue, setAudioQueue] = useState<{ data: Float32Array; timestamp: number }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync audio context ref
  useEffect(() => {
    audioContextRef.current = audioContext;
  }, [audioContext]);

  const playAudioData = async (audioData: string, audioType: string, sampleRate: number = 44100, bitsPerSample: number = 16, channels: number = 2) => {
    try {
      setAudioStatus('playing');
      
      // Convert base64 audio data to ArrayBuffer
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert raw audio data to Float32Array for Web Audio API
      // Handle both 16-bit PCM and 32-bit float formats
      let floatData: Float32Array;
      let maxAmplitude = 0;
      let minAmplitude = 0;
      let nonZeroSamples = 0;
      
      if (bitsPerSample === 32) {
        // 32-bit float data (already in correct format)
        const float32Data = new Float32Array(bytes.buffer);
        floatData = new Float32Array(float32Data.length);
        
        for (let i = 0; i < float32Data.length; i++) {
          floatData[i] = float32Data[i];
          if (floatData[i] !== 0) {
            nonZeroSamples++;
            maxAmplitude = Math.max(maxAmplitude, Math.abs(floatData[i]));
            minAmplitude = Math.min(minAmplitude, -Math.abs(floatData[i]));
          }
        }
      } else {
        // 16-bit PCM data (convert to float)
        const pcmData = new Int16Array(bytes.buffer);
        floatData = new Float32Array(pcmData.length);
        
        for (let i = 0; i < pcmData.length; i++) {
          floatData[i] = pcmData[i] / 32768.0;
          if (floatData[i] !== 0) {
            nonZeroSamples++;
            maxAmplitude = Math.max(maxAmplitude, Math.abs(floatData[i]));
            minAmplitude = Math.min(minAmplitude, -Math.abs(floatData[i]));
          }
        }
      }
      
      // Check if audio has content
      const hasContent = nonZeroSamples > 0 && maxAmplitude > 0.001;
      console.log(`=== AUDIO CONTENT ANALYSIS ===`);
      console.log(`Audio content analysis:`, {
        totalSamples: floatData.length,
        nonZeroSamples: nonZeroSamples,
        maxAmplitude: maxAmplitude,
        minAmplitude: minAmplitude,
        hasContent: hasContent
      });
      console.log(`First 10 float samples:`, Array.from(floatData.slice(0, 10)));
      console.log(`=== END AUDIO CONTENT ANALYSIS ===`);
      
      // Amplify audio if it's too quiet
      if (hasContent && maxAmplitude < 0.1) {
        const amplificationFactor = 0.1 / maxAmplitude;
        console.log(`Amplifying audio by factor: ${amplificationFactor}`);
        for (let i = 0; i < floatData.length; i++) {
          floatData[i] *= amplificationFactor;
        }
      }
      
      // Add debug logging
      console.log(`Processing ${audioType} audio:`, {
        originalSize: audioData.length,
        binarySize: binaryString.length,
        floatSamples: floatData.length,
        sampleRate: sampleRate,
        channels: channels,
        bitsPerSample: bitsPerSample
      });
      
      // Check if we have enough data
      if (floatData.length === 0) {
        console.warn('No audio data to process');
        return;
      }
      
      // Add to audio queue for real-time playback
      setAudioQueue(prev => [...prev, { 
        data: floatData, 
        timestamp: Date.now() 
      }]);
      
      // Start playback if not already playing
      if (!isPlaying) {
        console.log('Starting audio playback...');
        // Small delay to ensure audio context is properly initialized
        setTimeout(async () => {
          await startAudioPlayback();
        }, 100);
      } else {
        console.log('Audio already playing, queue length:', audioQueue.length);
      }
      
      console.log(`Queued ${audioType} audio data: ${floatData.length} samples`);
      
    } catch (error) {
      console.error('Error processing audio data:', error);
      setAudioStatus('error');
    }
  };

  const startAudioPlayback = async () => {
    try {
      // Check if Web Audio API is available
      if (!window.AudioContext && !(window as any).webkitAudioContext) {
        console.error('Web Audio API not supported in this browser');
        setAudioStatus('error');
        setIsPlaying(false);
        return;
      }

      if (!audioContextRef.current) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('AudioContext created:', ctx.state);
        setAudioContext(ctx);
        audioContextRef.current = ctx;
      }
      
      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        console.log('AudioContext is suspended, attempting to resume...');
        await audioContextRef.current.resume();
        console.log('AudioContext resumed:', audioContextRef.current.state);
      }
      
      console.log('AudioContext state:', audioContextRef.current.state);
      console.log('AudioContext sample rate:', audioContextRef.current.sampleRate);
      
      // Audio context test removed - was causing beep sounds
      console.log('Audio context ready for real audio playback');
      
      setIsPlaying(true);
      
      const playNextChunk = () => {
        console.log('playNextChunk called, queue length:', audioQueue.length);
        setAudioQueue(prev => {
          if (prev.length === 0) {
            console.log('Audio queue empty, stopping playback');
            setIsPlaying(false);
            return prev;
          }
          
          const chunk = prev[0];
          const remaining = prev.slice(1);
          
          // Check if audioContext is available
          if (!audioContextRef.current) {
            console.error('AudioContext not available');
            setAudioStatus('error');
            setIsPlaying(false);
            return remaining;
          }
          
          try {
            // Create audio buffer for this chunk
            // Use default format (most common for Windows audio)
            const actualChannels = 2; // Stereo
            const samplesPerChannel = chunk.data.length / actualChannels;
            const sampleRate = 48000; // Common Windows sample rate
            
            const buffer = audioContextRef.current.createBuffer(actualChannels, samplesPerChannel, sampleRate);
            
            if (actualChannels === 2) {
              // Split stereo data into left and right channels
              const leftChannel = new Float32Array(samplesPerChannel);
              const rightChannel = new Float32Array(samplesPerChannel);
              
              for (let i = 0; i < chunk.data.length; i += 2) {
                leftChannel[i / 2] = chunk.data[i];
                rightChannel[i / 2] = chunk.data[i + 1] || chunk.data[i]; // Use left channel if right is missing
              }
              
              buffer.getChannelData(0).set(leftChannel);
              buffer.getChannelData(1).set(rightChannel);
            } else {
              // Mono audio - use single channel
              buffer.getChannelData(0).set(chunk.data);
            }
            
            // Create and play audio source
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.start(0);
            
            console.log('=== AUDIO CHUNK PLAYED ===');
            console.log('Audio chunk played:', {
              samples: chunk.data.length,
              channels: actualChannels,
              sampleRate: sampleRate,
              duration: chunk.data.length / sampleRate * 1000
            });
            console.log('First 10 samples of chunk:', Array.from(chunk.data.slice(0, 10)));
            console.log('=== END AUDIO CHUNK ===');
            
            // Schedule next chunk with proper timing
            // For 44.1kHz stereo, 50ms delay should work well
            setTimeout(playNextChunk, 50);
          } catch (error) {
            console.error('Error playing audio chunk:', error);
            setAudioStatus('error');
            setIsPlaying(false);
          }
          
          return remaining;
        });
      };
      
      playNextChunk();
    } catch (error) {
      console.error('Error starting audio playback:', error);
      setAudioStatus('error');
      setIsPlaying(false);
    }
  };

  const handleStopMonitoring = () => {
    if (socket && monitoringCall) {
      // Leave the call monitoring room
      socket.emit('leave_call_monitoring', { callId: monitoringCall });
      
      // Remove event listeners
      socket.off(`call_audio_${monitoringCall}`);
      socket.off(`call_info_${monitoringCall}`);
    }
    
    // Clean up audio playback
    setIsPlaying(false);
    setAudioQueue([]);
    setAudioStatus('idle');
    
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
    
    if (audioStream) {
      audioStream.close();
      setAudioStream(null);
    }
    setMonitoringDialog(false);
    setMonitoringCall(null);
    setAudioStatus('idle');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success';
      case 'calling': return 'warning';
      case 'offline': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'calling': return <CallIcon />;
      default: return <CircleIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'team_lead': return 'warning';
      case 'agent': return 'primary';
      default: return 'default';
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return `${diffMins}:${diffSecs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Box display="flex" justifyContent="center">
          <Typography variant="body2" color="textSecondary">
            Please check your connection and try refreshing the page.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!dashboardConnected && !sseConnected) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px" flexDirection="column" gap={2}>
        <CircularProgress />
        <Typography variant="body1" color="textSecondary">
          Connecting to real-time updates... (Socket.IO Status: {dashboardConnected ? 'Connected' : 'Disconnected'})
        </Typography>
        <Button 
          variant="outlined" 
          onClick={() => {
            console.log('Forcing dashboard to show for debugging');
            setSseConnected(true);
          }}
        >
          Show Dashboard Anyway
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
        <Chip
          label={dashboardConnected ? 'Socket.IO Connected' : 'Socket.IO Disconnected'}
          color={dashboardConnected ? 'success' : 'error'}
          size="small"
          icon={dashboardConnected ? <CircleIcon /> : <CircleIcon />}
        />
        <Chip
          label={`Socket: ${socketConnected ? 'Connected' : 'Disconnected'}`}
          color={socketConnected ? 'success' : 'error'}
          size="small"
          variant="outlined"
        />

      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PeopleIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Users
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.totalUsers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CircleIcon color="success" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Online
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.onlineUsers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CallIcon color="warning" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Calling
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.callingUsers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PhoneIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Live Calls
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.liveCalls || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ScheduleIcon color="error" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Offline
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.offlineUsers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Users List */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Users Status
              </Typography>
              {users.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <PersonIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <Typography color="textSecondary">
                    No users found
                  </Typography>
                </Box>
              ) : (
                <List>
                  {users.map((user) => (
                    <ListItem key={user.id} divider>
                      <ListItemAvatar>
                        <Avatar>
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={user.name}
                        secondary={`${user.email} • ${user.team}`}
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <Chip
                          label={user.status}
                          color={getStatusColor(user.status) as any}
                          size="small"
                          icon={getStatusIcon(user.status)}
                        />
                        <Chip
                          label={user.role}
                          color={getRoleColor(user.role) as any}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Active Calls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Calls
              </Typography>
              {activeCalls.length === 0 ? (
                <Box textAlign="center" py={3}>
                  <CallIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <Typography color="textSecondary">
                    No active calls
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Customer</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeCalls.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {call.agentName}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {call.agentEmail}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDuration(call.startTime)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {call.customerNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {user?.role === 'admin' ? (
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<VolumeIcon />}
                                onClick={() => handleShowCall(call.id)}
                                color="primary"
                              >
                                Show
                              </Button>
                            ) : (
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/call-details/${call.id}`)}
                              >
                                <VisibilityIcon />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Call Monitoring Dialog */}
      <Dialog 
        open={monitoringDialog} 
        onClose={handleStopMonitoring}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <VolumeIcon color="primary" />
            <Typography variant="h6">
              Monitoring Active Call
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box py={2}>
            <Typography variant="body1" gutterBottom>
              You are now monitoring an active call. Real-time audio streaming is enabled.
            </Typography>
            
            {monitoringCall && (
              <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Call Details:
            </Typography>
            <Typography variant="body2" color="textSecondary">
                  Call ID: {monitoringCall}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Status: {socketConnected ? 'Connected' : 'Disconnected'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Audio: {socketConnected ? 'Streaming' : 'Not available'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Status: {audioStatus === 'playing' ? 'Playing' : audioStatus === 'error' ? 'Error' : 'Ready'}
                </Typography>
                {audioStatus === 'error' && (
                  <Typography variant="body2" color="error" mt={1}>
                    Audio playback error. Please check browser console for details.
                  </Typography>
                )}
              </Box>
            )}
            
            <Typography variant="body2" color="textSecondary" mt={2}>
              Audio data is being received and played in real-time. Check the browser console for detailed logs.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleStopMonitoring}
            variant="contained"
            color="error"
            startIcon={<StopIcon />}
          >
            Stop Monitoring
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
