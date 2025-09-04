import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  FormControlLabel,
  Switch,
  Slider,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { callingRulesService } from '../../services/callingRulesService';
import type { CallingRule, CreateCallingRuleData } from '../../services/callingRulesService';

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
      id={`calling-rules-tabpanel-${index}`}
      aria-labelledby={`calling-rules-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const CallingRuleManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [rules, setRules] = useState<CallingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CallingRule | null>(null);
  const [formData, setFormData] = useState<CreateCallingRuleData>({
    title: '',
    description: '',
    dos: true,
    weight: 50
  });
  
  // Menu states
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRule, setSelectedRule] = useState<CallingRule | null>(null);

  // Load rules based on active tab
  const loadRules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const ruleType = activeTab === 0 ? 'do' : 'dont';
      const fetchedRules = await callingRulesService.getRulesByType(ruleType);
      setRules(fetchedRules);
    } catch (err: any) {
      setError(err.message || 'Failed to load calling rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [activeTab]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleOpenDialog = (rule?: CallingRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        title: rule.title,
        description: rule.description,
        dos: rule.dos,
        weight: rule.weight
      });
    } else {
      setEditingRule(null);
      setFormData({
        title: '',
        description: '',
        dos: activeTab === 0, // Set based on current tab
        weight: 50
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setFormData({
      title: '',
      description: '',
      dos: true,
      weight: 50
    });
  };

  const handleSubmit = async () => {
    try {
      // Validate form data
      const errors = callingRulesService.validateRuleData(formData);
      if (errors.length > 0) {
        setError(errors.join(', '));
        return;
      }

      if (editingRule) {
        // Update existing rule
        await callingRulesService.updateRule(editingRule.id, formData);
        setSuccess('Calling rule updated successfully');
      } else {
        // Create new rule
        await callingRulesService.createRule(formData);
        setSuccess('Calling rule created successfully');
      }

      handleCloseDialog();
      loadRules();
    } catch (err: any) {
      setError(err.message || 'Failed to save calling rule');
    }
  };

  const handleDelete = async (rule: CallingRule) => {
    if (window.confirm(`Are you sure you want to delete "${rule.title}"?`)) {
      try {
        await callingRulesService.deleteRule(rule.id);
        setSuccess('Calling rule deleted successfully');
        loadRules();
      } catch (err: any) {
        setError(err.message || 'Failed to delete calling rule');
      }
    }
    handleCloseMenu();
  };

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, rule: CallingRule) => {
    setAnchorEl(event.currentTarget);
    setSelectedRule(rule);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setSelectedRule(null);
  };

  const handleEdit = () => {
    if (selectedRule) {
      handleOpenDialog(selectedRule);
    }
    handleCloseMenu();
  };

  const handleDeleteFromMenu = () => {
    if (selectedRule) {
      handleDelete(selectedRule);
    }
  };

  const getRuleTypeIcon = (isDos: boolean) => {
    return isDos ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />;
  };

  const getWeightColor = (weight: number) => {
    if (weight >= 80) return 'success';
    if (weight >= 60) return 'info';
    if (weight >= 40) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="calling rules tabs" sx={{ minHeight: 'auto' }}>
          <Tab 
            label="Do's" 
            icon={<CheckCircleIcon />} 
            iconPosition="start"
            sx={{ 
              textTransform: 'none', 
              fontWeight: 600,
              minHeight: 'auto',
              py: 1,
              px: 2
            }}
          />
          <Tab 
            label="Don'ts" 
            icon={<CancelIcon />} 
            iconPosition="start"
            sx={{ 
              textTransform: 'none', 
              fontWeight: 600,
              minHeight: 'auto',
              py: 1,
              px: 2
            }}
          />
        </Tabs>
      </Box>

        <TabPanel value={activeTab} index={0}>
          <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" color="success.main" sx={{ fontWeight: 600 }}>
              <CheckCircleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Do's - Positive Guidelines
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: 'linear-gradient(135deg, #4caf50, #66bb6a)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #388e3c, #4caf50)',
                }
              }}
            >
              Add Do Rule
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: 1.5,
              width: '100%',
              maxWidth: '100%'
            }}>
              {rules.map((rule) => (
                <Box key={rule.id} sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                  <Card sx={{ height: '100%', position: 'relative', maxWidth: '100%', overflow: 'hidden' }}>
                    <CardContent sx={{ maxWidth: '100%', overflow: 'hidden', wordWrap: 'break-word' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getRuleTypeIcon(rule.dos)}
                          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, wordBreak: 'break-word', overflow: 'hidden' }}>
                            {rule.title}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenMenu(e, rule)}
                          sx={{ color: 'text.secondary' }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordBreak: 'break-word', overflow: 'hidden' }}>
                        {rule.description}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip
                          icon={<TrendingUpIcon />}
                          label={`Weight: ${rule.weight}`}
                          color={getWeightColor(rule.weight) as any}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(rule.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              ))}
              
              {rules.length === 0 && !loading && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <CheckCircleIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No Do Rules Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create your first positive guideline to help agents succeed
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" color="error.main" sx={{ fontWeight: 600 }}>
              <CancelIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Don'ts - Prohibited Actions
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{
                background: 'linear-gradient(135deg, #f44336, #ef5350)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #d32f2f, #f44336)',
                }
              }}
            >
              Add Don't Rule
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: 1.5,
              width: '100%',
              maxWidth: '100%'
            }}>
              {rules.map((rule) => (
                <Box key={rule.id} sx={{ maxWidth: '100%', overflow: 'hidden' }}>
                  <Card sx={{ height: '100%', position: 'relative', maxWidth: '100%', overflow: 'hidden' }}>
                    <CardContent sx={{ maxWidth: '100%', overflow: 'hidden', wordWrap: 'break-word' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getRuleTypeIcon(rule.dos)}
                          <Typography variant="h6" component="h3" sx={{ fontWeight: 600, wordBreak: 'break-word', overflow: 'hidden' }}>
                            {rule.title}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => handleOpenMenu(e, rule)}
                          sx={{ color: 'text.secondary' }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordBreak: 'break-word', overflow: 'hidden' }}>
                        {rule.description}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip
                          icon={<TrendingUpIcon />}
                          label={`Weight: ${rule.weight}`}
                          color={getWeightColor(rule.weight) as any}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary">
                          {new Date(rule.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              ))}
              
              {rules.length === 0 && !loading && (
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <CancelIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No Don't Rules Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create your first prohibition to prevent unwanted behaviors
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
          </Box>
        </TabPanel>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRule ? 'Edit Calling Rule' : 'Create New Calling Rule'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Title"
              fullWidth
              variant="outlined"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <TextField
              margin="dense"
              label="Description"
              fullWidth
              multiline
              rows={3}
              variant="outlined"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormControlLabel
                                 control={
                   <Switch
                     checked={formData.dos}
                     onChange={(_e) => setFormData({ ...formData, dos: _e.target.checked })}
                     color="primary"
                   />
                 }
                 label={formData.dos ? "Do Rule (Positive Guideline)" : "Don't Rule (Prohibition)"}
              />
            </FormControl>
            
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>
                Weight: {formData.weight}
              </Typography>
              <Slider
                value={formData.weight}
                                 onChange={(_e, value) => setFormData({ ...formData, weight: value as number })}
                min={0}
                max={100}
                step={1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 25, label: '25' },
                  { value: 50, label: '50' },
                  { value: 75, label: '75' },
                  { value: 100, label: '100' },
                ]}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Higher weight indicates more importance
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingRule ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteFromMenu} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Snackbars */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CallingRuleManagement;
