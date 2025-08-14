import pkg from 'pg';
const { Pool } = pkg;
import { logger } from '../utils/logger.js';

// Create connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Test the connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Connect to database
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    logger.info('Database connection established successfully');
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    throw error; // Throw error instead of exiting process
  }
};

// Query function
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
};

// Get client for transactions
export const getClient = () => {
  return pool.connect();
};

// Close pool
export const closePool = async () => {
  await pool.end();
  logger.info('Database pool closed');
};

export default pool;
