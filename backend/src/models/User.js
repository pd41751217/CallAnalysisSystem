import { db, supabase } from '../wrappers/database.js';
import bcrypt from 'bcryptjs';

export class User {
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
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
        .from('users')
        .select('*')

      // Apply filters
      if (options.role) {
        query = query.eq('role', options.role);
      }
      if (options.team_id) {
        query = query.eq('team_id', options.team_id);
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

  static async create(userData) {
    try {
      // Hash password if provided
      if (userData.password) {
        const salt = await bcrypt.genSalt(12);
        userData.password_hash = await bcrypt.hash(userData.password, 12);
        delete userData.password;
      }

      const { data, error } = await supabase
        .from('users')
        .insert([userData])
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
      // Hash password if provided
      if (updates.password) {
        const salt = await bcrypt.genSalt(12);
        updates.password_hash = await bcrypt.hash(updates.password, 12);
        delete updates.password;
      }

      const { data, error } = await supabase
        .from('users')
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
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async updateLastLogin(id) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static async verifyPassword(user, password) {
    return bcrypt.compare(password, user.password_hash);
  }

  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  static async count(options = {}) {
    try {
      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })

      if (options.role) {
        query = query.eq('role', options.role);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (error) {
      throw error;
    }
  }

  // Helper method to get user with team information
  static async findByIdWithTeam(id) {
    try {
      const user = await this.findById(id);
      if (!user) return null;

      if (user.team_id) {
        const { data: team, error: teamError } = await supabase
          .from('teams')
          .select('name')
          .eq('id', user.team_id)
          .single();
        
        if (!teamError && team) {
          user.team_name = team.name;
        }
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  // Helper method to get all users with team information
  static async findAllWithTeams(options = {}) {
    try {
      const users = await this.findAll(options);
      
      // Get team information for users with team_id
      const teamIds = [...new Set(users.filter(u => u.team_id).map(u => u.team_id))];
      
      if (teamIds.length > 0) {
        const { data: teams, error: teamsError } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds);
        
        if (!teamsError && teams) {
          const teamMap = teams.reduce((map, team) => {
            map[team.id] = team.name;
            return map;
          }, {});
          
          users.forEach(user => {
            if (user.team_id && teamMap[user.team_id]) {
              user.team_name = teamMap[user.team_id];
            }
          });
        }
      }

      return users;
    } catch (error) {
      throw error;
    }
  }
}
