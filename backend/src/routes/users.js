import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendWelcomeEmail } from '../utils/email.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// Validation middleware
const validateUser = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'team_lead', 'agent']),
  body('team_id').optional().isInt()
];

const validatePassword = [
  body('password').isLength({ min: 6 })
];

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Admin, Team Lead)
router.get('/', authorize('admin', 'team_lead'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', team = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE u.status != $1';
    let params = ['deleted'];
    let paramCount = 1;

    if (search) {
      paramCount++;
      whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      whereClause += ` AND u.role = $${paramCount}`;
      params.push(role);
    }

    if (team) {
      paramCount++;
      whereClause += ` AND t.name ILIKE $${paramCount}`;
      params.push(`%${team}%`);
    }

    // Get users with pagination
    const usersResult = await query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.last_login, u.created_at, 
              t.id as team_id, t.name as team_name
       FROM users u 
       LEFT JOIN teams t ON u.team_id = t.id 
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM users u 
       LEFT JOIN teams t ON u.team_id = t.id 
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      users: usersResult.rows,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        totalRecords: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin, Team Lead, or own profile)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user can access this profile
    if (req.user.role !== 'admin' && req.user.role !== 'team_lead' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: 'Not authorized to access this user' });
    }

    const userResult = await query(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.last_login, u.created_at, u.updated_at,
              t.id as team_id, t.name as team_name
       FROM users u 
       LEFT JOIN teams t ON u.team_id = t.id 
       WHERE u.id = $1 AND u.status != 'deleted'`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: userResult.rows[0] });

  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users
// @desc    Create new user
// @access  Private (Admin, Team Lead)
router.post('/', authorize('admin', 'team_lead'), validateUser, validatePassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, team_id } = req.body;

    // Check if email already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await query(
      `INSERT INTO users (name, email, password_hash, role, team_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, role, status, created_at`,
      [name, email, hashedPassword, role, team_id || null]
    );

    const newUser = userResult.rows[0];

    // Send welcome email
    try {
      await sendWelcomeEmail(email, name);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
      // Don't fail the user creation if email fails
    }

    logger.info(`User created: ${newUser.email} by ${req.user.email}`);
    res.status(201).json({ user: newUser });

  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin, Team Lead, or own profile)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, team_id, status } = req.body;

    // Check if user can update this profile
    if (req.user.role !== 'admin' && req.user.role !== 'team_lead' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }

    // Check if user exists
    const existingUser = await query(
      'SELECT * FROM users WHERE id = $1 AND status != $2',
      [id, 'deleted']
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== existingUser.rows[0].email) {
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    // Update user
    const updateResult = await query(
      `UPDATE users 
       SET name = COALESCE($1, name), 
           email = COALESCE($2, email), 
           role = COALESCE($3, role), 
           team_id = COALESCE($4, team_id), 
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 
       RETURNING id, name, email, role, status, team_id, updated_at`,
      [name, email, role, team_id, status, id]
    );

    logger.info(`User updated: ${updateResult.rows[0].email} by ${req.user.email}`);
    res.json({ user: updateResult.rows[0] });

  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete)
// @access  Private (Admin)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await query(
      'SELECT * FROM users WHERE id = $1 AND status != $2',
      [id, 'deleted']
    );

    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting own account
    if (req.user.id === parseInt(id)) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Soft delete user
    await query(
      'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['deleted', id]
    );

    logger.info(`User deleted: ${existingUser.rows[0].email} by ${req.user.email}`);
    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/teams
// @desc    Get all teams
// @access  Private
router.get('/teams', async (req, res) => {
  try {
    const teamsResult = await query(
      'SELECT id, name, description, created_at FROM teams ORDER BY name'
    );

    res.json({ teams: teamsResult.rows });

  } catch (error) {
    logger.error('Get teams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/teams
// @desc    Create new team
// @access  Private (Admin)
router.post('/teams', authorize('admin'), [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    // Check if team name already exists
    const existingTeam = await query(
      'SELECT id FROM teams WHERE name = $1',
      [name]
    );

    if (existingTeam.rows.length > 0) {
      return res.status(400).json({ message: 'Team name already exists' });
    }

    // Create team
    const teamResult = await query(
      'INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );

    logger.info(`Team created: ${name} by ${req.user.email}`);
    res.status(201).json({ team: teamResult.rows[0] });

  } catch (error) {
    logger.error('Create team error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
