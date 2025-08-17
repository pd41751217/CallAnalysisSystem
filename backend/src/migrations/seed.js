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
      return;
    }

    if (testError) {
      logger.error('Connection test failed:', testError.message);
      return;
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

    // Create sample team
    try {
      const { data: sampleTeamData, error: sampleTeamError } = await supabase
        .from('teams')
        .insert({
          name: 'Sales Team',
          description: 'Sales and customer acquisition team'
        })
        .select()
        .single();

      if (sampleTeamError) {
        if (sampleTeamError.code === '23505') { // Unique constraint violation
          logger.info('Sales team already exists, skipping...');
        } else {
          throw sampleTeamError;
        }
      } else {
        logger.info('Sales team created successfully');
      }
    } catch (error) {
      logger.error('Error creating sales team:', error);
      throw error;
    }

    // Create sample agent
    try {
      const hashedPassword = await bcrypt.hash('agent123', 12);
      
      const { data: agentData, error: agentError } = await supabase
        .from('users')
        .insert({
          name: 'John Smith',
          email: 'john.smith@callanalysis.com',
          password_hash: hashedPassword,
          role: 'agent',
          team_id: defaultTeam.id,
          status: 'offline'
        })
        .select()
        .single();

      if (agentError) {
        if (agentError.code === '23505') { // Unique constraint violation
          logger.info('Sample agent already exists, skipping...');
        } else {
          throw agentError;
        }
      } else {
        logger.info('Sample agent created successfully');
      }
    } catch (error) {
      logger.error('Error creating sample agent:', error);
      throw error;
    }

    logger.info('Data seeding completed successfully!');
    logger.info('');
    logger.info('Default credentials:');
    logger.info('Admin: admin@callanalysis.com / admin123');
    logger.info('Test: test@callanalysis.com / test123');
    logger.info('Agent: john.smith@callanalysis.com / agent123');

  } catch (error) {
    logger.error('Data seeding failed:', error);
    throw error;
  }
};

// Check if this file is being run directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     process.argv[1]?.includes('migrate-simple.js') ||
                     process.argv[1]?.endsWith('migrate-simple.js');

if (isMainModule) {
  seedData()
    .then(() => {
      logger.info('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

export default seedData;
