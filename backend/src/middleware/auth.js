import jwt from 'jsonwebtoken';
import { getUserById } from '../config/supabase.js';
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
      const user = await getUserById(decoded.user.id);

      if (!user) {
        return res.status(401).json({ message: 'Not authorized to access this route' });
      }

      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team_name
      };

      next();
    } catch (error) {
      logger.error('Token verification error:', error);
      return res.status(401).json({ message: 'Not authorized to access this route' });
    }
  } else {
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

      const user = await getUserById(decoded.user.id);

      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          team: user.team_name
        };
      }
    } catch (error) {
      // Token is invalid, but we don't fail the request
      logger.debug('Invalid token in optional auth:', error.message);
    }
  }

  next();
};
