import { CallingRule } from '../models/CallingRule.js';
import { logger } from '../utils/logger.js';

export class CallingRuleController {
  // Create a new calling rule
  static async createRule(req, res) {
    try {
      const { title, description, dos: isDos, weight } = req.body;

      // Validate required fields
      if (!title || !description || typeof isDos !== 'boolean' || typeof weight !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: title, description, dos (boolean), weight (number)'
        });
      }

      // Validate weight range
      if (weight < 0 || weight > 100) {
        return res.status(400).json({
          success: false,
          message: 'Weight must be between 0 and 100'
        });
      }

      // Validate rule data
      const validationErrors = CallingRule.validate(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      const ruleData = {
        title: title.trim(),
        description: description.trim(),
        dos: isDos,
        weight: Math.round(weight)
      };

      const rule = await CallingRule.create(ruleData);

      logger.info(`Calling rule created: ${rule.title} by user ${req.user?.id || 'unknown'}`);

      res.status(201).json({
        success: true,
        message: 'Calling rule created successfully',
        data: rule.toJSON()
      });
    } catch (error) {
      logger.error('Error creating calling rule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create calling rule',
        error: error.message
      });
    }
  }

  // Get all calling rules
  static async getAllRules(req, res) {
    try {
      const rules = await CallingRule.getAll();
      
      res.status(200).json({
        success: true,
        message: 'Calling rules retrieved successfully',
        data: rules.map(rule => rule.toJSON())
      });
    } catch (error) {
      logger.error('Error fetching calling rules:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch calling rules',
        error: error.message
      });
    }
  }

  // Get calling rules by type (do/don't)
  static async getRulesByType(req, res) {
    try {
      const { type } = req.params;
      
      if (type !== 'do' && type !== 'dont') {
        return res.status(400).json({
          success: false,
          message: 'Invalid type. Must be "do" or "dont"'
        });
      }

      const isDos = type === 'do';
      const rules = await CallingRule.getByType(isDos);
      
      res.status(200).json({
        success: true,
        message: `${type === 'do' ? 'Do' : 'Don\'t'} rules retrieved successfully`,
        data: rules.map(rule => rule.toJSON())
      });
    } catch (error) {
      logger.error('Error fetching calling rules by type:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch calling rules by type',
        error: error.message
      });
    }
  }

  // Get a specific calling rule by ID
  static async getRuleById(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Rule ID is required'
        });
      }

      const rule = await CallingRule.getById(id);
      
      if (!rule) {
        return res.status(404).json({
          success: false,
          message: 'Calling rule not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Calling rule retrieved successfully',
        data: rule.toJSON()
      });
    } catch (error) {
      logger.error('Error fetching calling rule by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch calling rule',
        error: error.message
      });
    }
  }

  // Update a calling rule
  static async updateRule(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Rule ID is required'
        });
      }

      // Validate weight if provided
      if (updates.weight !== undefined && (typeof updates.weight !== 'number' || updates.weight < 0 || updates.weight > 100)) {
        return res.status(400).json({
          success: false,
          message: 'Weight must be a number between 0 and 100'
        });
      }

      // Validate dos field if provided
      if (updates.dos !== undefined && typeof updates.dos !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Dos field must be a boolean'
        });
      }

      // Get existing rule
      const existingRule = await CallingRule.getById(id);
      if (!existingRule) {
        return res.status(404).json({
          success: false,
          message: 'Calling rule not found'
        });
      }

      // Prepare updates
      const updateData = {};
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();
      if (updates.dos !== undefined) updateData.dos = updates.dos;
      if (updates.weight !== undefined) updateData.weight = Math.round(updates.weight);

      // Validate updated data
      const validationData = { ...existingRule.toJSON(), ...updateData };
      const validationErrors = CallingRule.validate(validationData);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      const updatedRule = await existingRule.update(updateData);

      logger.info(`Calling rule updated: ${updatedRule.title} by user ${req.user?.id || 'unknown'}`);

      res.status(200).json({
        success: true,
        message: 'Calling rule updated successfully',
        data: updatedRule.toJSON()
      });
    } catch (error) {
      logger.error('Error updating calling rule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update calling rule',
        error: error.message
      });
    }
  }

  // Delete a calling rule
  static async deleteRule(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Rule ID is required'
        });
      }

      // Check if rule exists
      const existingRule = await CallingRule.getById(id);
      if (!existingRule) {
        return res.status(404).json({
          success: false,
          message: 'Calling rule not found'
        });
      }

      await CallingRule.deleteById(id);

      logger.info(`Calling rule deleted: ${existingRule.title} by user ${req.user?.id || 'unknown'}`);

      res.status(200).json({
        success: true,
        message: 'Calling rule deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting calling rule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete calling rule',
        error: error.message
      });
    }
  }

  // Get calling rules statistics
  static async getStats(req, res) {
    try {
      const [totalCount, doCount, dontCount] = await Promise.all([
        CallingRule.getCount(),
        CallingRule.getCountByType(true),
        CallingRule.getCountByType(false)
      ]);

      res.status(200).json({
        success: true,
        message: 'Calling rules statistics retrieved successfully',
        data: {
          total: totalCount,
          do: doCount,
          dont: dontCount
        }
      });
    } catch (error) {
      logger.error('Error fetching calling rules statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch calling rules statistics',
        error: error.message
      });
    }
  }
}
