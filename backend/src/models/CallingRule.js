import { supabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export class CallingRule {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.description = data.description;
    this.dos = data.dos; // boolean: true for "do", false for "don't"
    this.weight = data.weight; // integer 0-100
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new calling rule
  static async create(ruleData) {
    try {
      const { data, error } = await supabase
        .from('calling_rules')
        .insert([ruleData])
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Calling rule created: ${data.title}`);
      return new CallingRule(data);
    } catch (error) {
      logger.error('Error creating calling rule:', error);
      throw error;
    }
  }

  // Get all calling rules
  static async getAll() {
    try {
      const { data, error } = await supabase
        .from('calling_rules')
        .select('*')
        .order('weight', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(rule => new CallingRule(rule));
    } catch (error) {
      logger.error('Error fetching calling rules:', error);
      throw error;
    }
  }

  // Get calling rules by type (do/don't)
  static async getByType(isDos) {
    try {
      const { data, error } = await supabase
        .from('calling_rules')
        .select('*')
        .eq('dos', isDos)
        .order('weight', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(rule => new CallingRule(rule));
    } catch (error) {
      logger.error('Error fetching calling rules by type:', error);
      throw error;
    }
  }

  // Get a calling rule by ID
  static async getById(id) {
    try {
      const { data, error } = await supabase
        .from('calling_rules')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      
      return data ? new CallingRule(data) : null;
    } catch (error) {
      logger.error('Error fetching calling rule by ID:', error);
      throw error;
    }
  }

  // Update a calling rule
  async update(updates) {
    try {
      const { data, error } = await supabase
        .from('calling_rules')
        .update(updates)
        .eq('id', this.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update current instance
      Object.assign(this, data);
      
      logger.info(`Calling rule updated: ${this.title}`);
      return this;
    } catch (error) {
      logger.error('Error updating calling rule:', error);
      throw error;
    }
  }

  // Delete a calling rule
  async delete() {
    try {
      const { error } = await supabase
        .from('calling_rules')
        .delete()
        .eq('id', this.id);
      
      if (error) throw error;
      
      logger.info(`Calling rule deleted: ${this.title}`);
      return true;
    } catch (error) {
      logger.error('Error deleting calling rule:', error);
      throw error;
    }
  }

  // Static method to delete by ID
  static async deleteById(id) {
    try {
      const { error } = await supabase
        .from('calling_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      logger.info(`Calling rule deleted with ID: ${id}`);
      return true;
    } catch (error) {
      logger.error('Error deleting calling rule by ID:', error);
      throw error;
    }
  }

  // Get calling rules count
  static async getCount() {
    try {
      const { count, error } = await supabase
        .from('calling_rules')
        .select('*', { count: 'exact' });
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error('Error getting calling rules count:', error);
      throw error;
    }
  }

  // Get calling rules count by type
  static async getCountByType(isDos) {
    try {
      const { count, error } = await supabase
        .from('calling_rules')
        .select('*', { count: 'exact' })
        .eq('dos', isDos);
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error('Error getting calling rules count by type:', error);
      throw error;
    }
  }

  // Validate rule data
  static validate(ruleData) {
    const errors = [];

    if (!ruleData.title || ruleData.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (!ruleData.description || ruleData.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (typeof ruleData.dos !== 'boolean') {
      errors.push('Dos field must be a boolean (true for "do", false for "don\'t")');
    }

    if (typeof ruleData.weight !== 'number' || ruleData.weight < 0 || ruleData.weight > 100) {
      errors.push('Weight must be a number between 0 and 100');
    }

    return errors;
  }

  // Convert to JSON
  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      dos: this.dos,
      weight: this.weight,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}
