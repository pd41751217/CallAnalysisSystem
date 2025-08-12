import { query, connectDB } from '../config/database.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    // Create teams
    const teams = [
      { name: 'Sales Team', description: 'Primary sales and customer acquisition team' },
      { name: 'Support Team', description: 'Customer support and technical assistance' },
      { name: 'Quality Assurance', description: 'Call quality monitoring and improvement' },
      { name: 'Management', description: 'Team leads and management' }
    ];

    for (const team of teams) {
      await query(
        'INSERT INTO teams (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [team.name, team.description]
      );
    }

    // Get team IDs
    const teamResults = await query('SELECT id, name FROM teams');
    const teamMap = {};
    teamResults.rows.forEach(team => {
      teamMap[team.name] = team.id;
    });

    // Create users with hashed passwords
    const users = [
      {
        name: 'Admin User',
        email: 'admin@callanalysis.com',
        password: 'admin123',
        role: 'admin',
        team_id: teamMap['Management']
      },
      {
        name: 'John Smith',
        email: 'john.smith@callanalysis.com',
        password: 'password123',
        role: 'team_lead',
        team_id: teamMap['Sales Team']
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@callanalysis.com',
        password: 'password123',
        role: 'team_lead',
        team_id: teamMap['Support Team']
      },
      {
        name: 'Mike Davis',
        email: 'mike.davis@callanalysis.com',
        password: 'password123',
        role: 'agent',
        team_id: teamMap['Sales Team']
      },
      {
        name: 'Lisa Wilson',
        email: 'lisa.wilson@callanalysis.com',
        password: 'password123',
        role: 'agent',
        team_id: teamMap['Sales Team']
      },
      {
        name: 'David Brown',
        email: 'david.brown@callanalysis.com',
        password: 'password123',
        role: 'agent',
        team_id: teamMap['Support Team']
      },
      {
        name: 'Emma Taylor',
        email: 'emma.taylor@callanalysis.com',
        password: 'password123',
        role: 'agent',
        team_id: teamMap['Support Team']
      },
      {
        name: 'Alex Rodriguez',
        email: 'alex.rodriguez@callanalysis.com',
        password: 'password123',
        role: 'agent',
        team_id: teamMap['Quality Assurance']
      }
    ];

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      await query(
        'INSERT INTO users (name, email, password_hash, role, team_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
        [user.name, user.email, hashedPassword, user.role, user.team_id]
      );
    }

    // Get user IDs for creating sample data
    const userResults = await query('SELECT id, email FROM users WHERE role = $1', ['agent']);
    const agentIds = userResults.rows.map(user => user.id);

    // Create sample calls
    const sampleCalls = [];
    const callStatuses = ['completed', 'completed', 'completed', 'active', 'missed'];
    const callTypes = ['conventional', 'non_conventional'];
    const customerNumbers = ['+1234567890', '+1987654321', '+1555123456', '+1444333222', '+1777888999'];

    for (let i = 0; i < 50; i++) {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - Math.floor(Math.random() * 168)); // Random time in last week
      startTime.setMinutes(startTime.getMinutes() - Math.floor(Math.random() * 60));
      
      const duration = Math.floor(Math.random() * 1800) + 60; // 1-30 minutes
      const endTime = new Date(startTime.getTime() + duration * 1000);
      
      const call = {
        call_id: `CALL-${Date.now()}-${i}`,
        agent_id: agentIds[Math.floor(Math.random() * agentIds.length)],
        customer_number: customerNumbers[Math.floor(Math.random() * customerNumbers.length)],
        start_time: startTime,
        end_time: callStatuses[Math.floor(Math.random() * callStatuses.length)] === 'active' ? null : endTime,
        duration: callStatuses[Math.floor(Math.random() * callStatuses.length)] === 'active' ? null : duration,
        status: callStatuses[Math.floor(Math.random() * callStatuses.length)],
        call_type: callTypes[Math.floor(Math.random() * callTypes.length)]
      };
      
      sampleCalls.push(call);
    }

    for (const call of sampleCalls) {
      await query(
        `INSERT INTO calls (call_id, agent_id, customer_number, start_time, end_time, duration, status, call_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [call.call_id, call.agent_id, call.customer_number, call.start_time, call.end_time, call.duration, call.status, call.call_type]
      );
    }

    // Get call IDs for creating sentiment and audit data
    const callResults = await query('SELECT id FROM calls WHERE status = $1', ['completed']);
    const callIds = callResults.rows.map(call => call.id);

    // Create sample sentiment analysis data
    for (const callId of callIds.slice(0, 20)) { // Sample for first 20 calls
      const sentiments = ['positive', 'negative', 'neutral'];
      const speakers = ['agent', 'customer'];
      
      for (let i = 0; i < 10; i++) { // 10 sentiment entries per call
        const timestamp = new Date();
        timestamp.setMinutes(timestamp.getMinutes() - Math.floor(Math.random() * 30));
        
        await query(
          `INSERT INTO sentiment_analysis (call_id, timestamp, sentiment, confidence, speaker, text_segment) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            callId,
            timestamp,
            sentiments[Math.floor(Math.random() * sentiments.length)],
            (Math.random() * 0.4 + 0.6).toFixed(4), // 0.6-1.0 confidence
            speakers[Math.floor(Math.random() * speakers.length)],
            `Sample text segment ${i + 1} for call ${callId}`
          ]
        );
      }
    }

    // Create sample call audit data
    for (const callId of callIds.slice(0, 15)) { // Sample for first 15 calls
      await query(
        `INSERT INTO call_audit_data (call_id, productivity_percentage, speech_percentage, silence_percentage, crosstalk_percentage, music_percentage, overall_score, keywords, compliance_issues) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          callId,
          (Math.random() * 30 + 70).toFixed(2), // 70-100% productivity
          (Math.random() * 20 + 60).toFixed(2), // 60-80% speech
          (Math.random() * 15 + 5).toFixed(2),  // 5-20% silence
          (Math.random() * 10 + 5).toFixed(2),  // 5-15% crosstalk
          (Math.random() * 5 + 1).toFixed(2),   // 1-6% music
          (Math.random() * 20 + 80).toFixed(2), // 80-100% overall score
          JSON.stringify(['customer', 'service', 'product', 'support', 'help']),
          JSON.stringify([])
        ]
      );
    }

    // Create sample agent status entries
    const statuses = ['online', 'offline', 'busy', 'idle'];
    const userResults2 = await query('SELECT id FROM users');
    
    for (const user of userResults2.rows) {
      await query(
        `INSERT INTO agent_status (user_id, status, last_activity) 
         VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET status = $2, last_activity = $3`,
        [
          user.id,
          statuses[Math.floor(Math.random() * statuses.length)],
          new Date()
        ]
      );
    }

    logger.info('Database seeding completed successfully');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
};

// Run seeding if this file is executed directly
const isMainModule = process.argv[1] && process.argv[1].endsWith('seed.js');
if (isMainModule) {
  seedData()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      logger.info('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      logger.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedData };
