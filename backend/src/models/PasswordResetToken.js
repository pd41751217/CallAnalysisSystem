import { supabase } from '../wrappers/database.js';

export class PasswordResetToken {
  static async findByToken(token) {
    try {
      const { data, error } = await supabase
        .from('password_reset_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
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
        .from('password_reset_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async create(tokenData) {
    try {
      const { data, error } = await supabase
        .from('password_reset_tokens')
        .insert([tokenData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async markAsUsed(token) {
    try {
      const { data, error } = await supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('token', token)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async deleteByUserId(userId) {
    try {
      const { error } = await supabase
        .from('password_reset_tokens')
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
        .from('password_reset_tokens')
        .delete()
        .lt('expires_at', new Date().toISOString());
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async deleteUsed() {
    try {
      const { error } = await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('used', true);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }
}
