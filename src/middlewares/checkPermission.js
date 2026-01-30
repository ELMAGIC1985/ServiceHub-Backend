import { asyncHandler } from '../utils/index.js';

export const checkPermission = (resource, actions) =>
  asyncHandler(async (req, res, next) => {
    const user = req.user;
    const role = req.userRole;

    // Only apply permission checks to admin roles
    if (role !== 'admin' && role !== 'sub_admin') {
      return next(); // Non-admin roles bypass permission checks
    }

    // Full admin has all permissions
    if (role === 'admin') {
      return next();
    }

    // Convert actions to array if string
    const requiredActions = Array.isArray(actions) ? actions : [actions];

    // Check if user has at least one of the required permissions
    const hasPermission = requiredActions.some((action) => user.hasPermission(resource, action));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Required: ${requiredActions.join(' or ')} on ${resource}`,
        requiredPermissions: {
          resource,
          actions: requiredActions,
        },
      });
    }

    next();
  });
