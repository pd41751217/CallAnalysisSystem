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


interface Agent {
  id: string;
  name: string;
  email: string;
  status: 'online' | 'offline' | 'busy';
  team: string;
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
  totalAgents: number;
  totalTeamLeads: number;
  liveCalls: number;
  activeAgents: number;
}

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { socket } = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    
    // Listen for real-time updates
    if (socket) {
      socket.on('agent_status_update', handleAgentStatusUpdate);
      socket.on('call_started', handleCallStarted);
      socket.on('call_ended', handleCallEnded);
      socket.on('sentiment_update', handleSentimentUpdate);
    }

    return () => {
      if (socket) {
        socket.off('agent_status_update');
        socket.off('call_started');
        socket.off('call_ended');
        socket.off('sentiment_update');
      }
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Always use mock data for now to avoid API issues
      console.log('Using mock data for frontend testing');
      
      const mockMetrics: DashboardMetrics = {
        totalAgents: 8,
        totalTeamLeads: 2,
        liveCalls: 3,
        activeAgents: 5
      };

      const mockAgents: Agent[] = [
        {
          id: '1',
          name: 'John Smith',
          email: 'john.smith@callanalysis.com',
          status: 'online',
          team: 'Sales Team',
          lastActive: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@callanalysis.com',
          status: 'busy',
          team: 'Support Team',
          lastActive: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Mike Davis',
          email: 'mike.davis@callanalysis.com',
          status: 'online',
          team: 'Sales Team',
          lastActive: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Lisa Wilson',
          email: 'lisa.wilson@callanalysis.com',
          status: 'offline',
          team: 'Support Team',
          lastActive: new Date().toISOString()
        },
        {
          id: '5',
          name: 'David Brown',
          email: 'david.brown@callanalysis.com',
          status: 'online',
          team: 'Quality Assurance',
          lastActive: new Date().toISOString()
        }
      ];

      const mockActiveCalls: ActiveCall[] = [
        {
          id: '1',
          agentId: '2',
          agentName: 'Sarah Johnson',
          customerNumber: '+1234567890',
          startTime: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          duration: '5:23',
          sentiment: 'positive',
          status: 'active'
        },
        {
          id: '2',
          agentId: '3',
          agentName: 'Mike Davis',
          customerNumber: '+1987654321',
          startTime: new Date(Date.now() - 180000).toISOString(), // 3 minutes ago
          duration: '3:45',
          sentiment: 'neutral',
          status: 'active'
        },
        {
          id: '3',
          agentId: '5',
          agentName: 'David Brown',
          customerNumber: '+1555123456',
          startTime: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          duration: '1:12',
          sentiment: 'negative',
          status: 'active'
        }
      ];

      console.log('Setting mock data:', { mockAgents, mockActiveCalls });
      setMetrics(mockMetrics);
      setAgents(mockAgents);
      setActiveCalls(mockActiveCalls);
      
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAgentStatusUpdate = (data: { agentId: string; status: string }) => {
    setAgents(prev => prev.map(agent => 
      agent.id === data.agentId 
        ? { ...agent, status: data.status as 'online' | 'offline' | 'busy' }
        : agent
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
      case 'busy': return 'warning';
      case 'offline': return 'error';
      default: return 'default';
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  // Debug logging
  console.log('Current agents state:', agents);
  console.log('Agents type:', typeof agents);
  console.log('Is agents array?', Array.isArray(agents));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <PeopleIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Agents
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.totalAgents || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUpIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Team Leads
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.totalTeamLeads || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
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

        <Grid xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ScheduleIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Agents
                  </Typography>
                  <Typography variant="h4">
                    {metrics?.activeAgents || 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Agents List */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agents (Live & Idle)
              </Typography>
                             <List>
                 {Array.isArray(agents) ? agents.map((agent) => (
                   <ListItem key={agent.id} divider>
                     <ListItemAvatar>
                       <Avatar>
                         <PersonIcon />
                       </Avatar>
                     </ListItemAvatar>
                     <ListItemText
                       primary={agent.name}
                       secondary={`${agent.team} • ${agent.email}`}
                     />
                     <Chip
                       label={agent.status}
                       color={getStatusColor(agent.status) as any}
                       size="small"
                       icon={<CircleIcon />}
                     />
                   </ListItem>
                 )) : (
                   <ListItem>
                     <ListItemText primary="Loading agents..." />
                   </ListItem>
                 )}
               </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Calls */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Active Calls
              </Typography>
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
                     {(activeCalls || []).map((call) => (
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
                             {(activeCalls || []).length === 0 && (
                 <Box textAlign="center" py={3}>
                   <CallIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                   <Typography color="textSecondary">
                     No active calls
                   </Typography>
                 </Box>
               )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
