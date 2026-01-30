import { asyncHandler } from '../utils/index.js';

export const checkLocationAccess = (locationField = 'location') =>
  asyncHandler(async (req, res, next) => {
    const user = req.user;
    const role = req.userRole;

    if (role !== 'admin' && role !== 'sub_admin') {
      return next();
    }

    if (role === 'admin' || user.hasAllLocationAccess) {
      return next();
    }

    const location = req.body?.[locationField] || req.params?.[locationField] || req.query?.[locationField];

    if (!location && req.resource && req.resource[locationField]) {
      const resourceLocation = req.resource[locationField];
      if (!user.hasLocationAccess(resourceLocation)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to access resources in location: ${resourceLocation}`,
          userLocations: user.assignedLocations,
        });
      }
      return next();
    }

    if (location && !user.hasLocationAccess(location)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You don't have permission to access location: ${location}`,
        userLocations: user.assignedLocations,
      });
    }

    next();
  });
