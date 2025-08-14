import { query, connectDB } from '../config/database.js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const createTables = async () => {
  try {
    console.log('Starting database migration...');
    console.log('Connecting to database...');
    
    await connectDB();
    console.log('✅ Database connected successfully');

    console.log('Creating teams table...');
    // Create teams table
    await query(`
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Teams table created');

    console.log('Creating users table...');
    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'team_lead', 'agent')),
        team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');

    console.log('Creating password reset tokens table...');
    // Create password reset tokens table
    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Password reset tokens table created');

    console.log('Creating calls table...');
    // Create calls table
    await query(`
      CREATE TABLE IF NOT EXISTS calls (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(100) UNIQUE NOT NULL,
        agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        customer_number VARCHAR(20) NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER, -- in seconds
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'missed', 'transferred')),
        call_type VARCHAR(20) DEFAULT 'conventional' CHECK (call_type IN ('conventional', 'non_conventional')),
        audio_file_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Calls table created');

    console.log('Creating sentiment analysis table...');
    // Create sentiment analysis table
    await query(`
      CREATE TABLE IF NOT EXISTS sentiment_analysis (
        id SERIAL PRIMARY KEY,
        call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        sentiment VARCHAR(20) NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
        confidence DECIMAL(5,4) NOT NULL,
        speaker VARCHAR(20) NOT NULL CHECK (speaker IN ('agent', 'customer')),
        text_segment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Sentiment analysis table created');

    console.log('Creating call audit data table...');
    // Create call audit data table
    await query(`
      CREATE TABLE IF NOT EXISTS call_audit_data (
        id SERIAL PRIMARY KEY,
        call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        productivity_percentage DECIMAL(5,2),
        speech_percentage DECIMAL(5,2),
        silence_percentage DECIMAL(5,2),
        crosstalk_percentage DECIMAL(5,2),
        music_percentage DECIMAL(5,2),
        overall_score DECIMAL(5,2),
        keywords JSONB,
        compliance_issues JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Call audit data table created');

    console.log('Creating call transcripts table...');
    // Create call transcripts table
    await query(`
      CREATE TABLE IF NOT EXISTS call_transcripts (
        id SERIAL PRIMARY KEY,
        call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        speaker VARCHAR(20) NOT NULL CHECK (speaker IN ('agent', 'customer')),
        text TEXT NOT NULL,
        confidence DECIMAL(5,4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Call transcripts table created');

    console.log('Creating events table...');
    // Create events table
    await query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Events table created');

    console.log('Creating agent status table...');
    // Create agent status table
    await query(`
      CREATE TABLE IF NOT EXISTS agent_status (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL CHECK (status IN ('online', 'offline', 'busy', 'idle')),
        current_call_id INTEGER REFERENCES calls(id) ON DELETE SET NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);
    console.log('✅ Agent status table created');

    console.log('Creating indexes...');
    // Create indexes for better performance
    await query(`CREATE INDEX IF NOT EXISTS idx_calls_agent_id ON calls(agent_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_calls_start_time ON calls(start_time)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sentiment_call_id ON sentiment_analysis(call_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sentiment_timestamp ON sentiment_analysis(timestamp)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON call_transcripts(call_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_events_call_id ON events(call_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_agent_status_user_id ON agent_status(user_id)`);
    console.log('✅ Indexes created');

    console.log('Creating trigger function...');
    // Create updated_at trigger function
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✅ Trigger function created');

    console.log('Creating triggers...');
    // Create triggers for updated_at
    await query(`
      CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      CREATE TRIGGER update_calls_updated_at 
        BEFORE UPDATE ON calls 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      CREATE TRIGGER update_call_audit_data_updated_at 
        BEFORE UPDATE ON call_audit_data 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await query(`
      CREATE TRIGGER update_agent_status_updated_at 
        BEFORE UPDATE ON agent_status 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Triggers created');

    console.log('🎉 Database migration completed successfully!');
    logger.info('Database migration completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    logger.error('Database migration failed:', error);
    throw error;
  }
};

// Run migration if this file is executed directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('migrate.js');
if (isMainModule) {
  createTables()
    .then(() => {
      console.log('✅ Migration completed successfully');
      logger.info('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export { createTables };
