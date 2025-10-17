import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  Grid,
  Avatar,
  Badge,
} from '@mui/material';
import {
  Mic as MicIcon,
  VolumeUp as SpeakerIcon,
  RecordVoiceOver as TranscriptionIcon,
} from '@mui/icons-material';
import { useSocket } from '../../contexts/SocketContext';

interface TranscriptionData {
  id: string;
  callId: string;
  text: string;
  audioType: 'mic' | 'speaker';
  type: 'partial' | 'final';
  timestamp: string;
  confidence?: number;
}

interface TranscriptionDisplayProps {
  callId: string;
  onTranscriptionUpdate?: (transcription: TranscriptionData) => void;
}

const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ 
  callId, 
  onTranscriptionUpdate 
}) => {
  const [micTranscriptions, setMicTranscriptions] = useState<TranscriptionData[]>([]);
  const [speakerTranscriptions, setSpeakerTranscriptions] = useState<TranscriptionData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (socket && callId) {
      // Join transcription monitoring room
      socket.emit('join_transcription_monitoring', { callId });
      setIsMonitoring(true);

      // Listen for transcription updates
      socket.on('transcription_update', handleTranscriptionUpdate);

      return () => {
        socket.emit('leave_transcription_monitoring', { callId });
        socket.off('transcription_update');
        setIsMonitoring(false);
      };
    }
  }, [socket, callId]);

  const handleTranscriptionUpdate = (data: TranscriptionData) => {
    if (data.callId !== callId) return;

    const transcription: TranscriptionData = {
      id: `${data.callId}-${data.audioType}-${Date.now()}`,
      callId: data.callId,
      text: data.text,
      audioType: data.audioType,
      type: data.type,
      timestamp: data.timestamp,
      confidence: data.confidence,
    };

    if (data.audioType === 'mic') {
      setMicTranscriptions(prev => {
        const newTranscriptions = [...prev, transcription];
        // Keep only the last 50 transcriptions
        return newTranscriptions.slice(-50);
      });
    } else if (data.audioType === 'speaker') {
      setSpeakerTranscriptions(prev => {
        const newTranscriptions = [...prev, transcription];
        // Keep only the last 50 transcriptions
        return newTranscriptions.slice(-50);
      });
    }

    // Call the callback if provided
    if (onTranscriptionUpdate) {
      onTranscriptionUpdate(transcription);
    }
  };

  const getAudioTypeIcon = (audioType: 'mic' | 'speaker') => {
    return audioType === 'mic' ? <MicIcon /> : <SpeakerIcon />;
  };

  const getAudioTypeColor = (audioType: 'mic' | 'speaker') => {
    return audioType === 'mic' ? 'primary' : 'secondary';
  };

  const getAudioTypeLabel = (audioType: 'mic' | 'speaker') => {
    return audioType === 'mic' ? 'Agent (Mic)' : 'Customer (Speaker)';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const renderTranscriptionList = (transcriptions: TranscriptionData[], audioType: 'mic' | 'speaker') => (
    <Paper elevation={1} sx={{ maxHeight: 400, overflow: 'auto' }}>
      <Box sx={{ p: 2, bgcolor: audioType === 'mic' ? 'primary.light' : 'secondary.light' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: audioType === 'mic' ? 'primary.main' : 'secondary.main' }}>
            {getAudioTypeIcon(audioType)}
          </Avatar>
          <Typography variant="h6" color="white">
            {getAudioTypeLabel(audioType)}
          </Typography>
          <Badge badgeContent={transcriptions.length} color="error" />
        </Box>
      </Box>
      <List>
        {transcriptions.map((transcription, index) => (
          <React.Fragment key={transcription.id}>
            <ListItem>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                      {transcription.text}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip
                        label={transcription.type}
                        size="small"
                        color={transcription.type === 'final' ? 'success' : 'warning'}
                        variant="outlined"
                      />
                      {transcription.confidence && (
                        <Chip
                          label={`${Math.round(transcription.confidence * 100)}%`}
                          size="small"
                          color={transcription.confidence > 0.8 ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </Box>
                }
                secondary={
                  <Typography variant="caption" color="textSecondary">
                    {formatTimestamp(transcription.timestamp)}
                  </Typography>
                }
              />
            </ListItem>
            {index < transcriptions.length - 1 && <Divider />}
          </React.Fragment>
        ))}
        {transcriptions.length === 0 && (
          <ListItem>
            <ListItemText
              primary="No transcriptions yet"
              secondary={`${getAudioTypeLabel(audioType)} transcriptions will appear here`}
            />
          </ListItem>
        )}
      </List>
    </Paper>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <TranscriptionIcon color="primary" />
        <Typography variant="h5">
          Live Transcription - Call {callId}
        </Typography>
        <Chip
          label={isMonitoring ? 'Monitoring' : 'Not Monitoring'}
          color={isMonitoring ? 'success' : 'error'}
          variant="outlined"
        />
      </Box>

      <Grid container spacing={3}>
        {/* Agent (Mic) Transcriptions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Agent Transcriptions
              </Typography>
              {renderTranscriptionList(micTranscriptions, 'mic')}
            </CardContent>
          </Card>
        </Grid>

        {/* Customer (Speaker) Transcriptions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customer Transcriptions
              </Typography>
              {renderTranscriptionList(speakerTranscriptions, 'speaker')}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Combined View */}
      <Box sx={{ mt: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Combined Transcription Timeline
            </Typography>
            <Paper elevation={1} sx={{ maxHeight: 400, overflow: 'auto' }}>
              <List>
                {[...micTranscriptions, ...speakerTranscriptions]
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .map((transcription, index) => (
                    <React.Fragment key={transcription.id}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Avatar 
                                size="small" 
                                sx={{ 
                                  bgcolor: transcription.audioType === 'mic' ? 'primary.main' : 'secondary.main',
                                  width: 24,
                                  height: 24
                                }}
                              >
                                {getAudioTypeIcon(transcription.audioType)}
                              </Avatar>
                              <Typography variant="body1" sx={{ flexGrow: 1 }}>
                                {transcription.text}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Chip
                                  label={getAudioTypeLabel(transcription.audioType)}
                                  size="small"
                                  color={getAudioTypeColor(transcription.audioType)}
                                  variant="outlined"
                                />
                                <Chip
                                  label={transcription.type}
                                  size="small"
                                  color={transcription.type === 'final' ? 'success' : 'warning'}
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="textSecondary">
                              {formatTimestamp(transcription.timestamp)}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < [...micTranscriptions, ...speakerTranscriptions].length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                {micTranscriptions.length === 0 && speakerTranscriptions.length === 0 && (
                  <ListItem>
                    <ListItemText
                      primary="No transcriptions available"
                      secondary="Transcriptions will appear here as they are generated"
                    />
                  </ListItem>
                )}
              </List>
            </Paper>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default TranscriptionDisplay;
