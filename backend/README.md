# Call Analysis System - Backend

A comprehensive Node.js backend API for the Call Analysis System, providing real-time call monitoring, sentiment analysis, and analytics capabilities.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Real-time Communication**: WebSocket support for live call monitoring
- **Call Management**: Complete CRUD operations for calls and call data
- **Sentiment Analysis**: Real-time sentiment tracking and analysis
- **User Management**: Team and user management with role-based permissions
- **Analytics**: Comprehensive dashboard and reporting APIs
- **Database**: PostgreSQL with optimized schema for call center operations
- **Security**: Rate limiting, input validation, and security headers

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Real-time**: Socket.io
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Logging**: Winston
- **Email**: Nodemailer
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CallAnalysisSystem/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=call_analysis_db
   DB_USER=postgres
   DB_PASSWORD=your_password

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=24h

   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # CORS Configuration
   CORS_ORIGIN=http://localhost:5173
   ```

4. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE call_analysis_db;
   CREATE USER call_analysis_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE call_analysis_db TO call_analysis_user;
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Seed the database with sample data**
   ```bash
   npm run seed
   ```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Database Operations
```bash
# Run migrations
npm run migrate

# Seed database
npm run seed

# Run tests
npm test
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/verify` - Verify JWT token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users (Admin, Team Lead)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user (Admin, Team Lead)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin)
- `GET /api/users/teams` - Get all teams
- `POST /api/users/teams` - Create new team (Admin)

### Calls
- `GET /api/calls` - Get call history with filters
- `GET /api/calls/:id` - Get call details
- `POST /api/calls` - Create new call
- `PUT /api/calls/:id/end` - End a call

### Analysis
- `POST /api/analysis/sentiment` - Add sentiment analysis data
- `POST /api/analysis/transcript` - Add call transcript
- `POST /api/analysis/audit` - Add call audit data
- `POST /api/analysis/event` - Add call event

### Dashboard
- `GET /api/dashboard/overview` - Get dashboard overview data
- `GET /api/dashboard/analytics` - Get analytics data
- `GET /api/dashboard/live` - Get live call data

## WebSocket Events

### Client to Server
- `call_start` - Start a new call
- `call_end` - End an active call
- `sentiment_update` - Update sentiment analysis
- `transcript_update` - Update call transcript
- `event` - Trigger a call event
- `status_update` - Update agent status

### Server to Client
- `call_started` - Call started notification
- `call_ended` - Call ended notification
- `sentiment_updated` - Sentiment update notification
- `transcript_updated` - Transcript update notification
- `event_triggered` - Event notification
- `agent_status_updated` - Agent status update

## Database Schema

### Core Tables
- `users` - User accounts and roles
- `teams` - Team definitions
- `calls` - Call records
- `sentiment_analysis` - Real-time sentiment data
- `call_transcripts` - Call conversation transcripts
- `call_audit_data` - Call quality metrics
- `events` - Call events and triggers
- `agent_status` - Real-time agent status
- `password_reset_tokens` - Password reset tokens

## Default Users

After running the seed script, the following users are created:

| Email | Password | Role |
|-------|----------|------|
| admin@callanalysis.com | admin123 | Admin |
| john.smith@callanalysis.com | password123 | Team Lead |
| sarah.johnson@callanalysis.com | password123 | Team Lead |
| mike.davis@callanalysis.com | password123 | Agent |
| lisa.wilson@callanalysis.com | password123 | Agent |
| david.brown@callanalysis.com | password123 | Agent |
| emma.taylor@callanalysis.com | password123 | Agent |
| alex.rodriguez@callanalysis.com | password123 | Agent |

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Admin, Team Lead, and Agent roles
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configurable CORS settings
- **Security Headers**: Helmet.js for security headers
- **Password Hashing**: bcrypt for secure password storage

## Error Handling

The API uses centralized error handling with:
- Structured error responses
- Comprehensive logging
- HTTP status codes
- Validation error details

## Logging

Logging is handled by Winston with:
- Console logging in development
- File logging in production
- Error tracking
- Request/response logging

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Environment Variables
Ensure all required environment variables are set in production.

### Database
- Use a production PostgreSQL instance
- Set up proper backups
- Configure connection pooling

### Process Management
- Use PM2 or similar process manager
- Set up proper logging
- Configure monitoring

### Security
- Use HTTPS in production
- Set secure JWT secrets
- Configure proper CORS origins
- Enable rate limiting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## Changelog

### v1.0.0
- Initial release
- Complete authentication system
- Real-time call monitoring
- Sentiment analysis integration
- Dashboard and analytics
- User and team management
