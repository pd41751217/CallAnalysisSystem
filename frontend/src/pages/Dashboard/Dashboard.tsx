import React, { useState, useEffect } from 'react';
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
  Badge,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  People as PeopleIcon,
  Phone as PhoneIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Circle as CircleIcon,
  Visibility as VisibilityIcon,
  Call as CallIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  status: 'online' | 'offline' | 'calling';
  lastActive: string;
}

interface ActiveCall {
  id: string;
  agentId: string;
  agentName: string;
  customerNumber: string;
  startTime: string;
  duration: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  status: 'active' | 'on-hold' | 'transferring';
}

interface DashboardMetrics {
  totalUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  callingUsers: number;
  liveCalls: number;
}

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { socket } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    
    // Listen for real-time updates
    if (socket) {
      socket.on('user_status_update', handleUserStatusUpdate);
      socket.on('call_started', handleCallStarted);
      socket.on('call_ended', handleCallEnded);
      socket.on('sentiment_update', handleSentimentUpdate);
    }

    return () => {
      if (socket) {
        socket.off('user_status_update');
        socket.off('call_started');
        socket.off('call_ended');
        socket.off('sentiment_update');
      }
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch users with online/offline/calling status
      const usersResponse = await axios.get('/api/dashboard/users');
      const usersData = usersResponse.data;
      
      // Fetch active calls
      const callsResponse = await axios.get('/api/dashboard/live');
      const callsData = callsResponse.data;

      // Update metrics
      const dashboardMetrics: DashboardMetrics = {
        totalUsers: usersData.totalUsers,
        onlineUsers: usersData.onlineUsers,
        offlineUsers: usersData.offlineUsers,
        callingUsers: usersData.callingUsers,
        liveCalls: callsData.totalActive
      };

      setMetrics(dashboardMetrics);
      setUsers(usersData.users);
      setActiveCalls(callsData.activeCalls || []);
      
    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusUpdate = (data: { userId: string; status: string }) => {
    setUsers(prev => prev.map(user => 
      user.id === data.userId 
        ? { ...user, status: data.status as 'online' | 'offline' | 'calling' }
        : user
    ));
  };

  const handleCallStarted = (call: ActiveCall) => {
    setActiveCalls(prev => [...prev, call]);
    setMetrics(prev => prev ? { ...prev, liveCalls: prev.liveCalls + 1 } : null);
  };

  const handleCallEnded = (callId: string) => {
    setActiveCalls(prev => prev.filter(call => call.id !== callId));
    setMetrics(prev => prev ? { ...prev, liveCalls: prev.liveCalls - 1 } : null);
  };

  const handleSentimentUpdate = (data: { callId: string; sentiment: string }) => {
    setActiveCalls(prev => prev.map(call => 
      call.id === data.callId 
        ? { ...call, sentiment: data.sentiment as 'positive' | 'negative' | 'neutral' }
        : call
    ));
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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'success';
      case 'negative': return 'error';
      case 'neutral': return 'default';
      default: return 'default';
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

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

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
                        <TableCell>Agent</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Sentiment</TableCell>
                        <TableCell>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeCalls.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell>{call.agentName}</TableCell>
                          <TableCell>{call.duration}</TableCell>
                          <TableCell>
                            <Chip
                              label={call.sentiment}
                              color={getSentimentColor(call.sentiment) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/call-details/${call.id}`)}
                            >
                              <VisibilityIcon />
                            </IconButton>
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
    </Box>
  );
};

export default Dashboard;
