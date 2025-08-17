import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  VolumeUp as VolumeIcon,

  Chat as ChatIcon,
} from '@mui/icons-material';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
} from 'recharts';

interface CallAuditStats {
  productivity: number;
  unproductivity: number;
  speech: number;
  crosstalk: number;
  music: number;
  silence: number;
  totalCalls: number;
  averageCallDuration: string;
  conventionalCalls: number;
  nonConventionalCalls: number;
}

interface ProductivityData {
  time: string;
  productivity: number;
  speech: number;
  silence: number;
  crosstalk: number;
}

interface CallTypeData {
  name: string;
  value: number;
  color: string;
}

const OverviewDashboard: React.FC = () => {
  const [stats, setStats] = useState<CallAuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      // In a real app, you would fetch data from API
      // Mock data for demonstration
      setStats({
        productivity: 75,
        unproductivity: 25,
        speech: 60,
        crosstalk: 15,
        music: 5,
        silence: 20,
        totalCalls: 1250,
        averageCallDuration: '5m 30s',
        conventionalCalls: 980,
        nonConventionalCalls: 270,
      });
    } catch (err) {
      setError('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  // Mock data for charts
  const productivityData: ProductivityData[] = [
    { time: '00:00', productivity: 70, speech: 65, silence: 20, crosstalk: 15 },
    { time: '00:05', productivity: 75, speech: 70, silence: 18, crosstalk: 12 },
    { time: '00:10', productivity: 80, speech: 75, silence: 15, crosstalk: 10 },
    { time: '00:15', productivity: 85, speech: 80, silence: 12, crosstalk: 8 },
    { time: '00:20', productivity: 90, speech: 85, silence: 10, crosstalk: 5 },
  ];

  const callTypeData: CallTypeData[] = [
    { name: 'Conventional', value: 78, color: '#4caf50' },
    { name: 'Non-Conventional', value: 22, color: '#ff9800' },
  ];

  const speechAnalysisData = [
    { category: 'Productive Speech', value: 60, color: '#4caf50' },
    { category: 'Silence', value: 20, color: '#9e9e9e' },
    { category: 'Crosstalk', value: 15, color: '#ff9800' },
    { category: 'Music', value: 5, color: '#2196f3' },
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

  if (!stats) {
    return <Alert severity="info">No data available</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Overview Dashboard
      </Typography>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUpIcon color="success" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Productivity
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.productivity}%
                  </Typography>
                </Box>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={stats.productivity} 
                sx={{ 
                  mt: 2,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#4caf50'
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingDownIcon color="error" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Unproductivity
                  </Typography>
                  <Typography variant="h4" color="error.main">
                    {stats.unproductivity}%
                  </Typography>
                </Box>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={stats.unproductivity} 
                sx={{ 
                  mt: 2,
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#f44336'
                  }
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <VolumeIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Calls
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalCalls}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Avg: {stats.averageCallDuration}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ChatIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Call Types
                  </Typography>
                  <Typography variant="h6">
                    {stats.conventionalCalls} / {stats.nonConventionalCalls}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Conv / Non-Conv
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Productivity, Speech, Silence, and Crosstalk Chart */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Productivity, Speech, Silence & Crosstalk Trends
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={productivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="productivity" 
                    stackId="1"
                    stroke="#4caf50" 
                    fill="#4caf50" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="speech" 
                    stackId="2"
                    stroke="#2196f3" 
                    fill="#2196f3" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="silence" 
                    stackId="3"
                    stroke="#9e9e9e" 
                    fill="#9e9e9e" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="crosstalk" 
                    stackId="4"
                    stroke="#ff9800" 
                    fill="#ff9800" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Call Type Distribution */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Conventional vs Non-Conventional Calls
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={callTypeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {callTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Speech Analysis Breakdown */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Speech Analysis Breakdown
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={speechAnalysisData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8">
                    {speechAnalysisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Call Audit Statistics
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2">Productive Speech</Typography>
                  <Typography variant="body2" fontWeight="bold">{stats.speech}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={stats.speech} 
                  sx={{ 
                    mb: 2,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#4caf50'
                    }
                  }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2">Silence</Typography>
                  <Typography variant="body2" fontWeight="bold">{stats.silence}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={stats.silence} 
                  sx={{ 
                    mb: 2,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#9e9e9e'
                    }
                  }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2">Crosstalk</Typography>
                  <Typography variant="body2" fontWeight="bold">{stats.crosstalk}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={stats.crosstalk} 
                  sx={{ 
                    mb: 2,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#ff9800'
                    }
                  }}
                />

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="body2">Music</Typography>
                  <Typography variant="body2" fontWeight="bold">{stats.music}%</Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={stats.music} 
                  sx={{ 
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#2196f3'
                    }
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Trends */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Trends Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={productivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="productivity" 
                    stroke="#4caf50" 
                    strokeWidth={3}
                    name="Productivity"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="speech" 
                    stroke="#2196f3" 
                    strokeWidth={2}
                    name="Speech"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="silence" 
                    stroke="#9e9e9e" 
                    strokeWidth={2}
                    name="Silence"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="crosstalk" 
                    stroke="#ff9800" 
                    strokeWidth={2}
                    name="Crosstalk"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OverviewDashboard;
