import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

// Protect routes
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from the token
      const userResult = await query(
        `SELECT u.*, t.name as team_name 
         FROM users u 
         LEFT JOIN teams t ON u.team_id = t.id 
         WHERE u.id = $1 AND u.status = 'active'`,
        [decoded.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ message: 'Not authorized to access this route' });
      }

      req.user = {
        id: userResult.rows[0].id,
        name: userResult.rows[0].name,
        email: userResult.rows[0].email,
        role: userResult.rows[0].role,
        team: userResult.rows[0].team_name
      };

      next();
    } catch (error) {
      logger.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized to access this route' });
  }
};

// Grant access to specific roles
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const userResult = await query(
        `SELECT u.*, t.name as team_name 
         FROM users u 
         LEFT JOIN teams t ON u.team_id = t.id 
         WHERE u.id = $1 AND u.status = 'active'`,
        [decoded.user.id]
      );

      if (userResult.rows.length > 0) {
        req.user = {
          id: userResult.rows[0].id,
          name: userResult.rows[0].name,
          email: userResult.rows[0].email,
          role: userResult.rows[0].role,
          team: userResult.rows[0].team_name
        };
      }
    } catch (error) {
      // Token is invalid, but we don't fail the request
      logger.debug('Invalid token in optional auth:', error.message);
    }
  }

  next();
};
