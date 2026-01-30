import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/user.model.js';
import { Admin } from '../models/admin.model.js';
import Vendor from '../models/vendor.model.js';
import admin from '../config/firebase.js';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';

// Base authentication helper function
export const authenticateToken = async (accessToken) => {
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const decodedFirebaseToken = await admin.auth().verifyIdToken(accessToken);

  console.log(decodedFirebaseToken);

  const { uid: firebaseUID, email, email_verified, role, userType } = decodedFirebaseToken;

  if (role === 'admin') {
    return { _id: firebaseUID, email: email, isVerified: true, role, userType };
  } else if (!email_verified) {
    return { _id: firebaseUID, email: email, isVerified: false, role, userType };
  } else {
    return { _id: firebaseUID, email: email, isVerified: true, role, userType };
  }
};

export const authMiddleware = (requiredRole) =>
  asyncHandler(async (req, res, next) => {
    const accessToken = req?.headers['authorization']?.split(' ')[1] || req.cookies?.accessToken;

    try {
      if (!accessToken) {
        return res.status(401).json({
          success: false,
          message: 'Access token is required',
        });
      }

      // Verify JWT token
      let decodedToken;
      try {
        decodedToken = jwt.verify(accessToken, config.ACCESS_TOKEN.SECRET);
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError.message);
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired access token',
        });
      }

      const { _id, role } = decodedToken;

      if (!_id || !role) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token structure',
        });
      }

      // Determine user type based on roles
      let user;
      let userType;

      if (role === 'admin' || role === 'sub_admin') {
        userType = 'Admin';
        user = await Admin.findById(_id).select('-password -refreshToken');
      } else if (role === 'vendor') {
        userType = 'Vendor';
        user = await Vendor.findById(_id).select('-password -refreshToken').populate('address').populate('wallet');
      } else if (role === 'user') {
        userType = 'User';
        user = await User.findById(_id).select('-password -refreshToken');
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid user role in token',
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found or may have been deleted',
        });
      }

      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Account has been blocked. Please contact support.',
        });
      }

      // Attach user info to request
      req.user = user;
      req.userRole = role;
      req.userType = userType;
      req._id = _id;

      // Check required role if specified
      if (requiredRole) {
        let hasRequiredRole = false;

        if (Array.isArray(requiredRole)) {
          hasRequiredRole = requiredRole.some((r) => r === role);
        } else if (typeof requiredRole === 'string') {
          hasRequiredRole = requiredRole === role;
        }

        if (!hasRequiredRole) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient permissions to access this resource',
            requiredRole,
            userRole: role,
          });
        }
      }

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authentication error',
        error: error.message,
      });
    }
  });

export default authMiddleware;
