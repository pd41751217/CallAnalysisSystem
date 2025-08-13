# Call Analysis System

A real-time call analysis system with sentiment analysis, compliance monitoring, and live dashboard capabilities.

## 🚀 Quick Deploy to Render.com

### Prerequisites
- A Render.com account
- Your project code pushed to a Git repository (GitHub, GitLab, etc.)

### Deployment Steps

#### Option 1: Using render.yaml (Recommended)

1. **Push your code to Git repository**
   ```bash
   git add .
   git commit -m "Add deployment configuration"
   git push origin main
   ```

2. **Deploy on Render.com**
   - Go to [Render.com](https://render.com) and sign in
   - Click "New +" and select "Blueprint"
   - Connect your Git repository
   - Render will automatically detect the `render.yaml` file
   - Click "Apply" to deploy all services

#### Option 2: Manual Deployment

1. **Deploy Backend API**
   - Go to Render.com Dashboard
   - Click "New +" → "Web Service"
   - Connect your Git repository
   - Configure:
     - **Name**: `call-analysis-backend`
     - **Environment**: `Node`
     - **Build Command**: `cd backend && npm install`
     - **Start Command**: `cd backend && npm start`
     - **Plan**: Starter (Free)

2. **Deploy Frontend**
   - Click "New +" → "Static Site"
   - Connect your Git repository
   - Configure:
     - **Name**: `call-analysis-frontend`
     - **Build Command**: `cd frontend && npm install && npm run build`
     - **Publish Directory**: `frontend/dist`

3. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - Configure:
     - **Name**: `call-analysis-db`
     - **Database**: `call_analysis_db`
     - **User**: `call_analysis_user`
     - **Plan**: Starter (Free)

4. **Create Redis Instance**
   - Click "New +" → "Redis"
   - Configure:
     - **Name**: `call-analysis-redis`
     - **Plan**: Starter (Free)

### Environment Variables

#### Backend Environment Variables
Set these in your backend service settings:

```env
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-frontend-url.onrender.com
JWT_SECRET=your-super-secret-jwt-key
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

#### Frontend Environment Variables
Set these in your frontend service settings:

```env
VITE_API_URL=https://your-backend-url.onrender.com
```

### Database Setup

After deployment, run the database migration:

1. **Access your backend service logs**
2. **Run migration command**:
   ```bash
   npm run migrate
   ```

### Service URLs

After deployment, your services will be available at:
- **Frontend**: `https://call-analysis-frontend.onrender.com`
- **Backend API**: `https://call-analysis-backend.onrender.com`
- **Health Check**: `https://call-analysis-backend.onrender.com/health`

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis (optional for local development)

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd CallAnalysisSystem
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp env.example .env
   # Edit .env with your local database credentials
   npm run migrate
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Environment Variables (Local)

Create `.env` files in both `backend/` and `frontend/` directories:

#### Backend (.env)
```env
PORT=3001
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=call_analysis_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_local_jwt_secret
CORS_ORIGIN=http://localhost:5173
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
```

## 📁 Project Structure

```
CallAnalysisSystem/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Database and app configuration
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── utils/          # Utility functions
│   │   └── server.js       # Main server file
│   ├── package.json
│   └── env.example
├── frontend/               # React/Vite frontend
│   ├── src/
│   │   ├── pages/         # React components
│   │   ├── config/        # API configuration
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── render.yaml            # Render.com deployment config
└── README.md
```

## 🔧 Available Scripts

### Backend
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with sample data

### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` environment variable
   - Ensure PostgreSQL service is running
   - Verify database credentials

2. **CORS Errors**
   - Update `CORS_ORIGIN` to match your frontend URL
   - Check that frontend and backend URLs are correct

3. **Build Failures**
   - Ensure all dependencies are installed
   - Check for TypeScript compilation errors
   - Verify Node.js version compatibility

4. **Environment Variables Not Loading**
   - Restart the service after adding environment variables
   - Check variable names for typos
   - Ensure variables are set in the correct service

### Support

For deployment issues:
1. Check Render.com service logs
2. Verify environment variables
3. Test API endpoints using the health check URL
4. Review the deployment configuration in `render.yaml`

## 📝 License

MIT License - see LICENSE file for details.
