# User Management Setup Guide

This guide will help you set up and test the User Management functionality with real database data and CRUD operations.

## Prerequisites

1. **Supabase Database Setup**: Make sure you have set up your Supabase database and have the environment variables configured.

2. **Environment Variables**: Ensure your `.env` file contains the necessary Supabase configuration:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## Setup Steps

### 1. Create Database Tables

First, you need to create the database tables in your Supabase project:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `backend/supabase-schema.sql`
4. Execute the SQL script

### 2. Seed Initial Data

Run the migration script to seed initial data:

```bash
npm run migrate:seed
```

This will create:
- Default Team
- Admin User (admin@callanalysis.com / admin123)
- Test User (test@callanalysis.com / test123)
- Sales Team
- Sample Agent (john.smith@callanalysis.com / agent123)

### 3. Start the Backend Server

```bash
npm run dev
```

### 4. Test the API Endpoints

You can test the API endpoints using tools like Postman or curl:

#### Get All Users
```bash
GET http://localhost:3001/api/users
```

#### Get All Teams
```bash
GET http://localhost:3001/api/users/teams
```

#### Create User
```bash
POST http://localhost:3001/api/users
Content-Type: application/json

{
  "name": "New User",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "agent",
  "team_id": 1
}
```

#### Update User
```bash
PUT http://localhost:3001/api/users/1
Content-Type: application/json

{
  "name": "Updated User",
  "email": "updated@example.com",
  "role": "team_lead",
  "team_id": 1
}
```

#### Delete User
```bash
DELETE http://localhost:3001/api/users/1
```

## Frontend Testing

1. Start the frontend development server:
   ```bash
   cd ../frontend
   npm run dev
   ```

2. Navigate to the User Management page in your browser

3. Test the following features:
   - View all users in a table format
   - Search users by name, email, or team
   - Add new users with different roles
   - Edit existing users
   - Delete users
   - Pagination
   - Role-based access control

## Features Implemented

### Backend
- ✅ Real database integration with Supabase
- ✅ User CRUD operations (Create, Read, Update, Delete)
- ✅ Team management
- ✅ Role-based access control
- ✅ Input validation
- ✅ Error handling
- ✅ Password hashing
- ✅ Email notifications (welcome emails)

### Frontend
- ✅ Real-time data display from database
- ✅ User search functionality
- ✅ Add/Edit user forms
- ✅ Delete user confirmation
- ✅ Role and status indicators
- ✅ Team selection
- ✅ Pagination
- ✅ Success/error notifications
- ✅ Loading states

## Database Schema

The User Management system uses the following tables:

### Users Table
- `id` (Primary Key)
- `name` (User's full name)
- `email` (Unique email address)
- `password_hash` (Hashed password)
- `role` (admin, team_lead, agent)
- `team_id` (Foreign key to teams table)
- `status` (online, offline, calling)
- `last_login` (Timestamp)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### Teams Table
- `id` (Primary Key)
- `name` (Team name)
- `description` (Team description)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

## Troubleshooting

### Common Issues

1. **"Missing Supabase configuration" error**
   - Check your `.env` file has the correct Supabase URL and service role key
   - Ensure the environment variables are being loaded

2. **"Tables do not exist" error**
   - Run the SQL schema in your Supabase SQL Editor
   - Check that all tables were created successfully

3. **Authentication errors**
   - Make sure you're logged in with an admin or team_lead role
   - Check that the JWT token is valid

4. **CORS errors**
   - Ensure the frontend URL is added to the CORS configuration in your backend

### Debug Steps

1. Check the backend logs for detailed error messages
2. Verify database connectivity using the test connection function
3. Test API endpoints directly using Postman or curl
4. Check browser console for frontend errors

## Next Steps

After setting up User Management, you can:

1. Implement additional user features (password reset, profile management)
2. Add more sophisticated role-based permissions
3. Implement user activity tracking
4. Add bulk user operations
5. Implement user import/export functionality
6. Add audit logging for user changes

## Support

If you encounter any issues, check the backend logs and browser console for error messages. The system includes comprehensive error handling and logging to help with debugging.
