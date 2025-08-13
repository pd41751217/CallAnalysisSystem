# 🔧 Railway Deployment Troubleshooting

## 🚨 Issue 1: "npm: command not found"

### Problem Description
When deploying to Railway.com, you encounter the error:
```
/bin/bash: line 1: npm: command not found
```

This happens because Railway's build environment doesn't have Node.js and npm installed.

### ✅ Solution Applied

I've fixed this issue by:

1. **Added nixpacks.toml files**
   - Root level: `nixpacks.toml` - Ensures Node.js is available for the entire project
   - Frontend level: `frontend/nixpacks.toml` - Explicitly configures Node.js for frontend

2. **Created root package.json**
   - Defines project structure with workspaces
   - Specifies Node.js version requirements
   - Provides build and start scripts

3. **Updated Railway configurations**
   - Added environment variables
   - Explicitly configured build phases

### 🔧 Files Modified

#### `nixpacks.toml` (Root - New)
```toml
[phases.setup]
nixPkgs = ["nodejs", "npm"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

#### `frontend/nixpacks.toml` (New)
```toml
[phases.setup]
nixPkgs = ["nodejs", "npm"]

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

#### `package.json` (Root - New)
```json
{
  "name": "call-analysis-system",
  "version": "1.0.0",
  "workspaces": ["frontend", "backend"],
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

## 🚨 Issue 2: "No start command could be found"

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

3. **Updated Railway configuration**
   - `railway.json` now uses `"startCommand": "npm start"`
   - This points to the npm script which Railway can execute

### 🔧 Files Modified

#### `frontend/server.js` (New)
```javascript
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle client-side routing by serving index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
```

#### `frontend/package.json` (Updated)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "start": "npm run build && node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    // ... other dependencies
  }
}
```

## 🚀 Deployment Steps (Updated)

### Step 1: Push Changes
```bash
git add .
git commit -m "Fix Railway deployment - add Node.js configuration and Express server"
git push origin main
```

### Step 2: Deploy on Railway
1. Go to your Railway project
2. Both services should now deploy successfully
3. Railway will find Node.js and npm, then execute the start commands

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

### Option 2: Use Docker
1. Create a Dockerfile for each service
2. Use Railway's Docker deployment option
3. Ensure Node.js is installed in the Docker image

### Option 3: Use Vercel for Frontend
1. Deploy frontend to Vercel (free)
2. Deploy backend to Railway
3. Update CORS settings to allow Vercel domain

## 🎯 Why These Solutions Work

1. **nixpacks.toml**: Explicitly tells Railway to install Node.js and npm
2. **Root package.json**: Helps Railway understand the project structure
3. **Express Server**: Provides a proper Node.js server that Railway can start
4. **Static File Serving**: Serves the built React app correctly
5. **Environment Variables**: Uses proper port configuration

## 🆘 Still Having Issues?

If you're still experiencing problems:

1. **Check Railway Logs**: Look for specific error messages
2. **Verify Dependencies**: Ensure all packages are in `package.json`
3. **Test Locally**: Run `npm start` locally to ensure it works
4. **Check Node.js Version**: Ensure you're using Node.js 18+
5. **Review Build Process**: Make sure the build completes successfully

## 📞 Support

For additional help:
- Check Railway documentation: [docs.railway.app](https://docs.railway.app)
- Review Railway community forums
- Test the deployment locally first

Your Call Analysis System should now deploy successfully to Railway! 🎉
