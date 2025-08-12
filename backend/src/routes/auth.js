import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { sendPasswordResetEmail } from '../utils/email.js';

const router = express.Router();

// Validation middleware
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

const validateForgotPassword = [
  body('email').isEmail().normalizeEmail()
];

const validateResetPassword = [
  body('token').notEmpty(),
  body('password').isLength({ min: 6 })
];

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const userResult = await query(
      `SELECT u.*, t.name as team_name 
       FROM users u 
       LEFT JOIN teams t ON u.team_id = t.id 
       WHERE u.email = $1 AND u.status = 'active'`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove password from response
    delete user.password_hash;

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team_name
      }
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/verify
// @desc    Verify JWT token
// @access  Private
router.post('/verify', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user data
    const userResult = await query(
      `SELECT u.*, t.name as team_name 
       FROM users u 
       LEFT JOIN teams t ON u.team_id = t.id 
       WHERE u.id = $1 AND u.status = 'active'`,
      [decoded.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    const user = userResult.rows[0];
    delete user.password_hash;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team_name
      }
    });

  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', validateForgotPassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Check if user exists
    const userResult = await query(
      'SELECT id, name, email FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const user = userResult.rows[0];

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in database
    await query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, new Date(Date.now() + 3600000)] // 1 hour
    );

    // Send email
    try {
      await sendPasswordResetEmail(user.email, resetToken);
      res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (emailError) {
      logger.error('Email sending error:', emailError);
      res.status(500).json({ message: 'Failed to send reset email' });
    }

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', validateResetPassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Check if token exists in database and is not expired
    const tokenResult = await query(
      'SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, decoded.userId]
    );

    // Delete used token
    await query(
      'DELETE FROM password_reset_tokens WHERE token = $1',
      [token]
    );

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', async (req, res) => {
  try {
    // In a more advanced setup, you might want to blacklist the token
    // For now, we'll just return success and let the client remove the token
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
