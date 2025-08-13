import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  IconButton,
  TablePagination,
  CircularProgress,
  Alert,
  Grid,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';


interface Call {
  id: string;
  agentId: string;
  agentName: string;
  customerNumber: string;
  startTime: string;
  endTime: string;
  duration: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  status: 'completed' | 'missed' | 'transferred';
  team: string;
  score: number;
}

interface CallHistoryFilters {
  search: string;
  agent: string;
  team: string;
  status: string;
  sentiment: string;
  startDate: Date | null;
  endDate: Date | null;
}

const CallHistory: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agents, setAgents] = useState<string[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState<CallHistoryFilters>({
    search: '',
    agent: '',
    team: '',
    status: '',
    sentiment: '',
    startDate: null,
    endDate: null,
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCallHistory();
    fetchFilters();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [calls, filters]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      
      // Use mock data for frontend testing
      console.log('Using mock call history data for frontend testing');
      
      const mockCalls = [
        {
          id: '1',
          agentId: 'agent1',
          agentName: 'John Smith',
          customerNumber: '+1234567890',
          startTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          endTime: new Date(Date.now() - 86400000 + 323000).toISOString(), // 1 day ago + 5:23
          duration: '5:23',
          sentiment: 'positive' as const,
          status: 'completed' as const,
          team: 'Sales Team',
          score: 85
        },
        {
          id: '2',
          agentId: 'agent2',
          agentName: 'Sarah Johnson',
          customerNumber: '+1987654321',
          startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          endTime: new Date(Date.now() - 172800000 + 225000).toISOString(), // 2 days ago + 3:45
          duration: '3:45',
          sentiment: 'neutral' as const,
          status: 'completed' as const,
          team: 'Support Team',
          score: 72
        },
        {
          id: '3',
          agentId: 'agent3',
          agentName: 'Mike Davis',
          customerNumber: '+1555123456',
          startTime: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          endTime: new Date(Date.now() - 259200000 + 432000).toISOString(), // 3 days ago + 7:12
          duration: '7:12',
          sentiment: 'negative' as const,
          status: 'missed' as const,
          team: 'Sales Team',
          score: 45
        },
        {
          id: '4',
          agentId: 'agent4',
          agentName: 'Lisa Wilson',
          customerNumber: '+1444333222',
          startTime: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
          endTime: new Date(Date.now() - 345600000 + 270000).toISOString(), // 4 days ago + 4:30
          duration: '4:30',
          sentiment: 'positive' as const,
          status: 'completed' as const,
          team: 'Support Team',
          score: 90
        },
        {
          id: '5',
          agentId: 'agent5',
          agentName: 'David Brown',
          customerNumber: '+1777888999',
          startTime: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
          endTime: new Date(Date.now() - 432000000 + 375000).toISOString(), // 5 days ago + 6:15
          duration: '6:15',
          sentiment: 'neutral' as const,
          status: 'transferred' as const,
          team: 'Quality Assurance',
          score: 68
        }
      ];
      
      setCalls(mockCalls);
    } catch (err) {
      setError('Failed to load call history');
      console.error('Call history fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      // Use mock data for filters
      console.log('Using mock filter data for frontend testing');
      
      const mockAgents = ['John Smith', 'Sarah Johnson', 'Mike Davis', 'Lisa Wilson', 'David Brown'];
      const mockTeams = ['Sales Team', 'Support Team', 'Quality Assurance'];
      
      setAgents(mockAgents);
      setTeams(mockTeams);
    } catch (err) {
      console.error('Filters fetch error:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...calls];

    if (filters.search) {
      filtered = filtered.filter(call =>
        call.agentName.toLowerCase().includes(filters.search.toLowerCase()) ||
        call.customerNumber.includes(filters.search) ||
        call.id.includes(filters.search)
      );
    }

    if (filters.agent) {
      filtered = filtered.filter(call => call.agentName === filters.agent);
    }

    if (filters.team) {
      filtered = filtered.filter(call => call.team === filters.team);
    }

    if (filters.status) {
      filtered = filtered.filter(call => call.status === filters.status);
    }

    if (filters.sentiment) {
      filtered = filtered.filter(call => call.sentiment === filters.sentiment);
    }

    if (filters.startDate) {
      filtered = filtered.filter(call => new Date(call.startTime) >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter(call => new Date(call.startTime) <= filters.endDate!);
    }

    setFilteredCalls(filtered);
  };

  const handleFilterChange = (field: keyof CallHistoryFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      agent: '',
      team: '',
      status: '',
      sentiment: '',
      startDate: null,
      endDate: null,
    });
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'missed': return 'error';
      case 'transferred': return 'warning';
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

  const exportToCSV = () => {
    const headers = ['ID', 'Agent', 'Customer', 'Start Time', 'Duration', 'Sentiment', 'Status', 'Score'];
    const csvContent = [
      headers.join(','),
      ...filteredCalls.map(call => [
        call.id,
        call.agentName,
        call.customerNumber,
        call.startTime,
        call.duration,
        call.sentiment,
        call.status,
        call.score
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'call-history.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Call History
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportToCSV}
            sx={{ mr: 1 }}
          >
            Export CSV
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchCallHistory}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filters
          </Typography>
          
          <Grid container spacing={2}>
            <Grid xs={12} md={3}>
              <TextField
                fullWidth
                label="Search"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            
            <Grid xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Agent</InputLabel>
                <Select
                  value={filters.agent}
                  label="Agent"
                  onChange={(e) => handleFilterChange('agent', e.target.value)}
                >
                  <MenuItem value="">All Agents</MenuItem>
                  {agents.map((agent) => (
                    <MenuItem key={agent} value={agent}>{agent}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Team</InputLabel>
                <Select
                  value={filters.team}
                  label="Team"
                  onChange={(e) => handleFilterChange('team', e.target.value)}
                >
                  <MenuItem value="">All Teams</MenuItem>
                  {teams.map((team) => (
                    <MenuItem key={team} value={team}>{team}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="missed">Missed</MenuItem>
                  <MenuItem value="transferred">Transferred</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Sentiment</InputLabel>
                <Select
                  value={filters.sentiment}
                  label="Sentiment"
                  onChange={(e) => handleFilterChange('sentiment', e.target.value)}
                >
                  <MenuItem value="">All Sentiments</MenuItem>
                  <MenuItem value="positive">Positive</MenuItem>
                  <MenuItem value="negative">Negative</MenuItem>
                  <MenuItem value="neutral">Neutral</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange('startDate', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange('endDate', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleClearFilters}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Call History Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Call ID</TableCell>
                  <TableCell>Agent</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Sentiment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCalls
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>{call.id}</TableCell>
                      <TableCell>{call.agentName}</TableCell>
                      <TableCell>{call.customerNumber}</TableCell>
                      <TableCell>{new Date(call.startTime).toLocaleString()}</TableCell>
                      <TableCell>{call.duration}</TableCell>
                      <TableCell>
                        <Chip
                          label={call.sentiment}
                          color={getSentimentColor(call.sentiment) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={call.status}
                          color={getStatusColor(call.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{call.score}/100</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/call-audit/${call.id}`)}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredCalls.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </CardContent>
      </Card>
    </Box>
  );
};

export default CallHistory;
