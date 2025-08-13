# Use Node.js 18 as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files from frontend
COPY frontend/package*.json ./frontend/

# Install frontend dependencies with legacy peer deps flag
WORKDIR /app/frontend
RUN npm install --legacy-peer-deps

# Copy frontend source code
COPY frontend/ .

# Build the frontend application
RUN npm run build

# Install serve to run the application
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Start the application
CMD ["serve", "-s", "dist", "-l", "3000"]
