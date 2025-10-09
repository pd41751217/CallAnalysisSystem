# VPS Deployment Guide - Call Analysis System

This guide will help you deploy your Call Analysis System to a VPS (Virtual Private Server) and configure the environment files properly.

## Prerequisites

- VPS with Ubuntu/Debian (recommended)
- Domain name pointing to your VPS (optional but recommended)
- SSL certificate (Let's Encrypt recommended)
- Node.js 18+ installed on VPS
- PM2 for process management (recommended)

## Step 1: Environment Files Setup

### Backend Environment Configuration

1. **Create the backend environment file:**
   ```bash
   cd backend
   cp env.template .env
   ```

2. **Edit the `.env` file with your actual values:**

   ```env
   # ===========================================
   # SERVER CONFIGURATION
   # ===========================================
   NODE_ENV=production
   PORT=3002

   # ===========================================
   # DATABASE CONFIGURATION (SUPABASE)
   # ===========================================
   SUPABASE_URL=https://your-actual-project-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-actual-service-role-key

   # ===========================================
   # JWT CONFIGURATION
   # ===========================================
   JWT_SECRET=generate-a-very-long-random-string-here
   JWT_EXPIRES_IN=24h

   # ===========================================
   # CORS CONFIGURATION
   # ===========================================
   CORS_ORIGIN=https://your-domain.com
   FRONTEND_URL=https://your-domain.com

   # ===========================================
   # EMAIL CONFIGURATION
   # ===========================================
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-gmail-app-password
   EMAIL_FROM=noreply@your-domain.com

   # ===========================================
   # OPENAI CONFIGURATION
   # ===========================================
   OPENAI_API_KEY=your-openai-api-key

   # ===========================================
   # RATE LIMITING
   # ===========================================
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # ===========================================
   # AUDIO PROCESSING
   # ===========================================
   AUDIO_SOURCE=3
   MAX_QUEUE_SIZE_FOR_OPENAI=5000

   # ===========================================
   # LOGGING
   # ===========================================
   LOG_LEVEL=info
   ```

### Frontend Environment Configuration

1. **Create the frontend environment file:**
   ```bash
   cd frontend
   cp env.template .env
   ```

2. **Edit the `.env` file with your actual values:**

   ```env
   # ===========================================
   # API CONFIGURATION
   # ===========================================
   VITE_API_URL=https://your-domain.com:3002/api

   # ===========================================
   # SOCKET CONFIGURATION
   # ===========================================
   VITE_SOCKET_URL=https://your-domain.com:3002
   ```

## Step 2: Getting Required API Keys and Configuration

### 1. Supabase Configuration

1. Go to [Supabase](https://supabase.com) and create a new project
2. In your project dashboard, go to **Settings** → **API**
3. Copy the **Project URL** and **service_role key**
4. Update your backend `.env` file with these values

### 2. OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Create an API key in the API Keys section
3. Add it to your backend `.env` file

### 3. Email Configuration (Gmail Example)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. Use your Gmail address and the app password in the `.env` file

### 4. JWT Secret

Generate a strong JWT secret:
```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Option 2: Using OpenSSL
openssl rand -hex 64
```

## Step 3: VPS Setup Commands

### 1. Install Node.js and PM2

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx (for reverse proxy)
sudo apt install nginx -y
```

### 2. Upload Your Code

```bash
# Clone or upload your project to the VPS
# Example: /var/www/call-analysis-system/
cd /var/www/call-analysis-system/

# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 3. Build Frontend

```bash
cd frontend
npm run build
```

### 4. Configure PM2

Create a PM2 ecosystem file:

```bash
# In your project root
nano ecosystem.config.js
```

Add this content:

```javascript
module.exports = {
  apps: [
    {
      name: 'call-analysis-backend',
      script: './backend/src/server.js',
      cwd: '/var/www/call-analysis-system',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'call-analysis-frontend',
      script: 'serve',
      args: '-s dist -l 3000',
      cwd: '/var/www/call-analysis-system/frontend',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
```

### 5. Start Applications with PM2

```bash
# Start all applications
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Step 4: Nginx Configuration

### 1. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/call-analysis-system
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration (update paths to your certificates)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Frontend (React App)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Enable the Site

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/call-analysis-system /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## Step 5: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

## Step 6: Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Step 7: Database Migration

```bash
# Run database migrations
cd backend
npm run migrate
npm run migrate:seed
```

## Step 8: Testing Your Deployment

1. **Check if services are running:**
   ```bash
   pm2 status
   pm2 logs
   ```

2. **Test the API:**
   ```bash
   curl https://your-domain.com/health
   curl https://your-domain.com/api/test
   ```

3. **Access your application:**
   - Frontend: `https://your-domain.com`
   - Backend API: `https://your-domain.com/api`

## Important Security Notes

1. **Never commit `.env` files to version control**
2. **Use strong, unique passwords and API keys**
3. **Keep your VPS and dependencies updated**
4. **Monitor logs regularly:**
   ```bash
   pm2 logs
   sudo tail -f /var/log/nginx/error.log
   ```

## Troubleshooting

### Common Issues:

1. **CORS errors:** Check your `CORS_ORIGIN` in backend `.env`
2. **Socket.IO connection issues:** Verify WebSocket proxy configuration in Nginx
3. **Email not working:** Check Gmail app password and SMTP settings
4. **Database connection issues:** Verify Supabase URL and service key

### Useful Commands:

```bash
# Restart services
pm2 restart all

# View logs
pm2 logs call-analysis-backend
pm2 logs call-analysis-frontend

# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t
```

## Environment Variables Summary

### Backend Required Variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `JWT_SECRET` - Strong secret for JWT tokens
- `CORS_ORIGIN` - Your frontend domain
- `FRONTEND_URL` - Your frontend domain
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` - SMTP settings
- `OPENAI_API_KEY` - OpenAI API key for AI features

### Frontend Required Variables:
- `VITE_API_URL` - Backend API URL
- `VITE_SOCKET_URL` - WebSocket URL for real-time features

Your Call Analysis System should now be successfully deployed on your VPS!

