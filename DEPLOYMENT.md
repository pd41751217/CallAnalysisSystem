# 🚀 Render.com Deployment Guide

This guide will walk you through deploying your Call Analysis System to Render.com step by step.

## 📋 Pre-Deployment Checklist

Before starting deployment, ensure you have:

- [ ] Git repository with your code pushed
- [ ] Render.com account created
- [ ] All environment variables documented
- [ ] Database migration script ready
- [ ] Frontend build working locally

## 🎯 Deployment Options

### Option 1: Blueprint Deployment (Recommended)

This is the easiest method using the `render.yaml` file.

#### Step 1: Prepare Your Repository

1. **Ensure all files are committed**:
   ```bash
   git add .
   git commit -m "Add deployment configuration for Render.com"
   git push origin main
   ```

2. **Verify these files exist in your repository**:
   - `render.yaml` (deployment configuration)
   - `backend/package.json` (with build script)
   - `frontend/package.json` (with build script)
   - `backend/src/config/database.js` (updated for production)
   - `frontend/src/config/api.ts` (API configuration)

#### Step 2: Deploy on Render.com

1. **Go to Render.com Dashboard**
   - Visit [dashboard.render.com](https://dashboard.render.com)
   - Sign in to your account

2. **Create Blueprint**
   - Click "New +" button
   - Select "Blueprint"
   - Connect your Git repository
   - Render will automatically detect the `render.yaml` file

3. **Review Configuration**
   - Verify service names and configurations
   - Check environment variables
   - Review database and Redis settings

4. **Deploy**
   - Click "Apply" to start deployment
   - Monitor the deployment progress
   - Wait for all services to be "Live"

### Option 2: Manual Deployment

If you prefer to deploy services individually:

#### Step 1: Deploy PostgreSQL Database

1. **Create Database**
   - Go to Render Dashboard
   - Click "New +" → "PostgreSQL"
   - Configure:
     - **Name**: `call-analysis-db`
     - **Database**: `call_analysis_db`
     - **User**: `call_analysis_user`
     - **Plan**: Starter (Free)
   - Click "Create Database"

2. **Get Connection Details**
   - Note the `External Database URL`
   - This will be your `DATABASE_URL`

#### Step 2: Deploy Redis Instance

1. **Create Redis**
   - Click "New +" → "Redis"
   - Configure:
     - **Name**: `call-analysis-redis`
     - **Plan**: Starter (Free)
   - Click "Create Redis"

2. **Get Connection Details**
   - Note the `External Redis URL`
   - This will be your `REDIS_URL`

#### Step 3: Deploy Backend API

1. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect your Git repository

2. **Configure Service**
   - **Name**: `call-analysis-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: Leave empty (root)
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: Starter (Free)

3. **Set Environment Variables**
   ```
   NODE_ENV=production
   PORT=10000
   CORS_ORIGIN=https://your-frontend-url.onrender.com
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   DATABASE_URL=postgresql://user:password@host:port/database
   REDIS_URL=redis://user:password@host:port
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_FROM=noreply@callanalysis.com
   UPLOAD_PATH=./uploads
   MAX_FILE_SIZE=10485760
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   LOG_LEVEL=info
   WS_PORT=10001
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Monitor deployment progress

#### Step 4: Deploy Frontend

1. **Create Static Site**
   - Click "New +" → "Static Site"
   - Connect your Git repository

2. **Configure Service**
   - **Name**: `call-analysis-frontend`
   - **Branch**: `main`
   - **Root Directory**: Leave empty (root)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
   - **Plan**: Starter (Free)

3. **Set Environment Variables**
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```

4. **Deploy**
   - Click "Create Static Site"
   - Monitor deployment progress

## 🔧 Post-Deployment Setup

### Step 1: Run Database Migration

1. **Access Backend Logs**
   - Go to your backend service
   - Click "Logs" tab

2. **Run Migration**
   - In the logs, you can run:
   ```bash
   npm run migrate
   ```
   - Or use Render's shell feature if available

### Step 2: Test Your Application

1. **Test Backend Health**
   - Visit: `https://your-backend-url.onrender.com/health`
   - Should return: `{"status":"OK","timestamp":"...","uptime":...,"environment":"production"}`

2. **Test Frontend**
   - Visit your frontend URL
   - Check if it loads without errors
   - Test API connectivity

3. **Test API Endpoints**
   - Use tools like Postman or curl
   - Test authentication endpoints
   - Verify CORS is working

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. Build Failures

**Problem**: Frontend or backend build fails
**Solutions**:
- Check build logs for specific errors
- Verify all dependencies are in `package.json`
- Ensure TypeScript compilation passes locally
- Check for missing environment variables

#### 2. Database Connection Issues

**Problem**: Backend can't connect to database
**Solutions**:
- Verify `DATABASE_URL` is correct
- Check database service is running
- Ensure SSL configuration is correct for production
- Test connection string locally

#### 3. CORS Errors

**Problem**: Frontend can't communicate with backend
**Solutions**:
- Update `CORS_ORIGIN` to match frontend URL exactly
- Check for trailing slashes in URLs
- Verify both services are deployed and running
- Test with browser developer tools

#### 4. Environment Variables Not Loading

**Problem**: App can't read environment variables
**Solutions**:
- Restart the service after adding variables
- Check variable names for typos
- Ensure variables are set in the correct service
- Verify no extra spaces in values

#### 5. Static Files Not Serving

**Problem**: Frontend assets not loading
**Solutions**:
- Verify `Publish Directory` is correct (`frontend/dist`)
- Check build command completed successfully
- Ensure `dist` folder exists after build
- Check for build errors in logs

### Debugging Steps

1. **Check Service Logs**
   - Go to each service's "Logs" tab
   - Look for error messages
   - Check startup logs

2. **Test Individual Components**
   - Test backend health endpoint
   - Test database connection
   - Test frontend build locally

3. **Verify Configuration**
   - Double-check all environment variables
   - Verify service URLs are correct
   - Check build and start commands

4. **Check Network Connectivity**
   - Test service URLs in browser
   - Use curl to test API endpoints
   - Check for DNS resolution issues

## 📊 Monitoring and Maintenance

### Health Checks

- **Backend Health**: `https://your-backend-url.onrender.com/health`
- **Frontend**: Check if static site loads
- **Database**: Monitor connection status in logs

### Performance Monitoring

- Monitor service response times
- Check memory and CPU usage
- Review error rates in logs

### Updates and Maintenance

- Keep dependencies updated
- Monitor for security patches
- Regular database backups (if needed)
- Monitor service usage and limits

## 🆘 Getting Help

If you encounter issues:

1. **Check Render.com Documentation**: [docs.render.com](https://docs.render.com)
2. **Review Service Logs**: Look for specific error messages
3. **Test Locally**: Reproduce issues in local environment
4. **Community Support**: Check Render.com community forums

## 🎉 Success!

Once deployed successfully, your Call Analysis System will be available at:
- **Frontend**: `https://your-frontend-name.onrender.com`
- **Backend API**: `https://your-backend-name.onrender.com`
- **Health Check**: `https://your-backend-name.onrender.com/health`

Your application is now live and accessible from anywhere in the world! 🌍
