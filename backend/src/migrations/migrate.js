import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const createTables = async () => {
  try {
    logger.info('Attempting to create tables...');

    // Create teams table
    const { error: teamsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS teams (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (teamsError) {
      logger.warn('Could not create teams table (might already exist):', teamsError.message);
    } else {
      logger.info('Teams table created successfully');
    }

    // Create users table
    const { error: usersError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'agent',
          team_id INTEGER REFERENCES teams(id),
          status VARCHAR(50) DEFAULT 'active',
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (usersError) {
      logger.warn('Could not create users table (might already exist):', usersError.message);
    } else {
      logger.info('Users table created successfully');
    }

    // Create calls table
    const { error: callsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS calls (
          id SERIAL PRIMARY KEY,
          call_id VARCHAR(255) UNIQUE NOT NULL,
          user_id INTEGER REFERENCES users(id),
          status VARCHAR(50) DEFAULT 'pending',
          duration INTEGER,
          analysis_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (callsError) {
      logger.warn('Could not create calls table (might already exist):', callsError.message);
    } else {
      logger.info('Calls table created successfully');
    }

    // Create call_analysis table
    const { error: analysisError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS call_analysis (
          id SERIAL PRIMARY KEY,
          call_id INTEGER REFERENCES calls(id),
          productivity_score DECIMAL(5,2),
          speech_percentage DECIMAL(5,2),
          silence_percentage DECIMAL(5,2),
          crosstalk_percentage DECIMAL(5,2),
          music_percentage DECIMAL(5,2),
          analysis_summary TEXT,
          detailed_results JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (analysisError) {
      logger.warn('Could not create call_analysis table (might already exist):', analysisError.message);
    } else {
      logger.info('Call analysis table created successfully');
    }

    // Create user_sessions table
    const { error: sessionsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          session_token VARCHAR(500) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (sessionsError) {
      logger.warn('Could not create user_sessions table (might already exist):', sessionsError.message);
    } else {
      logger.info('User sessions table created successfully');
    }

    // Create password_reset_tokens table
    const { error: tokensError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          token VARCHAR(255) UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `
    });

    if (tokensError) {
      logger.warn('Could not create password_reset_tokens table (might already exist):', tokensError.message);
    } else {
      logger.info('Password reset tokens table created successfully');
    }

    logger.info('Table creation completed');
    return true;

  } catch (error) {
    logger.error('Error creating tables:', error);
    return false;
  }
};

const seedData = async () => {
  try {
    logger.info('Starting data seeding...');

    // Test connection first
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (testError && testError.code === 'PGRST205') {
      logger.error('Tables do not exist. Please run the SQL schema first.');
      logger.info('Run the following SQL in your Supabase SQL Editor:');
      logger.info('1. Copy the contents of backend/supabase-schema.sql');
      logger.info('2. Paste and execute in Supabase SQL Editor');
      logger.info('3. Then run this migration script again');
      return false;
    }

    if (testError) {
      logger.error('Connection test failed:', testError.message);
      return false;
    }

    logger.info('Connection successful, proceeding with data seeding...');

    // Create default team
    let defaultTeam;
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: 'Default Team',
          description: 'Default team for the system'
        })
        .select()
        .single();

      if (teamError) {
        if (teamError.code === '23505') { // Unique constraint violation
          logger.info('Default team already exists, fetching existing team...');
          const { data: existingTeam, error: fetchError } = await supabase
            .from('teams')
            .select('*')
            .eq('name', 'Default Team')
            .single();
          
          if (fetchError) {
            throw fetchError;
          }
          defaultTeam = existingTeam;
        } else {
          throw teamError;
        }
      } else {
        defaultTeam = teamData;
        logger.info('Default team created successfully');
      }
    } catch (error) {
      logger.error('Error creating/fetching default team:', error);
      throw error;
    }

    // Create admin user
    try {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      const { data: adminData, error: adminError } = await supabase
        .from('users')
        .insert({
          name: 'Admin User',
          email: 'admin@callanalysis.com',
          password_hash: hashedPassword,
          role: 'admin',
          team_id: defaultTeam.id,
          status: 'offline'
        })
        .select()
        .single();

      if (adminError) {
        if (adminError.code === '23505') { // Unique constraint violation
          logger.info('Admin user already exists, skipping...');
        } else {
          throw adminError;
        }
      } else {
        logger.info('Admin user created successfully');
      }
    } catch (error) {
      logger.error('Error creating admin user:', error);
      throw error;
    }

    // Create test user
    try {
      const hashedPassword = await bcrypt.hash('test123', 12);
      
      const { data: testUserData, error: testUserError } = await supabase
        .from('users')
        .insert({
          name: 'Test User',
          email: 'test@callanalysis.com',
          password_hash: hashedPassword,
          role: 'agent',
          team_id: defaultTeam.id,
          status: 'offline'
        })
        .select()
        .single();

      if (testUserError) {
        if (testUserError.code === '23505') { // Unique constraint violation
          logger.info('Test user already exists, skipping...');
        } else {
          throw testUserError;
        }
      } else {
        logger.info('Test user created successfully');
      }
    } catch (error) {
      logger.error('Error creating test user:', error);
      throw error;
    }

    logger.info('Data seeding completed successfully!');
    logger.info('');
    logger.info('Default credentials:');
    logger.info('Admin: admin@callanalysis.com / admin123');
    logger.info('Test: test@callanalysis.com / test123');

    return true;

  } catch (error) {
    logger.error('Data seeding failed:', error);
    throw error;
  }
};

const runMigration = async () => {
  try {
    logger.info('Starting migration process...');

    // Try to create tables first
    const tablesCreated = await createTables();
    
    if (!tablesCreated) {
      logger.warn('Table creation failed or not supported. Please create tables manually.');
      logger.info('You can run the SQL schema manually in Supabase SQL Editor.');
    }

    // Seed data
    const dataSeeded = await seedData();
    
    if (dataSeeded) {
      logger.info('Migration completed successfully!');
      return true;
    } else {
      logger.error('Migration failed');
      return false;
    }

  } catch (error) {
    logger.error('Migration process failed:', error);
    return false;
  }
};

// Check if this file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.includes('migrate.js') ||
                     process.argv[1]?.endsWith('migrate.js');

if (isMainModule) {
  runMigration()
    .then((success) => {
      if (success) {
        logger.info('Migration completed successfully');
        process.exit(0);
      } else {
        logger.error('Migration failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export default runMigration;
