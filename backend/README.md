# Call Analysis System - Backend

A comprehensive Node.js backend API for the Call Analysis System, now fully integrated with Supabase PostgreSQL.

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the backend directory:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_here

# Email Configuration (optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### 2. Database Setup

1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Get Credentials**: Copy your project URL and API keys from the Settings > API section
3. **Create Tables**: 
   - Go to SQL Editor in your Supabase dashboard
   - Copy and run the contents of `backend/supabase-schema.sql`

### 3. Install Dependencies

```bash
npm install
```

### 4. Seed Database

```bash
npm run migrate:seed
```

This creates:
- Default team
- Admin user (`admin@callanalysis.com` / `admin123`)
- Test user (`test@callanalysis.com` / `test123`)
- Sample call data

### 5. Start Server

```bash
npm run dev
```

## 📋 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm run migrate` - Full migration (creates tables + seeds data)
- `npm run migrate:seed` - Data seeding only (recommended)
- `npm run seed` - Additional sample data seeding

## 🔧 Features

- **Authentication & Authorization**: JWT-based with role-based access control
- **Real-time Communication**: WebSocket support for live call monitoring
- **Call Management**: Complete CRUD operations for calls and analysis
- **User Management**: Team and user management with role-based permissions
- **Analytics**: Comprehensive dashboard and reporting APIs
- **Database**: Supabase PostgreSQL with optimized schema
- **Security**: Rate limiting, input validation, and security headers

## 🗄️ Database Schema

The system uses these tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `teams` | Team management |
| `calls` | Call records and metadata |
| `call_analysis` | Analysis results and metrics |
| `user_sessions` | Session management |
| `password_reset_tokens` | Password reset functionality |

## 👥 Default Users

After running the migration:

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| admin@callanalysis.com | admin123 | Admin | Full system access |
| test@callanalysis.com | test123 | User | Testing purposes |

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Users
- `GET /api/users` - Get all users (Admin, Team Lead)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user (Admin, Team Lead)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin)

### Calls
- `GET /api/calls` - Get call history with filters
- `GET /api/calls/:id` - Get call details
- `POST /api/calls` - Create new call
- `PUT /api/calls/:id` - Update call
- `DELETE /api/calls/:id` - Delete call (Admin)

### Analysis
- `POST /api/analysis/sentiment` - Add sentiment analysis data
- `POST /api/analysis/audit` - Add call audit data
- `POST /api/analysis/event` - Add call event

### Dashboard
- `GET /api/dashboard/overview` - Get dashboard overview data
- `GET /api/dashboard/analytics` - Get analytics data
- `GET /api/dashboard/live` - Get live call data

## 🔌 WebSocket Events

### Client to Server
- `call_start` - Start a new call
- `call_end` - End an active call
- `sentiment_update` - Update sentiment analysis
- `event` - Trigger a call event
- `status_update` - Update agent status

### Server to Client
- `call_started` - Call started notification
- `call_ended` - Call ended notification
- `sentiment_updated` - Sentiment update notification
- `event_triggered` - Event notification
- `agent_status_updated` - Agent status update

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Admin, Team Lead, and Agent roles
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configurable CORS settings
- **Security Headers**: Helmet.js for security headers
- **Password Hashing**: bcrypt for secure password storage

## 🐛 Troubleshooting

### "Tables do not exist" Error
- Run the SQL schema manually in Supabase dashboard
- Use `npm run migrate:seed` after creating tables

### Connection Errors
- Check your `.env` file has correct Supabase credentials
- Verify your Supabase project is active
- Ensure you're using the correct URL and keys

### Permission Errors
- Check Row Level Security (RLS) policies
- Verify your service role key has proper permissions
- Ensure tables are created with correct permissions

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `CORS_ORIGIN` | Allowed CORS origin | No |

## 🔄 Migration vs Seeding

- **`npm run migrate`**: Full migration (creates tables + seeds data)
- **`npm run migrate:seed`**: Data seeding only (recommended after manual table creation)
- **`npm run seed`**: Additional sample data for testing

## 📚 Next Steps

1. **Start Frontend**: `cd ../frontend && npm run dev`
2. **Test Full Application**: Login and navigate through the system
3. **Customize**: Modify users, teams, and settings as needed
4. **Monitor**: Check Supabase dashboard for usage and performance

## 🤝 Support

If you encounter issues:

1. Check the Supabase documentation
2. Review the error logs in your terminal
3. Verify your environment variables
4. Test with the provided sample credentials

## 📄 License

MIT License - see LICENSE file for details
