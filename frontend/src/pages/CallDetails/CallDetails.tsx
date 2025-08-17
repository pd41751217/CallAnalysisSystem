import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  TextField,
  IconButton,
  Paper,
  LinearProgress,
  Badge,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  VolumeUp as VolumeIcon,
  Send as SendIcon,
  Person as PersonIcon,
  RecordVoiceOver as CustomerIcon,
  CheckCircle as ComplianceIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Message as MessageIcon,

} from '@mui/icons-material';
import { useSocket } from '../../contexts/SocketContext';
import { callDetailsService } from '../../services/callDetailsService';
import type { CallDetails as CallDetailsType, Message, TranscriptEntry } from '../../services/callDetailsService';



const CallDetails: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const [callDetails, setCallDetails] = useState<CallDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(0);
  const { socket } = useSocket();

  useEffect(() => {
    if (callId) {
      fetchCallDetails();
    }
  }, [callId]);

  useEffect(() => {
    if (socket && callId) {
      socket.on(`call_update_${callId}`, handleCallUpdate);
      socket.on(`transcript_update_${callId}`, handleTranscriptUpdate);
      socket.on(`message_received_${callId}`, handleMessageReceived);
    }

    return () => {
      if (socket) {
        socket.off(`call_update_${callId}`);
        socket.off(`transcript_update_${callId}`);
        socket.off(`message_received_${callId}`);
      }
    };
  }, [socket, callId]);

  const fetchCallDetails = async () => {
    try {
      setLoading(true);
      const data = await callDetailsService.getCallDetails(callId!);
      setCallDetails(data);
    } catch (err) {
      setError('Failed to load call details');
      console.error('Call details fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCallUpdate = (data: Partial<CallDetailsType>) => {
    setCallDetails(prev => prev ? { ...prev, ...data } : null);
  };

  const handleTranscriptUpdate = (entry: TranscriptEntry) => {
    setCallDetails(prev => prev ? {
      ...prev,
      transcript: [...prev.transcript, entry]
    } : null);
  };

  const handleMessageReceived = (message: Message) => {
    setCallDetails(prev => prev ? {
      ...prev,
      messages: [...prev.messages, message]
    } : null);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !callId) return;

    try {
      const message = await callDetailsService.sendMessage(callId, newMessage);
      
      setCallDetails(prev => prev ? {
        ...prev,
        messages: [...prev.messages, message]
      } : null);
      
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // In a real app, you would control the audio player here
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    // In a real app, you would stop the audio player here
  };

  const getComplianceIcon = (type: string) => {
    switch (type) {
      case 'critical': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'info': return <ComplianceIcon color="info" />;
      default: return <ComplianceIcon />;
    }
  };

  const getComplianceColor = (type: string) => {
    switch (type) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  if (!callDetails) {
    return <Alert severity="info">Call details not found</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Call Details
      </Typography>

      <Grid container spacing={3}>
        {/* Call Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Call Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Call ID
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {callDetails.id}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Status
                  </Typography>
                  <Chip
                    label={callDetails.status}
                    color={callDetails.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Agent
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {callDetails.agentName}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Customer
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {callDetails.customerNumber}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Duration
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {callDetails.duration}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="textSecondary">
                    Sentiment
                  </Typography>
                  <Chip
                    label={callDetails.sentiment}
                    color={getSentimentColor(callDetails.sentiment) as any}
                    size="small"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Call Score */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Call Score
              </Typography>
              <Box display="flex" alignItems="center" justifyContent="center">
                <Typography variant="h2" color="primary" sx={{ mr: 2 }}>
                  {callDetails.score}
                </Typography>
                <Typography variant="h4" color="textSecondary">
                  /100
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={callDetails.score}
                sx={{ mt: 2, height: 8, borderRadius: 4 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Volume Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Volume Details
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2">Agent Volume</Typography>
                  <Typography variant="body2" fontWeight="bold">{callDetails.volume.agent}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={callDetails.volume.agent}
                  color="primary"
                  sx={{ mb: 3 }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2">Customer Volume</Typography>
                  <Typography variant="body2" fontWeight="bold">{callDetails.volume.customer}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={callDetails.volume.customer}
                  color="secondary"
                  sx={{ mb: 3 }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2">Overall Volume</Typography>
                  <Typography variant="body2" fontWeight="bold">{callDetails.volume.overall}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={callDetails.volume.overall}
                  color="success"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Compliance Looker */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Compliance Looker
              </Typography>
              <Box display="flex" alignItems="center" mb={2}>
                <Typography variant="h4" color={callDetails.compliance.passed ? 'success.main' : 'error.main'} sx={{ mr: 2 }}>
                  {callDetails.compliance.score}%
                </Typography>
                <Chip
                  label={callDetails.compliance.passed ? 'PASSED' : 'FAILED'}
                  color={callDetails.compliance.passed ? 'success' : 'error'}
                />
              </Box>
              <List dense>
                {callDetails.compliance.issues.map((issue) => (
                  <ListItem key={issue.id}>
                    <ListItemIcon>
                      {getComplianceIcon(issue.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={issue.description}
                      secondary={issue.timestamp}
                    />
                    <Chip
                      label={issue.type}
                      color={getComplianceColor(issue.type) as any}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Audio Player */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Call Audio Player
              </Typography>
              <Box display="flex" alignItems="center" gap={2}>
                <IconButton onClick={handlePlayPause} size="large">
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </IconButton>
                <IconButton onClick={handleStop} size="large">
                  <StopIcon />
                </IconButton>
                <Box sx={{ flexGrow: 1, mx: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(currentTime / duration) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Box display="flex" justifyContent="space-between" mt={1}>
                    <Typography variant="caption">
                      {formatTime(currentTime)}
                    </Typography>
                    <Typography variant="caption">
                      {formatTime(duration)}
                    </Typography>
                  </Box>
                </Box>
                <VolumeIcon />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Transcript */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Live Transcript
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List>
                  {callDetails.transcript.map((entry) => (
                    <ListItem key={entry.id} divider>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                        <Box sx={{ mr: 2, mt: 0.5 }}>
                          {entry.speaker === 'agent' ? (
                            <PersonIcon color="primary" />
                          ) : (
                            <CustomerIcon color="secondary" />
                          )}
                        </Box>
                        <Box sx={{ flexGrow: 1 }}>
                          <Box display="flex" alignItems="center" mb={1}>
                            <Typography variant="body2" fontWeight="bold" sx={{ mr: 2 }}>
                              {entry.speaker === 'agent' ? 'Agent' : 'Customer'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary" sx={{ mr: 2 }}>
                              {entry.timestamp}
                            </Typography>
                            <Chip
                              label={entry.sentiment}
                              color={getSentimentColor(entry.sentiment) as any}
                              size="small"
                            />
                          </Box>
                          <Typography variant="body1">
                            {entry.text}
                          </Typography>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Messages */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Messages
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', mb: 2 }}>
                <List dense>
                  {callDetails.messages.map((message) => (
                    <ListItem key={message.id}>
                      <ListItemIcon>
                        <Badge
                          badgeContent={message.read ? 0 : 1}
                          color="error"
                        >
                          <MessageIcon color="primary" />
                        </Badge>
                      </ListItemIcon>
                      <ListItemText
                        primary={message.text}
                        secondary={`${message.sender} • ${message.timestamp}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
              <Box display="flex" gap={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <IconButton onClick={handleSendMessage} color="primary">
                  <SendIcon />
                </IconButton>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CallDetails;
