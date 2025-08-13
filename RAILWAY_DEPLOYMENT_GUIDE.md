# 🚀 Railway.com Deployment Guide

This guide will walk you through deploying your Call Analysis System to Railway.com step by step.

## 🎯 Why Railway.com?

- ✅ **$5 free credit** monthly (enough for small projects)
- ✅ **PostgreSQL database** included
- ✅ **Easy deployment** with Git integration
- ✅ **Similar to Render.com** but with better free tier
- ✅ **Automatic HTTPS** and custom domains
- ✅ **Built-in monitoring** and logs

## 📋 Prerequisites

Before starting deployment, ensure you have:

- [ ] Railway.com account (sign up at [railway.app](https://railway.app))
- [ ] GitHub repository with your code
- [ ] Credit card for verification (required, but free tier available)
- [ ] All environment variables documented

## 🚀 Deployment Steps

### Step 1: Create Railway Account

1. **Sign up for Railway**
   - Go to [railway.app](https://railway.app)
   - Click "Start a Project"
   - Sign up with GitHub
   - Add payment method (required for verification)

2. **Verify Account**
   - Railway will verify your account
   - You'll get $5 free credit monthly

### Step 2: Create PostgreSQL Database

1. **Create New Project**
   - Click "New Project"
   - Select "Provision PostgreSQL"

2. **Configure Database**
   - **Name**: `call-analysis-db`
   - **Plan**: Starter (Free)
   - Click "Deploy Now"

3. **Get Connection Details**
   - Go to the database service
   - Click "Connect" tab
   - Copy the `DATABASE_URL`
   - Format: `postgresql://postgres:[password]@[host]:[port]/railway`

### Step 3: Deploy Backend API

1. **Add Backend Service**
   - In your project, click "New Service"
   - Select "GitHub Repo"
   - Choose your repository
   - Set **Root Directory** to `backend`

2. **Configure Backend**
   - **Name**: `call-analysis-backend`
   - **Environment**: Node.js (auto-detected)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Set Environment Variables**
   Click "Variables" tab and add:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=postgresql://postgres:[password]@[host]:[port]/railway
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_EXPIRES_IN=24h
   CORS_ORIGIN=https://your-frontend-domain.railway.app
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_FROM=noreply@callanalysis.com
   UPLOAD_PATH=./uploads
   MAX_FILE_SIZE=10485760
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   LOG_LEVEL=info
   ```

4. **Deploy Backend**
   - Click "Deploy Now"
   - Wait for deployment to complete
   - Note the generated URL (e.g., `https://call-analysis-backend-production-xxxx.up.railway.app`)

### Step 4: Deploy Frontend

1. **Add Frontend Service**
   - Click "New Service" → "GitHub Repo"
   - Choose your repository
   - Set **Root Directory** to `frontend`

2. **Configure Frontend**
   - **Name**: `call-analysis-frontend`
   - **Environment**: Node.js (auto-detected)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve -s dist -l 3000`

3. **Set Environment Variables**
   ```env
   VITE_API_URL=https://your-backend-domain.railway.app
   NODE_ENV=production
   ```

4. **Deploy Frontend**
   - Click "Deploy Now"
   - Wait for deployment to complete
   - Note the generated URL

### Step 5: Run Database Migration

1. **Access Backend Logs**
   - Go to your backend service
   - Click "Deployments" tab
   - Click on the latest deployment
   - Click "View Logs"

2. **Run Migration**
   - In the logs, you can run:
   ```bash
   npm run migrate
   ```
   - Or use Railway's shell feature if available

## 🔧 Configuration Files

### railway.json (Root)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### backend/railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### frontend/railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run build && npx serve -s dist -l 3000",
    "healthcheckPath": "/",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 📊 Service URLs

After deployment, your services will be available at:
- **Frontend**: `https://call-analysis-frontend-production-xxxx.up.railway.app`
- **Backend API**: `https://call-analysis-backend-production-xxxx.up.railway.app`
- **Health Check**: `https://call-analysis-backend-production-xxxx.up.railway.app/health`
- **Database**: Internal connection (managed by Railway)

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
- Ensure SSL configuration is correct
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

### Debugging Steps

1. **Check Service Logs**
   - Go to each service's "Deployments" tab
   - Click on the latest deployment
   - Click "View Logs"
   - Look for error messages

2. **Test Individual Components**
   - Test backend health endpoint
   - Test database connection
   - Test frontend build locally

3. **Verify Configuration**
   - Double-check all environment variables
   - Verify service URLs are correct
   - Check build and start commands

## 📊 Monitoring and Maintenance

### Health Checks
- **Backend Health**: `https://your-backend-url.railway.app/health`
- **Frontend**: Check if static site loads
- **Database**: Monitor connection status in logs

### Performance Monitoring
- Monitor service response times
- Check memory and CPU usage
- Review error rates in logs
- Use Railway's built-in monitoring

### Updates and Maintenance
- Keep dependencies updated
- Monitor for security patches
- Regular database backups (if needed)
- Monitor service usage and limits

## 💰 Cost Management

### Free Tier Limits
- **$5 free credit** monthly
- **PostgreSQL**: ~$5/month (uses most of free credit)
- **Web Services**: ~$1-2/month each
- **Total**: Usually within free tier limits

### Cost Optimization
- Use starter plans for all services
- Monitor usage in Railway dashboard
- Set up usage alerts
- Consider upgrading only when needed

## 🆘 Getting Help

If you encounter issues:

1. **Check Railway Documentation**: [docs.railway.app](https://docs.railway.app)
2. **Review Service Logs**: Look for specific error messages
3. **Test Locally**: Reproduce issues in local environment
4. **Community Support**: Check Railway Discord/community forums

## 🎉 Success!

Once deployed successfully, your Call Analysis System will be available at:
- **Frontend**: `https://your-frontend-name.railway.app`
- **Backend API**: `https://your-backend-name.railway.app`
- **Health Check**: `https://your-backend-name.railway.app/health`

Your application is now live and accessible from anywhere in the world! 🌍

## 🚀 Quick Commands

### Deploy to Railway:
```bash
# 1. Push your code to Git
git add .
git commit -m "Add Railway deployment configuration"
git push origin main

# 2. Follow the Railway deployment steps above
# 3. Set environment variables in Railway dashboard
# 4. Run database migration
```

Your Call Analysis System is now ready for Railway.com deployment! 🎉
