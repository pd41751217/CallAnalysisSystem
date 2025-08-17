import { supabase } from '../wrappers/database.js';

export class Team {
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async findByName(name) {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('name', name)
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
        .from('teams')
        .select('*');

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

  static async create(teamData) {
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert([teamData])
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
        .from('teams')
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
        .from('teams')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async count() {
    try {
      const { count, error } = await supabase
        .from('teams')
        .select('*', { count: 'exact' });
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      throw error;
    }
  }
}
