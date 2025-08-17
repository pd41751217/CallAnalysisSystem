# API Services

This directory contains centralized API configuration and service modules for the Call Analysis System frontend.

## Structure

- `api.ts` - Main axios instance with base URL configuration and interceptors
- `authService.ts` - Authentication-related API calls
- `callService.ts` - Call management and analysis API calls
- `dashboardService.ts` - Dashboard-related API calls
- `index.ts` - Centralized exports for all services

## Configuration

### Base URL
The API base URL is configured in `api.ts`:
- **Development**: Uses relative URLs (`/api`) to work with Vite proxy
- **Production**: Uses `VITE_API_URL` environment variable or defaults to `http://localhost:3001/api`

### Environment Setup
For production, create a `.env` file in the frontend root:
```
VITE_API_URL=http://localhost:3001/api
```

**Note**: In development, the API uses relative URLs that work with the Vite proxy configuration.

## Usage

### Importing Services
```typescript
// Import specific services
import { authService, callService } from '../services';

// Import types
import type { User, Call } from '../services';

// Import the API instance directly
import { api } from '../services';
```

### Authentication Service
```typescript
// Login
const response = await authService.login({ email, password });
const { token, user } = response;

// Verify token
const { user } = await authService.verifyToken();

// Forgot password
await authService.forgotPassword(email);

// Reset password
await authService.resetPassword(token, newPassword);
```

### Call Service
```typescript
// Get calls with filters
const { calls, total } = await callService.getCalls({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  agentId: 'agent123'
});

// Get specific call
const call = await callService.getCallById('call123');

// Get call analysis
const analysis = await callService.getCallAnalysis('call123');

// Get live calls
const liveCalls = await callService.getLiveCalls();
```

### Dashboard Service
```typescript
// Get all dashboard data (users and calls)
const dashboardData = await dashboardService.getDashboardData();

// Get users with status
const usersData = await dashboardService.getUsers();

// Get active calls
const callsData = await dashboardService.getActiveCalls();

// Get dashboard metrics
const metrics = await dashboardService.getMetrics();

// Get user statistics
const userStats = await dashboardService.getUserStats();

// Get call statistics
const callStats = await dashboardService.getCallStats();
```

## Features

### Automatic Authentication
- Request interceptor automatically adds JWT token from localStorage
- Response interceptor handles 401 errors and redirects to login

### Error Handling
- Centralized error handling in response interceptor
- Automatic token cleanup on authentication failures
- Console logging for debugging

### TypeScript Support
- Full TypeScript support with proper type definitions
- Interface exports for all data models

## Adding New Services

1. Create a new service file (e.g., `userService.ts`)
2. Import the `api` instance from `./api`
3. Define interfaces for your data models
4. Export the service and types
5. Add exports to `index.ts`

Example:
```typescript
import api from './api';

export interface User {
  id: string;
  name: string;
  email: string;
}

export const userService = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data;
  },
  
  createUser: async (userData: Partial<User>): Promise<User> => {
    const response = await api.post('/users', userData);
    return response.data;
  }
};
```
