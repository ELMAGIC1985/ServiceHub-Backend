import { asyncHandler } from '../utils/index.js';

export const addLocationFilter = asyncHandler(async (req, res, next) => {
  const user = req.user;
  const role = req.userRole;

  // Only apply to admin roles
  if (role !== 'admin' && role !== 'sub_admin') {
    return next();
  }

  // Full admin or all location access - no filter needed
  if (role === 'admin' || user.hasAllLocationAccess) {
    req.locationFilter = {};
    return next();
  }

  // Add location filter for sub_admin
  req.locationFilter = {
    location: { $in: user.assignedLocations },
  };

  next();
});
