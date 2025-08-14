import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { 
  getUserByEmail, 
  getUserById, 
  updateUser, 
  createPasswordResetToken, 
  getPasswordResetToken, 
  markPasswordResetTokenUsed 
} from '../config/supabase.js';
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

    // Check if user exists using Supabase
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await updateUser(user.id, { last_login: new Date().toISOString() });

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
    
    // Get user data using Supabase
    const user = await getUserById(decoded.user.id);

    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

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

    // Check if user exists using Supabase
    const user = await getUserByEmail(email);

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in database using Supabase
    await createPasswordResetToken({
      user_id: user.id,
      token: resetToken,
      expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
    });

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

    // Check if token exists in database and is not expired using Supabase
    const resetToken = await getPasswordResetToken(token);

    if (!resetToken) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password using Supabase
    await updateUser(decoded.userId, { password_hash: hashedPassword });

    // Mark token as used using Supabase
    await markPasswordResetTokenUsed(token);

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
