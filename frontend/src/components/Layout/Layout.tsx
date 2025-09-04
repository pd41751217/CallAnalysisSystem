import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  History as HistoryIcon,
  People as PeopleIcon,
  Analytics as AnalyticsIcon,
  Assessment as AssessmentIcon,
  Phone as PhoneIcon,
  Notifications as NotificationsIcon,
  AccountCircle,
  Logout,
  Settings,
  Rule as RuleIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Call History', icon: <HistoryIcon />, path: '/call-history' },
  { text: 'Live Analysis', icon: <AnalyticsIcon />, path: '/live-analysis' },
  { text: 'Overview', icon: <AssessmentIcon />, path: '/overview' },
  { text: 'Calling Rules', icon: <RuleIcon />, path: '/calling-rules' },
  { text: 'User Management', icon: <PeopleIcon />, path: '/user-management' },
];

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleProfileMenuClose();
  };

  const drawer = (
    <Box sx={{ height: '100%', background: 'linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%)' }}>
      <Box 
        sx={{ 
          p: 3, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 2,
          background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            animation: 'pulse 3s infinite'
          }}
        />
        
        <Box
          sx={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PhoneIcon sx={{ fontSize: 32, color: 'white' }} />
        </Box>
        <Typography 
          variant="h6" 
          noWrap 
          component="div"
          sx={{ 
            fontWeight: 600,
            background: 'rgba(255, 255, 255, 0.9)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Call Analysis
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(233, 30, 99, 0.1)' }} />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1,
                borderRadius: 2,
                mb: 0.5,
                transition: 'all 0.3s ease',
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #e91e63, #9c27b0)',
                  color: 'white',
                  boxShadow: '0 4px 15px rgba(233, 30, 99, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #e91e63, #9c27b0)',
                    transform: 'translateX(5px)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
                '&:hover': {
                  background: 'rgba(233, 30, 99, 0.1)',
                  transform: 'translateX(5px)',
                },
              }}
            >
              <ListItemIcon sx={{ 
                color: location.pathname === item.path ? 'white' : '#4a5568',
                transition: 'color 0.3s ease'
              }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(233, 30, 99, 0.1)',
          boxShadow: '0 4px 20px rgba(233, 30, 99, 0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="primary"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { sm: 'none' },
              background: 'rgba(233, 30, 99, 0.1)',
              '&:hover': {
                background: 'rgba(233, 30, 99, 0.2)',
              }
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontWeight: 600,
              color: '#2d3748'
            }}
          >
            {menuItems.find(item => item.path === location.pathname)?.text || 'Call Analysis System'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={isConnected ? 'Connected' : 'Disconnected'}
              color={isConnected ? 'success' : 'error'}
              size="small"
              variant="outlined"
              sx={{
                borderColor: isConnected ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)',
                color: isConnected ? '#4caf50' : '#f44336',
                fontWeight: 600
              }}
            />
            
            <IconButton 
              sx={{
                background: 'rgba(233, 30, 99, 0.1)',
                color: '#e91e63',
                '&:hover': {
                  background: 'rgba(233, 30, 99, 0.2)',
                }
              }}
            >
              <Badge badgeContent={4} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            
            <IconButton
              onClick={handleProfileMenuOpen}
              sx={{
                background: 'linear-gradient(135deg, #e91e63, #9c27b0)',
                color: 'white',
                '&:hover': {
                  background: 'linear-gradient(135deg, #c2185b, #7b1fa2)',
                }
              }}
            >
              <Avatar sx={{ 
                width: 32, 
                height: 32,
                background: 'transparent',
                color: 'white',
                fontWeight: 600
              }}>
                {user?.name?.charAt(0) || 'U'}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        onClick={handleProfileMenuClose}
      >
        <MenuItem onClick={() => navigate('/profile')}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => navigate('/settings')}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Layout;
