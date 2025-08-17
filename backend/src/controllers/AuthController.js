import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Session, PasswordResetToken } from '../models/index.js';
import { sendPasswordResetEmail } from '../utils/email.js';
import { logger } from '../utils/logger.js';

export class AuthController {
  static async login(email, password) {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await User.verifyPassword(user, password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Update last login
      await User.updateLastLogin(user.id);

      // Generate JWT token
      const token = jwt.sign(
        { 
          user: { 
            id: user.id, 
            email: user.email, 
            role: user.role 
          } 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Create session
      const sessionData = {
        user_id: user.id,
        session_token: token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      };
      await Session.create(sessionData);

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          team: user.teams?.name
        }
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  static async logout(token) {
    try {
      // Delete session
      await Session.deleteByToken(token);
      return true;
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  static async forgotPassword(email) {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return { message: 'If the email exists, a password reset link has been sent.' };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Delete any existing tokens for this user
      await PasswordResetToken.deleteByUserId(user.id);

      // Create new reset token
      const tokenData = {
        user_id: user.id,
        token: resetToken,
        expires_at: expiresAt,
        used: false
      };
      await PasswordResetToken.create(tokenData);

      // Send email
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await sendPasswordResetEmail(user.email, user.name, resetUrl);

      return { message: 'If the email exists, a password reset link has been sent.' };
    } catch (error) {
      logger.error('Forgot password error:', error);
      throw error;
    }
  }

  static async resetPassword(token, newPassword) {
    try {
      // Find valid reset token
      const resetToken = await PasswordResetToken.findByToken(token);
      if (!resetToken) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const hashedPassword = await User.hashPassword(newPassword);

      // Update user password
      await User.update(resetToken.user_id, { password_hash: hashedPassword });

      // Mark token as used
      await PasswordResetToken.markAsUsed(token);

      return { message: 'Password reset successfully' };
    } catch (error) {
      logger.error('Reset password error:', error);
      throw error;
    }
  }

  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.user.id);
      
      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.teams?.name
      };
    } catch (error) {
      logger.error('Token verification error:', error);
      throw error;
    }
  }

  static async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.user.id);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      const newToken = jwt.sign(
        { 
          user: { 
            id: user.id, 
            email: user.email, 
            role: user.role 
          } 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Update session
      await Session.deleteByToken(token);
      const sessionData = {
        user_id: user.id,
        session_token: newToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };
      await Session.create(sessionData);

      return {
        token: newToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          team: user.teams?.name
        }
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }
}
