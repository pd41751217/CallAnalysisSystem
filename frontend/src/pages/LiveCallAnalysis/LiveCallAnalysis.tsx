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
  ListItemIcon,
  Chip,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  SentimentSatisfied as PositiveIcon,
  SentimentDissatisfied as NegativeIcon,
  SentimentNeutral as NeutralIcon,
  QuestionAnswer as QuestionIcon,
  Warning as WarningIcon,
  Event as EventIcon,
  RecordVoiceOver as TranscriptionIcon,
} from '@mui/icons-material';
import { useSocket } from '../../contexts/SocketContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import TranscriptionDisplay from '../../components/TranscriptionDisplay';

interface SentimentData {
  id: string;
  callId: string;
  agentName: string;
  customerNumber: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  timestamp: string;
  duration: string;
}

interface QuestionData {
  id: string;
  callId: string;
  question: string;
  answer: string;
  timestamp: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
}

interface VulnerabilityData {
  id: string;
  callId: string;
  agentName: string;
  vulnerabilityType: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  timestamp: string;
  resolved: boolean;
}

interface EventData {
  id: string;
  callId: string;
  eventType: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  actionRequired: boolean;
  actionTaken?: string;
}

const LiveCallAnalysis: React.FC = () => {
  const [sentiments, setSentiments] = useState<SentimentData[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    fetchInitialData();
    
    if (socket) {
      socket.on('sentiment_update', handleSentimentUpdate);
      socket.on('question_detected', handleQuestionDetected);
      socket.on('vulnerability_detected', handleVulnerabilityDetected);
      socket.on('event_triggered', handleEventTriggered);
      socket.on('transcription_update', handleTranscriptionUpdate);
    }

    return () => {
      if (socket) {
        socket.off('sentiment_update');
        socket.off('question_detected');
        socket.off('vulnerability_detected');
        socket.off('event_triggered');
        socket.off('transcription_update');
      }
    };
  }, [socket]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      // In a real app, you would fetch initial data from API
      // For now, we'll use mock data
      setLoading(false);
    } catch (err) {
      setError('Failed to load live analysis data');
      setLoading(false);
    }
  };

  const handleSentimentUpdate = (data: SentimentData) => {
    setSentiments(prev => [data, ...prev.slice(0, 49)]); // Keep last 50
  };

  const handleQuestionDetected = (data: QuestionData) => {
    setQuestions(prev => [data, ...prev.slice(0, 49)]); // Keep last 50
  };

  const handleVulnerabilityDetected = (data: VulnerabilityData) => {
    setVulnerabilities(prev => [data, ...prev.slice(0, 49)]); // Keep last 50
  };

  const handleEventTriggered = (data: EventData) => {
    setEvents(prev => [data, ...prev.slice(0, 49)]); // Keep last 50
  };

  const handleTranscriptionUpdate = (data: any) => {
    // Set the current call ID if not already set
    if (!currentCallId && data.callId) {
      setCurrentCallId(data.callId);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <PositiveIcon color="success" />;
      case 'negative': return <NegativeIcon color="error" />;
      case 'neutral': return <NeutralIcon color="action" />;
      default: return <NeutralIcon />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  // Mock data for charts
  const sentimentChartData = [
    { time: '00:00', positive: 65, negative: 15, neutral: 20 },
    { time: '00:05', positive: 70, negative: 10, neutral: 20 },
    { time: '00:10', positive: 75, negative: 8, neutral: 17 },
    { time: '00:15', positive: 80, negative: 5, neutral: 15 },
    { time: '00:20', positive: 85, negative: 3, neutral: 12 },
  ];

  const sentimentPieData = [
    { name: 'Positive', value: 75, color: '#4caf50' },
    { name: 'Negative', value: 10, color: '#f44336' },
    { name: 'Neutral', value: 15, color: '#9e9e9e' },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Live Call Analysis
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Analysis Dashboard" icon={<EventIcon />} />
          <Tab label="Live Transcription" icon={<TranscriptionIcon />} />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box>

      <Grid container spacing={3}>
        {/* Real-time Sentiment Trends */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Real-time Sentiment Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sentimentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="positive" stroke="#4caf50" strokeWidth={2} />
                  <Line type="monotone" dataKey="negative" stroke="#f44336" strokeWidth={2} />
                  <Line type="monotone" dataKey="neutral" stroke="#9e9e9e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Sentiment Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sentiment Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sentimentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Real-time Call Sentiments List */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Real-time Call Sentiments
              </Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {sentiments.map((sentiment) => (
                  <ListItem key={sentiment.id} divider>
                    <ListItemIcon>
                      {getSentimentIcon(sentiment.sentiment)}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${sentiment.agentName} - ${sentiment.customerNumber}`}
                      secondary={`${sentiment.duration} • ${new Date(sentiment.timestamp).toLocaleTimeString()}`}
                    />
                    <Box>
                      <Chip
                        label={`${sentiment.confidence}%`}
                        size="small"
                        color={sentiment.confidence > 80 ? 'success' : sentiment.confidence > 60 ? 'warning' : 'error'}
                      />
                    </Box>
                  </ListItem>
                ))}
                {sentiments.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No sentiment data available"
                      secondary="Sentiment updates will appear here in real-time"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Real-time Questions Report */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Real-time Questions Report
              </Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {questions.map((question) => (
                  <ListItem key={question.id} divider>
                    <ListItemIcon>
                      <QuestionIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={question.question}
                      secondary={`${question.category} • ${new Date(question.timestamp).toLocaleTimeString()}`}
                    />
                    <Chip
                      label={question.priority}
                      color={getPriorityColor(question.priority) as any}
                      size="small"
                    />
                  </ListItem>
                ))}
                {questions.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No questions detected"
                      secondary="Questions will appear here as they are detected"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Customer Vulnerability */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customer Vulnerability Alerts
              </Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {vulnerabilities.map((vulnerability) => (
                  <ListItem key={vulnerability.id} divider>
                    <ListItemIcon>
                      <WarningIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary={vulnerability.vulnerabilityType}
                      secondary={`${vulnerability.agentName} • ${vulnerability.description}`}
                    />
                    <Box>
                      <Chip
                        label={vulnerability.severity}
                        color={getSeverityColor(vulnerability.severity) as any}
                        size="small"
                      />
                      {vulnerability.resolved && (
                        <Chip
                          label="Resolved"
                          color="success"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  </ListItem>
                ))}
                {vulnerabilities.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No vulnerability alerts"
                      secondary="Vulnerability alerts will appear here"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Event Details */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Real-time Event Details
              </Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {events.map((event) => (
                  <ListItem key={event.id} divider>
                    <ListItemIcon>
                      <EventIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={event.eventType}
                      secondary={`${event.description} • ${new Date(event.timestamp).toLocaleTimeString()}`}
                    />
                    <Box>
                      <Chip
                        label={event.severity}
                        color={getSeverityColor(event.severity) as any}
                        size="small"
                      />
                      {event.actionRequired && (
                        <Chip
                          label="Action Required"
                          color="error"
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  </ListItem>
                ))}
                {events.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No events triggered"
                      secondary="Events will appear here as they are triggered"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Live Metrics */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Live Performance Metrics
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {sentiments.filter(s => s.sentiment === 'positive').length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Positive Calls
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="error.main">
                      {vulnerabilities.filter(v => v.severity === 'high').length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      High Risk Alerts
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">
                      {questions.filter(q => q.priority === 'high').length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      High Priority Questions
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {events.filter(e => e.actionRequired).length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Actions Required
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          {currentCallId ? (
            <TranscriptionDisplay 
              callId={currentCallId} 
              onTranscriptionUpdate={handleTranscriptionUpdate}
            />
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" color="textSecondary" align="center">
                  No active call detected
                </Typography>
                <Typography variant="body2" color="textSecondary" align="center">
                  Transcription will appear here when a call is active
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
};

export default LiveCallAnalysis;
