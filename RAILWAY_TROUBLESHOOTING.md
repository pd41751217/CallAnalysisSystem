# 🔧 Railway Deployment Troubleshooting

## 🚨 Issue 1: "undefined variable 'npm'" in Nixpacks

### Problem Description
When deploying to Railway.com, you encounter the error:
```
error: undefined variable 'npm'
at /app/.nixpacks/nixpkgs-*.nix:19:16
```

This happens because the custom nixpacks.toml configuration is causing issues with Railway's Nixpacks builder.

### ✅ Solution Applied

I've fixed this issue by:

1. **Removed custom nixpacks.toml files**
   - Deleted root `nixpacks.toml`
   - Deleted `frontend/nixpacks.toml`
   - Let Railway use its default Nixpacks configuration

2. **Simplified Railway configurations**
   - Removed custom environment variables
   - Used standard Railway configuration format
   - Let Railway auto-detect Node.js

3. **Added Docker alternatives**
   - Created `frontend/Dockerfile` for Docker deployment
   - Created `backend/Dockerfile` for Docker deployment
   - Provides alternative deployment method

### 🔧 Files Modified

#### Removed Files
- `nixpacks.toml` (Root)
- `frontend/nixpacks.toml`
- `frontend/railway.toml`

#### Simplified `railway.json` (Root)
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

#### Added `frontend/Dockerfile`
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm install -g serve
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

## 🚨 Issue 2: "npm: command not found"

### Problem Description
When deploying to Railway.com, you encounter the error:
```
/bin/bash: line 1: npm: command not found
```

This happens because Railway's build environment doesn't have Node.js and npm installed.

### ✅ Solution Applied

This should be resolved by letting Railway auto-detect Node.js from the package.json files.

## 🚨 Issue 3: "No start command could be found"

### Problem Description
When deploying to Railway.com, you encounter the error:
```
Error: No start command could be found
```

This happens because Railway's Nixpacks builder can't automatically detect how to start your frontend application.

### ✅ Solution Applied

I've fixed this issue by:

1. **Added Express server** (`frontend/server.js`)
   - Creates a simple Express server to serve static files
   - Handles client-side routing properly
   - Uses the correct port from environment variables

2. **Updated package.json**
   - Added `express` dependency
   - Created a proper `start` script: `npm run build && node server.js`
   - This ensures Railway can find and execute the start command

## 🚀 Deployment Steps (Updated)

### Option 1: Standard Railway Deployment

#### Step 1: Push Changes
```bash
git add .
git commit -m "Fix Railway deployment - simplify configuration and add Docker alternatives"
git push origin main
```

#### Step 2: Deploy on Railway
1. Go to your Railway project
2. Create new services pointing to your repository
3. Set root directory to `backend` for backend service
4. Set root directory to `frontend` for frontend service
5. Railway should auto-detect Node.js and deploy successfully

### Option 2: Docker Deployment

#### Step 1: Deploy Backend with Docker
1. Create new service in Railway
2. Select "Deploy from Dockerfile"
3. Point to your repository with root directory `backend`
4. Railway will use the `backend/Dockerfile`

#### Step 2: Deploy Frontend with Docker
1. Create new service in Railway
2. Select "Deploy from Dockerfile"
3. Point to your repository with root directory `frontend`
4. Railway will use the `frontend/Dockerfile`

### Step 3: Verify Deployment
- Check that both services show "Deployed" status
- Visit your frontend URL to ensure it loads correctly
- Check backend health endpoint
- Check logs for any remaining issues

## 🔍 Alternative Solutions

If the above solutions don't work, try these alternatives:

### Option 1: Use Railway's Node.js Template
1. Create a new service using Railway's Node.js template
2. Point it to your repository
3. Set the root directory appropriately

### Option 2: Use Vercel for Frontend
1. Deploy frontend to Vercel (free)
2. Deploy backend to Railway
3. Update CORS settings to allow Vercel domain

### Option 3: Use Netlify for Frontend
1. Deploy frontend to Netlify (free)
2. Deploy backend to Railway
3. Update CORS settings to allow Netlify domain

## 🎯 Why These Solutions Work

1. **Simplified Configuration**: Removes problematic custom Nixpacks configuration
2. **Auto-detection**: Lets Railway auto-detect Node.js from package.json
3. **Docker Alternative**: Provides reliable containerized deployment
4. **Express Server**: Provides a proper Node.js server that Railway can start
5. **Standard Approach**: Uses Railway's recommended deployment methods

## 🆘 Still Having Issues?

If you're still experiencing problems:

1. **Try Docker Deployment**: Use the Dockerfiles instead of Nixpacks
2. **Check Railway Logs**: Look for specific error messages
3. **Verify Dependencies**: Ensure all packages are in `package.json`
4. **Test Locally**: Run `npm start` locally to ensure it works
5. **Use Alternative Platforms**: Consider Vercel/Netlify for frontend

## 📞 Support

For additional help:
- Check Railway documentation: [docs.railway.app](https://docs.railway.app)
- Review Railway community forums
- Test the deployment locally first

Your Call Analysis System should now deploy successfully to Railway! 🎉
