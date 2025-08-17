// Export the main API instance
export { default as api } from './api';

// Export auth service
export { authService } from './authService';
export type { User, LoginCredentials, AuthResponse } from './authService';

// Export call service
export { callService } from './callService';
export type { Call, CallAnalysis, CallFilters } from './callService';

// Export dashboard service
export { dashboardService } from './dashboardService';
export type { User as DashboardUser, ActiveCall, DashboardMetrics, DashboardData } from './dashboardService';
