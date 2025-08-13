#!/bin/bash

echo "🚀 Deploying Call Analysis System to Railway.com"
echo "================================================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "📦 Deploying Backend..."
cd backend
railway up

echo "🌐 Deploying Frontend..."
cd ../frontend
railway up

echo "✅ Deployment complete!"
echo ""
echo "🔧 Next steps:"
echo "1. Set up PostgreSQL database in Railway dashboard"
echo "2. Add environment variables:"
echo "   - DATABASE_URL (from Railway PostgreSQL)"
echo "   - JWT_SECRET (generate a random string)"
echo "   - CORS_ORIGIN (your frontend URL)"
echo "3. Run database migration: npm run migrate"
echo ""
echo "📚 See RAILWAY_DEPLOYMENT_GUIDE.md for detailed instructions"
