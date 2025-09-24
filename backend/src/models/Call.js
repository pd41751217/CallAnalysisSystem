import { supabase } from '../wrappers/database.js';

export class Call {
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          users (
            name,
            team_id
          ),
          call_analysis (
            *
          )
        `)
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async findByCallId(callId) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          users (
            name,
            team_id
          ),
          call_analysis (
            *
          )
        `)
        .eq('call_id', callId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(userId, options = {}) {
    try {
      let query = supabase
        .from('calls')
        .select(`
          *,
          users (
            name,
            teams (
              name
            )
          ),
          call_analysis (
            *
          )
        `)
        .eq('user_id', userId);

      // Apply filters
      if (options.status) {
        query = query.eq('status', options.status);
      }

      // Apply ordering
      query = query.order('created_at', { ascending: false });

      // Apply pagination
      if (options.page && options.limit) {
        const offset = (options.page - 1) * options.limit;
        query = query.range(offset, offset + options.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async findAll(options = {}) {
    try {
      let query = supabase
        .from('calls')
        .select(`
          *,
          users (
            name,
            teams (
              name
            )
          ),
          call_analysis (
            *
          )
        `);

      // Apply filters
      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.user_id) {
        query = query.eq('user_id', options.user_id);
      }
      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      // Apply ordering
      query = query.order('created_at', { ascending: false });

      // Apply pagination
      if (options.page && options.limit) {
        const offset = (options.page - 1) * options.limit;
        query = query.range(offset, offset + options.limit - 1);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async create(callData) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .insert([callData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async update(id, updates) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async delete(id) {
    try {
      const { error } = await supabase
        .from('calls')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async count(options = {}) {
    try {
      let query = supabase
        .from('calls')
        .select('*', { count: 'exact' });

      // Apply filters
      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.user_id) {
        query = query.eq('user_id', options.user_id);
      }
      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }
      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (error) {
      throw error;
    }
  }

  static async getStats(options = {}) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          id,
          status,
          duration,
          created_at,
          call_analysis (
            productivity_score,
            speech_percentage,
            silence_percentage,
            crosstalk_percentage,
            music_percentage
          )
        `);

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async updateAnalysisData(id, analysisData) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .update({ analysis_data: analysisData })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async updateAnalysisDataByCallId(callId, analysisData) {
    try {
      const { data, error } = await supabase
        .from('calls')
        .update({ analysis_data: analysisData })
        .eq('call_id', callId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }
}
