import { connectDB, getPool } from '../config/database.js';
import { logger } from '../utils/logger.js';

const createTables = async () => {
  const pool = getPool();
  
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'agent',
        team VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Calls table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calls (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER REFERENCES users(id),
        agent_name VARCHAR(255) NOT NULL,
        customer_number VARCHAR(50) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration VARCHAR(20),
        sentiment VARCHAR(50),
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        team VARCHAR(100),
        score INTEGER,
        recording_url VARCHAR(500),
        transcript TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Call analysis table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS call_analysis (
        id SERIAL PRIMARY KEY,
        call_id INTEGER REFERENCES calls(id),
        sentiment_score DECIMAL(3,2),
        emotion_data JSONB,
        keywords TEXT[],
        compliance_score INTEGER,
        quality_score INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Real-time metrics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS real_time_metrics (
        id SERIAL PRIMARY KEY,
        total_agents INTEGER DEFAULT 0,
        active_agents INTEGER DEFAULT 0,
        total_team_leads INTEGER DEFAULT 0,
        live_calls INTEGER DEFAULT 0,
        avg_call_duration VARCHAR(20),
        avg_sentiment_score DECIMAL(3,2),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    logger.info('Database tables created successfully');
  } catch (error) {
    logger.error('Error creating tables:', error);
    throw error;
  }
};

const runMigrations = async () => {
  try {
    await connectDB();
    await createTables();
    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
