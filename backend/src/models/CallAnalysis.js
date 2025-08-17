import { supabase } from '../wrappers/database.js';

export class CallAnalysis {
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('call_analysis')
        .select('*')
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
        .from('call_analysis')
        .select('*')
        .eq('call_id', callId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async findAll(options = {}) {
    try {
      let query = supabase
        .from('call_analysis')
        .select('*');

      // Apply filters
      if (options.call_id) {
        query = query.eq('call_id', options.call_id);
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

  static async create(analysisData) {
    try {
      const { data, error } = await supabase
        .from('call_analysis')
        .insert([analysisData])
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
        .from('call_analysis')
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
        .from('call_analysis')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async getStats() {
    try {
      const { data, error } = await supabase
        .from('call_analysis')
        .select(`
          productivity_score,
          speech_percentage,
          silence_percentage,
          crosstalk_percentage,
          music_percentage
        `);

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }
}
