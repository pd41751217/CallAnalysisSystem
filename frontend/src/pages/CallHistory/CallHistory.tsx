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
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';


interface Call {
  case_id: string;
  agent: string;
  customer: string;
  start_time: string;
  duration: number;
  file_path?: string;
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
  const [agents] = useState<string[]>([]);
  const [teams] = useState<string[]>([]);
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
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  

  useEffect(() => {
    fetchCallHistory();
  }, []);

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [audioElement]);

  useEffect(() => {
    applyFilters();
  }, [calls, filters]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {};
      if (token && token !== 'null' && token !== 'undefined') {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const resp = await fetch('/api/calls/history-all', { headers });
      if (resp.status === 401) {
        setError('Authentication required. Please log in and try again.');
        setCalls([]);
        return;
      }
      if (!resp.ok) throw new Error('Failed to fetch call history');
      const json = await resp.json();
      const items = (json?.items || []) as Call[];
      setCalls(items);
    } catch (err) {
      setError('Failed to load call history');
      console.error('Call history fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // (reserved) fetchFilters not used yet

  const applyFilters = () => {
    let filtered = [...calls];

    if (filters.search) {
      filtered = filtered.filter(call =>
        call.agent.toLowerCase().includes(filters.search.toLowerCase()) ||
        call.customer.includes(filters.search) ||
        call.case_id.includes(filters.search)
      );
    }

    if (filters.agent) {
      filtered = filtered.filter(call => call.agent === filters.agent);
    }

    if (filters.team) {
      // team not part of call_history; skip or extend schema later
    }

    if (filters.status) {
      // status not part of call_history; skip or extend schema later
    }

    if (filters.sentiment) {
      // sentiment not part of call_history; skip or extend schema later
    }

    if (filters.startDate) {
      filtered = filtered.filter(call => new Date(call.start_time) >= filters.startDate!);
    }

    if (filters.endDate) {
      filtered = filtered.filter(call => new Date(call.start_time) <= filters.endDate!);
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

  // Audio playback functions
  const handlePlayAudio = async (callId: string) => {
    try {
      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      // If the same audio is already playing, just pause it
      if (playingAudio === callId) {
        setPlayingAudio(null);
        setAudioElement(null);
        return;
      }

      // Create new audio element
      const audio = new Audio(`/api/calls/audio/${callId}`);
      setAudioElement(audio);
      setPlayingAudio(callId);

      // Handle audio events
      audio.onended = () => {
        setPlayingAudio(null);
        setAudioElement(null);
      };

      audio.onerror = () => {
        setError('Failed to load audio file');
        setPlayingAudio(null);
        setAudioElement(null);
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setError('Failed to play audio');
      setPlayingAudio(null);
      setAudioElement(null);
    }
  };

  const handleDownloadAudio = async (callId: string) => {
    try {
      const response = await fetch(`/api/calls/audio/${callId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download audio file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call_${callId}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading audio:', error);
      setError('Failed to download audio file');
    }
  };

  // Status/Sentiment not in call_history schema currently

  const exportToCSV = () => {
    const headers = ['Case ID', 'Agent', 'Customer', 'Start Time', 'Duration (sec)', 'File Path'];
    const csvContent = [
      headers.join(','),
      ...filteredCalls.map(call => [
        call.case_id,
        call.agent,
        call.customer,
        call.start_time,
        String(call.duration ?? 0),
        call.file_path || ''
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
            <Grid item xs={12} md={3}>
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
            
            <Grid item xs={12} md={3}>
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
            
            <Grid item xs={12} md={3}>
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
            
            <Grid item xs={12} md={3}>
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
            
            <Grid item xs={12} md={3}>
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
            
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={filters.startDate}
                  onChange={(date) => handleFilterChange('startDate', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={filters.endDate}
                  onChange={(date) => handleFilterChange('endDate', date)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={3}>
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
                  <TableCell>Case ID</TableCell>
                  <TableCell>Agent</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>Duration (sec)</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCalls
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((call) => (
                    <TableRow key={call.case_id}>
                      <TableCell>{call.case_id}</TableCell>
                      <TableCell>{call.agent}</TableCell>
                      <TableCell>{call.customer}</TableCell>
                      <TableCell>{new Date(call.start_time).toLocaleString()}</TableCell>
                      <TableCell>{call.duration ?? 0}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {call.file_path && (
                            <>
                              <IconButton
                                size="small"
                                onClick={() => handlePlayAudio(call.case_id)}
                                title={playingAudio === call.case_id ? "Pause Audio" : "Play Audio"}
                                color={playingAudio === call.case_id ? "primary" : "default"}
                              >
                                {playingAudio === call.case_id ? <PauseIcon /> : <PlayIcon />}
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadAudio(call.case_id)}
                                title="Download Audio"
                              >
                                <DownloadIcon />
                              </IconButton>
                            </>
                          )}
                        </Box>
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
