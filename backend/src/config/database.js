import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool;

export const connectDB = async () => {
  try {
    // Use DATABASE_URL for production (Render.com) or individual config for local development
    const config = process.env.DATABASE_URL ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    } : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'call_analysis_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'your_password',
    };

    pool = new Pool(config);

    // Test the connection
    const client = await pool.connect();
    logger.info('Database connected successfully');
    client.release();

    return pool;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    throw error;
  }
};

export const getPool = () => {
  if (!pool) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return pool;
};

// Query function for executing SQL queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const pool = getPool();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error:', error);
    throw error;
  }
};

export const closeDB = async () => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};
