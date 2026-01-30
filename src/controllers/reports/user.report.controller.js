import { userStatsService } from '../../services/reports/users.report.service.js';
import { ApiResponse, ApiError, asyncHandler } from '../../utils/index.js';

class UserStatsController {
  getAllUsersStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, role } = req.query;

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, 'startDate cannot be after endDate');
    }

    const options = {
      startDate,
      endDate,
      role,
    };

    const stats = await userStatsService.getAllUsersStats(options);

    return res.status(200).json(new ApiResponse(200, stats, 'All users statistics retrieved successfully'));
  });

  getUserStats = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Check authorization - user can only view their own stats unless admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      throw new ApiError(403, 'You are not authorized to view these statistics');
    }

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, 'startDate cannot be after endDate');
    }

    const options = { startDate, endDate };

    const stats = await userStatsService.getUserStats(userId, options);

    return res.status(200).json(new ApiResponse(200, stats, 'User statistics retrieved successfully'));
  });

  getUserGrowthStats = asyncHandler(async (req, res) => {
    const { period = 'monthly', limit = 12 } = req.query;

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];
    if (!validPeriods.includes(period)) {
      throw new ApiError(400, `Invalid period. Must be one of: ${validPeriods.join(', ')}`);
    }

    // Validate limit
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new ApiError(400, 'Limit must be between 1 and 100');
    }

    const options = {
      period,
      limit: parsedLimit,
    };

    const growthStats = await userStatsService.getUserGrowthStats(options);

    return res.status(200).json(new ApiResponse(200, growthStats, 'User growth statistics retrieved successfully'));
  });

  getTopReferrers = asyncHandler(async (req, res) => {
    const { limit = 10, startDate, endDate } = req.query;

    // Validate limit
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new ApiError(400, 'Limit must be between 1 and 100');
    }

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, 'startDate cannot be after endDate');
    }

    const options = { startDate, endDate };

    const topReferrers = await userStatsService.getTopReferrers(parsedLimit, options);

    return res.status(200).json(new ApiResponse(200, topReferrers, 'Top referrers retrieved successfully'));
  });

  getUserActivityStats = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Check authorization - user can only view their own stats unless admin
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      throw new ApiError(403, 'You are not authorized to view these statistics');
    }

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, 'startDate cannot be after endDate');
    }

    const options = { startDate, endDate };

    const activityStats = await userStatsService.getUserActivityStats(userId, options);

    return res.status(200).json(new ApiResponse(200, activityStats, 'User activity statistics retrieved successfully'));
  });

  getFilteredStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, role, isVerified, isBlocked } = req.query;

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, 'startDate cannot be after endDate');
    }

    // Convert string booleans to actual booleans
    const options = {
      startDate,
      endDate,
      role,
    };

    if (isVerified !== undefined) {
      options.isVerified = isVerified === 'true';
    }
    if (isBlocked !== undefined) {
      options.isBlocked = isBlocked === 'true';
    }

    const stats = await userStatsService.getFilteredStats(options);

    return res.status(200).json(new ApiResponse(200, stats, 'Filtered statistics retrieved successfully'));
  });

  getMyStats = asyncHandler(async (req, res) => {
    console.log('Req', req.user);
    const userId = req.user._id.toString();
    const { startDate, endDate } = req.query;

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      throw new ApiError(400, 'startDate cannot be after endDate');
    }

    const options = { startDate, endDate };

    const stats = await userStatsService.getUserStats(userId, options);

    return res.status(200).json(new ApiResponse(200, stats, 'Your statistics retrieved successfully'));
  });

  getDashboardStats = asyncHandler(async (req, res) => {
    const { period = '30' } = req.query; // Default last 30 days

    const parsedPeriod = parseInt(period);
    if (isNaN(parsedPeriod) || parsedPeriod < 1 || parsedPeriod > 365) {
      throw new ApiError(400, 'Period must be between 1 and 365 days');
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parsedPeriod);

    // Get multiple stats in parallel for better performance
    const [allStats, growthStats, topReferrers, filteredStats] = await Promise.all([
      userStatsService.getAllUsersStats({}),
      userStatsService.getUserGrowthStats({ period: 'daily', limit: parsedPeriod }),
      userStatsService.getTopReferrers(5, {}),
      userStatsService.getFilteredStats({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      }),
    ]);

    const dashboardData = {
      overview: allStats.overview,
      recentPeriod: {
        days: parsedPeriod,
        statistics: filteredStats.statistics,
      },
      growth: growthStats,
      topReferrers,
      roleDistribution: allStats.roleDistribution,
      generatedAt: new Date(),
    };

    return res.status(200).json(new ApiResponse(200, dashboardData, 'Dashboard statistics retrieved successfully'));
  });

  exportStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, format = 'json' } = req.query;

    // Validate date formats if provided
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ApiError(400, 'Invalid startDate format. Use ISO 8601 format.');
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ApiError(400, 'Invalid endDate format. Use ISO 8601 format.');
    }

    const options = { startDate, endDate };
    const stats = await userStatsService.getAllUsersStats(options);

    if (format === 'csv') {
      // Set CSV headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=user-stats-${Date.now()}.csv`);

      // Simple CSV conversion (you might want to use a library like json2csv)
      const csvData = this._convertToCSV(stats);
      return res.status(200).send(csvData);
    }

    // Default JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=user-stats-${Date.now()}.json`);

    return res.status(200).json(stats);
  });

  _convertToCSV(stats) {
    const { overview } = stats;
    const headers = Object.keys(overview).join(',');
    const values = Object.values(overview).join(',');
    return `${headers}\n${values}`;
  }
}

const userStatsController = new UserStatsController();
export { userStatsController };
