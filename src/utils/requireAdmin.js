export const requireAdmin = (req, res, next) => {
  if (!req.user.roles.includes('admin')) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};
