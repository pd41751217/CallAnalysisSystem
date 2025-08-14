import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { UserController } from '../controllers/UserController.js';
import { logger } from '../utils/logger.js';
import { protect, authorize } from '../middleware/auth.js';

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
    const result = await UserController.getAllUsers();
    
    res.json({
      users: result.users,
      pagination: result.pagination
    });

  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/teams
// @desc    Get all teams
// @access  Private (Admin, Team Lead)
router.get('/teams', authorize('admin', 'team_lead'), async (req, res) => {
  try {
    const teams = await UserController.getAllTeams();
    res.json(teams);
  } catch (error) {
    logger.error('Get teams error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/teams
// @desc    Create new team
// @access  Private (Admin only)
router.post('/teams', authorize('admin'), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Team name is required' });
    }

    const newTeam = await UserController.createTeam({ name, description });
    res.status(201).json(newTeam);
  } catch (error) {
    logger.error('Create team error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin, Team Lead, or own profile)
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user is accessing their own profile or has admin/team_lead role
    if (req.user.id !== parseInt(userId) && !['admin', 'team_lead'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to access this user' });
    }

    const user = await UserController.getUserById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
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

    const { name, email, role, team_id, password } = req.body;

    const userData = {
      name,
      email,
      password,
      role,
      team_id: team_id || null,
      status: 'active'
    };

    const newUser = await UserController.createUser(userData);
    res.status(201).json(newUser);
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin, Team Lead, or own profile)
router.put('/:id', validateUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    
    // Check if user is updating their own profile or has admin/team_lead role
    if (req.user.id !== parseInt(userId) && !['admin', 'team_lead'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to update this user' });
    }

    const { name, email, role, team_id } = req.body;
    
    const updates = {
      name,
      email,
      role,
      team_id: team_id || null
    };

    const updatedUser = await UserController.updateUser(userId, updates);
    res.json(updatedUser);
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    await UserController.deleteUser(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
