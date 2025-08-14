FROM node:18-alpine

# Set working directory explicitly
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy all backend files
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 3000

# Use node directly (it's in PATH) and relative path
CMD ["node", "src/server.js"]
