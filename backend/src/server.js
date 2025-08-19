import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import callRoutes from './routes/calls.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { logger } from './utils/logger.js';

// Import socket handlers
import { setupSocketHandlers } from './socket/socketHandlers.js';
import { setSocketIO } from './utils/dashboardBroadcast.js';

// Import audio streaming server
import AudioStreamServer from './socket/audioStreamServer.js';
import WebRTCServer from './webrtc/webrtcServer.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CORS_ORIGIN || "http://localhost:5173",
      "https://callanalysissystem.onrender.com",
      "https://callanalysissystem-frontend.onrender.com"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available to routes
app.set('io', io);

// Initialize servers
const audioStreamServer = new AudioStreamServer(io);
const webrtcServer = new WebRTCServer(io);

// Make servers available to routes
app.set('audioStreamServer', audioStreamServer);
app.set('webrtcServer', webrtcServer);

// Test Supabase connection
import { testSupabaseConnection } from './config/supabase.js';
testSupabaseConnection().then((isConnected) => {
  if (isConnected) {
    logger.info('Supabase connection successful');
  } else {
    logger.error('Failed to connect to Supabase');
    logger.info('Server will start without database connection');
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = [
  process.env.CORS_ORIGIN || "http://localhost:5173", 
  "http://localhost:3000", 
  "https://callanalysissystem.onrender.com",
  "https://callanalysissystem-frontend.onrender.com",
  "null"
];

// Filter out undefined values
const validOrigins = allowedOrigins.filter(origin => origin && origin !== "null");

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (validOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting removed for production deployment

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware removed for production deployment

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Call Analysis System API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      users: '/api/users',
      calls: '/api/calls'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Test API endpoint
app.get('/api/test', (req, res) => {
  res.status(200).json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    cors: 'enabled'
  });
});

// Debug middleware removed for production deployment

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/calls', callRoutes);

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Set Socket.IO instance for dashboard broadcasting
setSocketIO(io);

// Setup WebRTC handlers
// The WebRTC server handles its own connections internally
// No need to manually call handleConnection

// Start audio streaming server
audioStreamServer.start();

// User status is managed manually through login/logout/recording events

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  audioStreamServer.stop();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  audioStreamServer.stop();
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;
