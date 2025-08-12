import nodemailer from 'nodemailer';
import { logger } from './logger.js';

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (email, token) => {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@callanalysis.com',
      to: email,
      subject: 'Password Reset Request - Call Analysis System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Call Analysis System</h2>
          <h3>Password Reset Request</h3>
          <p>You requested a password reset for your account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from the Call Analysis System. Please do not reply to this email.
          </p>
        </div>
      `,
      text: `
        Call Analysis System - Password Reset Request
        
        You requested a password reset for your account.
        
        Click the following link to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour.
        
        If you didn't request this password reset, please ignore this email.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw error;
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@callanalysis.com',
      to: email,
      subject: 'Welcome to Call Analysis System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Call Analysis System</h2>
          <h3>Welcome, ${name}!</h3>
          <p>Your account has been successfully created.</p>
          <p>You can now log in to the Call Analysis System and start monitoring calls.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login" 
               style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Login to System
            </a>
          </div>
          <p>If you have any questions, please contact your system administrator.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from the Call Analysis System. Please do not reply to this email.
          </p>
        </div>
      `,
      text: `
        Call Analysis System - Welcome
        
        Welcome, ${name}!
        
        Your account has been successfully created.
        You can now log in to the Call Analysis System and start monitoring calls.
        
        Login URL: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}/login
        
        If you have any questions, please contact your system administrator.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info('Welcome email sent:', info.messageId);
    return info;
  } catch (error) {
    logger.error('Error sending welcome email:', error);
    throw error;
  }
};

// Test email configuration
export const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration is valid');
    return true;
  } catch (error) {
    logger.error('Email configuration error:', error);
    return false;
  }
};
