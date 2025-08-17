import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection function
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error && error.code === 'PGRST205') {
      logger.warn('Tables do not exist yet');
      return false;
    }
    
    if (error) {
      logger.error('Supabase connection failed:', error.message);
      return false;
    }
    
    logger.info('Supabase connection successful');
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error.message);
    return false;
  }
};

// Database wrapper with error handling
export const db = {
  // Generic query wrapper
  async query(table, operation, options = {}) {
    try {
      let query = supabase.from(table);
      
      // Apply operation
      switch (operation.type) {
        case 'select':
          query = query.select(options.select || '*');
          break;
        case 'insert':
          query = query.insert(options.data);
          break;
        case 'update':
          query = query.update(options.data);
          break;
        case 'delete':
          query = query.delete();
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
      
      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }
      
      // Apply range for pagination
      if (options.range) {
        query = query.range(options.range.from, options.range.to);
      }
      
      // Apply ordering
      if (options.order) {
        query = query.order(options.order.column, { ascending: options.order.ascending });
      }
      
      // Apply single result
      if (options.single) {
        query = query.single();
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      logger.error(`Database query error (${table}):`, error);
      throw error;
    }
  },
  
  // Convenience methods
  async findOne(table, filters = {}) {
    return this.query(table, { type: 'select' }, { filters, single: true });
  },
  
  async findMany(table, options = {}) {
    return this.query(table, { type: 'select' }, options);
  },
  
  async create(table, data) {
    return this.query(table, { type: 'insert' }, { data });
  },
  
  async update(table, filters, data) {
    return this.query(table, { type: 'update' }, { filters, data });
  },
  
  async delete(table, filters) {
    return this.query(table, { type: 'delete' }, { filters });
  },
  
  async count(table, filters = {}) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact' });
    
    if (error) throw error;
    return count || 0;
  }
};

export default supabase;
