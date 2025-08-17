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

// Export call details service
export { callDetailsService } from './callDetailsService';
export type { CallDetails, Message, ComplianceIssue, TranscriptEntry } from './callDetailsService';

// Export user management service
export { userManagementService } from './userManagementService';
export type { User as UserManagementUser, Team, CreateUserData, UpdateUserData } from './userManagementService';

// Export call audit service
export { callAuditService } from './callAuditService';
export type { CallAuditData, TranscriptEntry as CallAuditTranscriptEntry } from './callAuditService';
