import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Missing Supabase configuration. Please check your environment variables.');
  throw new Error('Supabase configuration is required');
}

// Create Supabase client with service role key for admin operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      logger.error('Supabase connection test failed:', error.message);
      return false;
    }
    
    logger.info('Supabase connection successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error.message);
    return false;
  }
};

// User management functions
export const createUser = async (userData) => {
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
};

export const getUserById = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const updateUser = async (id, updates) => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteUser = async (id) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
};

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Team management functions
export const createTeam = async (teamData) => {
  const { data, error } = await supabase
    .from('teams')
    .insert([teamData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getAllTeams = async () => {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

// Call management functions
export const createCall = async (callData) => {
  const { data, error } = await supabase
    .from('calls')
    .insert([callData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateCall = async (id, updates) => {
  const { data, error } = await supabase
    .from('calls')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteCall = async (id) => {
  const { error } = await supabase
    .from('calls')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
};

export const getCallsWithFilters = async (filters = {}, page = 1, limit = 10) => {
  let query = supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  // Apply pagination
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getCallsCount = async (filters = {}) => {
  let query = supabase
    .from('calls')
    .select('*', { count: 'exact' });

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

// Call analysis functions
export const createCallAnalysis = async (analysisData) => {
  const { data, error } = await supabase
    .from('call_analysis')
    .insert([analysisData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// Dashboard functions
export const getOverviewStats = async () => {
  try {
    // Get user counts
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact' })

    const { count: totalAgents } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('role', 'agent');

    const { count: totalTeamLeads } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('role', 'team_lead');

    const { count: totalAdmins } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('role', 'admin');

    // Get call counts
    const { count: totalCalls } = await supabase
      .from('calls')
      .select('*', { count: 'exact' });

    const { count: activeCalls } = await supabase
      .from('calls')
      .select('*', { count: 'exact' })

    const { count: completedCalls } = await supabase
      .from('calls')
      .select('*', { count: 'exact' })
      .eq('status', 'completed');

    // Get recent calls
    const { data: recentCalls } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      overview: {
        totalCalls: totalCalls || 0,
        activeCalls: activeCalls || 0,
        totalAgents: totalAgents || 0,
        totalTeamLeads: totalTeamLeads || 0,
        totalAdmins: totalAdmins || 0,
        avgDuration: 0 // This would need to be calculated from actual call data
      },
      recentCalls: recentCalls || []
    };
  } catch (error) {
    logger.error('Error getting overview stats:', error);
    throw error;
  }
};

export const getDashboardStats = async () => {
  try {
    const { data: calls } = await supabase
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false });

    return {
      totalCalls: calls?.length || 0,
      completedCalls: calls?.filter(call => call.status === 'completed').length || 0,
      avgDuration: 0 // This would need to be calculated from actual call data
    };
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    throw error;
  }
};

// Password reset functions
export const createPasswordResetToken = async (tokenData) => {
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .insert([tokenData])
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const getPasswordResetToken = async (token) => {
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

export const markPasswordResetTokenUsed = async (token) => {
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('token', token)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};
