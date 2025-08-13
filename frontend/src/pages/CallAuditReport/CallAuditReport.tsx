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
  Tabs,
  Tab,
  List,
  ListItem,

  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Paper,

  LinearProgress,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  VolumeUp as VolumeIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  RecordVoiceOver as CustomerIcon,
} from '@mui/icons-material';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,

  PieChart,
  Pie,
  Cell,
} from 'recharts';
import axios from 'axios';

interface CallAuditData {
  id: string;
  agentName: string;
  customerNumber: string;
  startTime: string;
  endTime: string;
  duration: string;
  audioUrl: string;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  transcript: TranscriptEntry[];
  summary: string;
  keywords: string[];
  score: number;
}

interface TranscriptEntry {
  id: string;
  timestamp: string;
  speaker: 'agent' | 'customer';
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`call-tabpanel-${index}`}
      aria-labelledby={`call-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const CallAuditReport: React.FC = () => {
  const { callId } = useParams<{ callId: string }>();
  const [callData, setCallData] = useState<CallAuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTranscript, setFilteredTranscript] = useState<TranscriptEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(0);

  useEffect(() => {
    if (callId) {
      fetchCallAuditData();
    }
  }, [callId]);

  useEffect(() => {
    if (callData?.transcript) {
      applyTranscriptSearch();
    }
  }, [callData?.transcript, searchTerm]);

  const fetchCallAuditData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/call-audit/${callId}`);
      setCallData(response.data);
    } catch (err) {
      setError('Failed to load call audit data');
      console.error('Call audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyTranscriptSearch = () => {
    if (!callData?.transcript) return;

    const filtered = callData.transcript.filter(entry =>
      entry.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.speaker.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTranscript(filtered);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
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

  const handleDownload = () => {
    if (callData?.audioUrl) {
      const link = document.createElement('a');
      link.href = callData.audioUrl;
      link.download = `call-audit-${callId}.mp3`;
      link.click();
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

  // Mock data for charts
  const sentimentChartData = [
    { time: '00:00', positive: 60, negative: 20, neutral: 20 },
    { time: '00:30', positive: 70, negative: 15, neutral: 15 },
    { time: '01:00', positive: 80, negative: 10, neutral: 10 },
    { time: '01:30', positive: 75, negative: 15, neutral: 10 },
    { time: '02:00', positive: 85, negative: 5, neutral: 10 },
    { time: '02:30', positive: 90, negative: 5, neutral: 5 },
  ];

  const sentimentPieData = [
    { name: 'Positive', value: 75, color: '#4caf50' },
    { name: 'Negative', value: 15, color: '#f44336' },
    { name: 'Neutral', value: 10, color: '#9e9e9e' },
  ];

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

  if (!callData) {
    return <Alert severity="info">Call data not found</Alert>;
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Call Audit Report
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          Download Report
        </Button>
      </Box>

      {/* Call Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Call Information
              </Typography>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Call ID: {callData.id}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Agent: {callData.agentName}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Customer: {callData.customerNumber}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Duration: {callData.duration}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Call Score
              </Typography>
              <Box display="flex" alignItems="center">
                <Typography variant="h3" color="primary" sx={{ mr: 2 }}>
                  {callData.score}/100
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={callData.score}
                  sx={{ width: 100, height: 8, borderRadius: 4 }}
                />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Audio Player */}
      <Card sx={{ mb: 3 }}>
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

      {/* Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Sentiment Analysis" />
            <Tab label="Transcription" />
            <Tab label="Summary" />
            <Tab label="Keywords" />
          </Tabs>
        </Box>

        {/* Sentiment Analysis Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={8}>
              <Typography variant="h6" gutterBottom>
                Sentiment Analysis Over Time
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
            </Grid>
            <Grid item xs={12} lg={4}>
              <Typography variant="h6" gutterBottom>
                Overall Sentiment Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  >
                    {sentimentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Transcription Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Search in transcription"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <Paper variant="outlined" sx={{ maxHeight: 500, overflow: 'auto' }}>
            <List>
              {(searchTerm ? filteredTranscript : callData.transcript).map((entry) => (
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
        </TabPanel>

        {/* Summary Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            Call Summary
          </Typography>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="body1" paragraph>
              {callData.summary}
            </Typography>
          </Paper>
        </TabPanel>

        {/* Keywords Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Keywords Detected
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {callData.keywords.map((keyword, index) => (
              <Chip
                key={index}
                label={keyword}
                variant="outlined"
                color="primary"
              />
            ))}
          </Box>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default CallAuditReport;
