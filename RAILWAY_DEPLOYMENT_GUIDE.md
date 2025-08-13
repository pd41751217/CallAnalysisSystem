# 🚀 Railway Deployment Guide

## 📋 Prerequisites

- Railway account (free tier available)
- Git repository with your code
- PostgreSQL database (Railway provides this)

## 🏗️ Deployment Strategy

You need to deploy **TWO SEPARATE SERVICES** in Railway:
1. **Frontend Service** - React static site (using root Dockerfile)
2. **Backend Service** - Node.js API server (using backend Dockerfile)

## 🚀 Step-by-Step Deployment

### Step 1: Push Your Code
```bash
git add .
git commit -m "Fix Railway deployment - add root Dockerfile for frontend"
git push origin main
```

### Step 2: Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select your repository

### Step 3: Deploy Frontend Service
1. In your Railway project, click "New Service"
2. Select "GitHub Repo"
3. Choose your repository
4. **IMPORTANT**: Leave "Root Directory" empty (use root of repo)
5. **IMPORTANT**: Select "Deploy from Dockerfile"
6. Click "Deploy"

### Step 4: Deploy Backend Service
1. In your Railway project, click "New Service" again
2. Select "GitHub Repo"
3. Choose your repository
4. **IMPORTANT**: Set "Root Directory" to `backend`
5. **IMPORTANT**: Select "Deploy from Dockerfile"
6. Click "Deploy"

### Step 5: Add PostgreSQL Database
1. In your Railway project, click "New Service"
2. Select "Database" → "PostgreSQL"
3. Click "Deploy"
4. Copy the connection string

### Step 6: Configure Environment Variables

#### Backend Service Variables:
```
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-frontend-url.railway.app
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://... (from PostgreSQL service)
REDIS_URL=redis://... (if using Redis)
```

#### Frontend Service Variables:
```
NODE_ENV=production
PORT=3000
VITE_API_URL=https://your-backend-url.railway.app
```

### Step 7: Get Your URLs
1. Go to each service's "Settings" tab
2. Copy the "Domain" URL
3. Update environment variables with these URLs

## 🔧 Why This Approach Works

### Root Dockerfile (Frontend):
- ✅ Builds the frontend application
- ✅ Uses `--legacy-peer-deps` for React 19 + MUI compatibility
- ✅ Serves static files with `serve`
- ✅ No root directory needed

### Backend Dockerfile:
- ✅ Builds the backend API server
- ✅ Installs backend dependencies
- ✅ Runs the Node.js server
- ✅ Uses `backend/` root directory

## 🚨 Common Issues & Solutions

### Issue 1: "Dockerfile does not exist"
**Problem**: Railway can't find the Dockerfile
**Solution**: Ensure Dockerfile exists in the correct directory

### Issue 2: "ERESOLVE unable to resolve dependency tree"
**Problem**: React 19 + MUI compatibility issues
**Solution**: Root Dockerfile uses `--legacy-peer-deps` flag

### Issue 3: CORS Errors
**Problem**: Frontend can't connect to backend
**Solution**: Set CORS_ORIGIN in backend environment variables

## 📁 File Structure for Railway

```
your-repo/
├── Dockerfile                 # Root Dockerfile (for frontend)
├── Dockerfile.backend         # Backend Dockerfile
├── railway.json               # Root Railway config (frontend)
├── backend/
│   ├── package.json           # Backend dependencies
│   ├── src/
│   ├── railway.json           # Backend Railway config
│   └── Dockerfile             # Backend Docker config
├── frontend/
│   ├── package.json           # Frontend dependencies
│   ├── src/
│   ├── railway.json           # Frontend Railway config
│   └── Dockerfile             # Frontend Docker config
└── package.json               # Root package.json
```

## 🔍 Verification Steps

1. **Frontend Load**: Visit `https://your-frontend-url.railway.app`
2. **Backend Health Check**: Visit `https://your-backend-url.railway.app/health`
3. **Database Connection**: Check backend logs for database connection
4. **API Calls**: Test API endpoints from frontend

## 🎯 Expected URLs

After deployment, you should have:
- **Frontend**: `https://your-frontend-service.railway.app`
- **Backend**: `https://your-backend-service.railway.app`
- **Database**: Internal connection string

## 🆘 Troubleshooting

### Check Logs
1. Go to each service in Railway
2. Click "Deployments" tab
3. Click on latest deployment
4. Check build and runtime logs

### Common Commands
```bash
# Test locally
npm run dev:backend
npm run dev:frontend

# Build locally
npm run build:frontend
npm run build:backend

# Test Docker builds locally
docker build -t frontend .
cd backend && docker build -t backend .
```

### Environment Variables
- Ensure all required variables are set
- Check for typos in variable names
- Verify URLs are correct

## 🎉 Success!

Once deployed successfully:
1. Your frontend will be accessible at the Railway domain
2. Your backend API will be accessible at the Railway domain
3. Database will be connected automatically
4. All features should work as expected

## 📞 Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Community: [community.railway.app](https://community.railway.app)
- Check service logs for specific error messages
