import { supabase } from '../wrappers/database.js';

export class Session {
  static async findByToken(token) {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('session_token', token)
        .gt('expires_at', new Date().toISOString())
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async findByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async create(sessionData) {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .insert([sessionData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async deleteByToken(token) {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', token);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async deleteByUserId(userId) {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async deleteExpired() {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }
}
