import { User, Team } from '../models/index.js';
import { sendWelcomeEmail } from '../utils/email.js';
import { logger } from '../utils/logger.js';

export class UserController {
  static async getAllUsers(options = {}) {
    try {
      const users = await User.findAllWithTeams(options);
      const total = await User.count(options);
      
      return {
        users,
        pagination: {
          current: options.page || 1,
          total: Math.ceil(total / (options.limit || total)),
          totalRecords: total,
          limit: options.limit || total
        }
      };
    } catch (error) {
      logger.error('Get all users error:', error);
      throw error;
    }
  }

  static async getUserById(id) {
    try {
      const user = await User.findByIdWithTeam(id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      logger.error('Get user by ID error:', error);
      throw error;
    }
  }

  static async createUser(userData) {
    try {
      // Check if email already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('Email already exists');
      }

      // Create user
      const newUser = await User.create(userData);

      // Send welcome email
      try {
        await sendWelcomeEmail(userData.email, userData.name, userData.password);
      } catch (emailError) {
        logger.warn('Failed to send welcome email:', emailError);
      }

      return newUser;
    } catch (error) {
      logger.error('Create user error:', error);
      throw error;
    }
  }

  static async updateUser(id, updates) {
    try {
      // Check if user exists
      const existingUser = await User.findById(id);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Check if email is being changed and if it already exists
      if (updates.email && updates.email !== existingUser.email) {
        const emailCheck = await User.findByEmail(updates.email);
        if (emailCheck) {
          throw new Error('Email already exists');
        }
      }

      // Update user
      const updatedUser = await User.update(id, updates);
      return updatedUser;
    } catch (error) {
      logger.error('Update user error:', error);
      throw error;
    }
  }

  static async deleteUser(id) {
    try {
      // Check if user exists
      const existingUser = await User.findById(id);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Delete user
      await User.delete(id);
      return { message: 'User deleted successfully' };
    } catch (error) {
      logger.error('Delete user error:', error);
      throw error;
    }
  }

  static async getAllTeams() {
    try {
      const teams = await Team.findAll();
      return teams;
    } catch (error) {
      logger.error('Get all teams error:', error);
      throw error;
    }
  }

  static async createTeam(teamData) {
    try {
      // Check if team name already exists
      const existingTeam = await Team.findByName(teamData.name);
      if (existingTeam) {
        throw new Error('Team name already exists');
      }

      // Create team
      const newTeam = await Team.create(teamData);
      return newTeam;
    } catch (error) {
      logger.error('Create team error:', error);
      throw error;
    }
  }

  static async updateTeam(id, updates) {
    try {
      // Check if team exists
      const existingTeam = await Team.findById(id);
      if (!existingTeam) {
        throw new Error('Team not found');
      }

      // Check if name is being changed and if it already exists
      if (updates.name && updates.name !== existingTeam.name) {
        const nameCheck = await Team.findByName(updates.name);
        if (nameCheck) {
          throw new Error('Team name already exists');
        }
      }

      // Update team
      const updatedTeam = await Team.update(id, updates);
      return updatedTeam;
    } catch (error) {
      logger.error('Update team error:', error);
      throw error;
    }
  }

  static async deleteTeam(id) {
    try {
      // Check if team exists
      const existingTeam = await Team.findById(id);
      if (!existingTeam) {
        throw new Error('Team not found');
      }

      // Check if team has users
      const teamUsers = await User.findAll({ team_id: id });
      if (teamUsers.length > 0) {
        throw new Error('Cannot delete team with existing users');
      }

      // Delete team
      await Team.delete(id);
      return { message: 'Team deleted successfully' };
    } catch (error) {
      logger.error('Delete team error:', error);
      throw error;
    }
  }

  static async getUserStats() {
    try {
      const totalUsers = await User.count();
      const totalAgents = await User.count({ role: 'agent' });
      const totalTeamLeads = await User.count({ role: 'team_lead' });
      const totalAdmins = await User.count({ role: 'admin' });

      return {
        totalUsers,
        totalAgents,
        totalTeamLeads,
        totalAdmins
      };
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw error;
    }
  }
}
