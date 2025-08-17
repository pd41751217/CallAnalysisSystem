# Deployment Guide for Render.com

This guide explains how to deploy the Call Analysis System to Render.com.

## Backend Deployment

### Environment Variables

Set these environment variables in your Render.com backend service:

```bash
# Database
DATABASE_URL=your_supabase_database_url

# CORS Configuration
CORS_ORIGIN=https://callanalysissystem.onrender.com

# JWT Secret
JWT_SECRET=your_jwt_secret_key

# Node Environment
NODE_ENV=production

# Rate Limiting (optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Build Command
```bash
npm install
```

### Start Command
```bash
npm start
```

## Frontend Deployment

### Environment Variables

Set these environment variables in your Render.com frontend service:

```bash
# API URL (your backend service URL)
VITE_API_URL=https://callanalysissystem-backend.onrender.com/api

# Socket URL (your backend service URL)
VITE_SOCKET_URL=https://callanalysissystem-backend.onrender.com
```

### Build Command
```bash
npm install && npm run build
```

### Start Command
```bash
npm run preview
```

## Important Notes

1. **CORS Configuration**: The backend is now configured to allow requests from:
   - `https://callanalysissystem.onrender.com`
   - `https://callanalysissystem-frontend.onrender.com`
   - Local development URLs

2. **API URLs**: Make sure your frontend environment variables point to the correct backend service URL.

3. **HTTPS**: Render.com provides HTTPS by default, which is required for production.

4. **Database**: Ensure your Supabase database is properly configured and accessible from Render.com.

## Troubleshooting

### CORS Errors
If you still get CORS errors:
1. Check that your backend service URL is correct in the frontend environment variables
2. Verify that the CORS_ORIGIN environment variable is set correctly
3. Ensure both services are deployed and running

### Connection Issues
1. Check that the backend service is healthy
2. Verify environment variables are set correctly
3. Check the backend logs for any startup errors

### Build Issues
1. Ensure all dependencies are properly installed
2. Check that the build command is correct
3. Verify that the start command is appropriate for the built application
