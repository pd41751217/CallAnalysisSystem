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
import WebRTCAudioPlayer from '../../components/WebRTCAudioPlayer/WebRTCAudioPlayer';


const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monitoringCall, setMonitoringCall] = useState<string | null>(null);
  const [monitoringDialog, setMonitoringDialog] = useState(false);
  const [audioStream, setAudioStream] = useState<EventSource | null>(null);
   
 
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



    try {
      // Use Socket.IO for real-time audio streaming
      if (socket && socket.connected) {
        // Join the call monitoring room
        socket.emit('join_call_monitoring', { callId });
        


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

  // Audio status tracking (simplified)
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing' | 'error'>('idle');

  const handleStopMonitoring = () => {
    if (socket && monitoringCall) {
      // Leave the call monitoring room
      socket.emit('leave_call_monitoring', { callId: monitoringCall });
      
      // Remove event listeners
      socket.off(`call_info_${monitoringCall}`);
    }
    
    // Clean up audio playback
    setAudioStatus('idle');
    
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
      <Box 
        sx={{ 
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative background elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #e91e63, #9c27b0)',
            opacity: 0.1,
            animation: 'float 6s ease-in-out infinite'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -150,
            left: -150,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #9c27b0, #e91e63)',
            opacity: 0.1,
            animation: 'float 8s ease-in-out infinite 2s'
          }}
        />
        
        <Box position="relative" zIndex={1} textAlign="center">
          <Box
            sx={{
              background: 'linear-gradient(135deg, #e91e63, #9c27b0)',
              borderRadius: '50%',
              p: 3,
              mb: 3,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(233, 30, 99, 0.3)',
              animation: 'pulse 2s infinite'
            }}
          >
            <PhoneIcon sx={{ fontSize: 60, color: 'white' }} />
          </Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 600,
              background: 'linear-gradient(45deg, #e91e63, #9c27b0)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 2
            }}
          >
            Loading Dashboard
          </Typography>
          <Typography variant="body1" sx={{ color: '#4a5568', mb: 3 }}>
            Preparing your call analysis workspace...
          </Typography>
          <CircularProgress 
            size={60}
            sx={{
              color: '#e91e63',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              }
            }}
          />
        </Box>
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

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            width: 190,
            height: 110,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)'
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box display="flex" alignItems="center">
                <PeopleIcon sx={{ fontSize: 40, mr: 2, color: 'white' }} />
                <Box>
                  <Typography sx={{ opacity: 0.9, mb: 1, fontWeight: 500 }}>
                    Total Users
                  </Typography>
                                     <Typography variant="h3" sx={{ fontWeight: 700, textAlign: 'center' }}>
                    {metrics?.totalUsers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            width: 190,
            height: 110,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)'
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box display="flex" alignItems="center">
                <CircleIcon sx={{ fontSize: 40, mr: 2, color: 'white' }} />
                <Box>
                  <Typography sx={{ opacity: 0.9, mb: 1, fontWeight: 500 }}>
                    Online
                  </Typography>
                                     <Typography variant="h3" sx={{ fontWeight: 700, textAlign: 'center' }}>
                    {metrics?.onlineUsers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            width: 190,
            height: 110,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)'
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box display="flex" alignItems="center">
                <CallIcon sx={{ fontSize: 40, mr: 2, color: 'white' }} />
                <Box>
                  <Typography sx={{ opacity: 0.9, mb: 1, fontWeight: 500 }}>
                    Calling
                  </Typography>
                                     <Typography variant="h3" sx={{ fontWeight: 700, textAlign: 'center' }}>
                    {metrics?.callingUsers || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            width: 190,
            height: 110,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)'
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box display="flex" alignItems="center">
                <PhoneIcon sx={{ fontSize: 40, mr: 2, color: 'white' }} />
                <Box>
                  <Typography sx={{ opacity: 0.9, mb: 1, fontWeight: 500 }}>
                    Live Calls
                  </Typography>
                                     <Typography variant="h3" sx={{ fontWeight: 700, textAlign: 'center' }}>
                    {metrics?.liveCalls || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            width: 190,
            height: 110,
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)'
              }}
            />
            <CardContent sx={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box display="flex" alignItems="center">
                <ScheduleIcon sx={{ fontSize: 40, mr: 2, color: 'white' }} />
                <Box>
                  <Typography sx={{ opacity: 0.9, mb: 1, fontWeight: 500 }}>
                    Offline
                  </Typography>
                                     <Typography variant="h3" sx={{ fontWeight: 700, textAlign: 'center' }}>
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
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(233, 30, 99, 0.3)',
            border: '1px solid rgba(233, 30, 99, 0.1)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative elements */}
          <Box
            sx={{
              position: 'absolute',
              top: -20,
              right: -20,
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              animation: 'pulse 3s infinite'
            }}
          />
          
          <Box display="flex" alignItems="center" gap={2} position="relative" zIndex={1}>
            <Box
              sx={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '50%',
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <VolumeIcon sx={{ fontSize: 28, color: 'white' }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Live Call Monitoring
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
                {audioStatus === 'error' && (
                  <Typography variant="body2" color="error" mt={1}>
                    Audio playback error. Please check browser console for details.
                  </Typography>
                )}
              </Box>
            )}
            
             {/* WebRTC Audio Players */}
             <Box mt={3}>
               <Typography variant="h6" gutterBottom>
                 Live Audio Streams
            </Typography>
               
               <Box display="flex" gap={2} flexWrap="wrap">
                 {/* Microphone */}
                 <Box flex={1} minWidth={300}>
                   {monitoringCall && (
                     <WebRTCAudioPlayer
                       callId={monitoringCall}
                       audioType="mic"
                       autoPlay={true}
                      //  onConnectionStateChange={(state) => console.log('Mic WebRTC state:', state)}
                      //  onAudioLevelChange={(level) => console.log('Mic audio level:', level)}
                     />
                   )}
                 </Box>
                 {/* Speaker */}
                 <Box flex={1} minWidth={300}>
                   {monitoringCall && (
                     <WebRTCAudioPlayer
                       callId={monitoringCall}
                       audioType="speaker"
                       autoPlay={true}
                      //  onConnectionStateChange={(state) => console.log('Speaker WebRTC state:', state)}
                      //  onAudioLevelChange={(level) => console.log('Speaker audio level:', level)}
                     />
                   )}
                 </Box>
               </Box>
             </Box>
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
