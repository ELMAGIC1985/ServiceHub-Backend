import { Booking, Transaction, User, Vendor } from '../../models/index.js';

export const getDashboardKPIs = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const activeUsers = await User.countDocuments({
      isBlocked: false,
      isDeleted: false,
    });

    const verifiedVendors = await Vendor.countDocuments({
      isVerified: true,
      isKYCVerified: true,
    });

    const todaysBookings = await Booking.countDocuments({
      date: { $gte: today, $lt: tomorrow },
    });

    const todaysRevenueResult = await Transaction.aggregate([
      {
        $match: {
          status: 'success',
          createdAt: { $gte: today, $lt: tomorrow },
          transactionFor: { $in: ['service_booking', 'product_order'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
        },
      },
    ]);

    const todaysRevenue = todaysRevenueResult.length > 0 ? todaysRevenueResult[0].totalRevenue : 0;

    const avgRatingResult = await Booking.aggregate([
      {
        $match: {
          'rating.userRating.rating': { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating.userRating.rating' },
        },
      },
    ]);

    const avgRating = avgRatingResult.length > 0 ? avgRatingResult[0].avgRating.toFixed(1) : 0;

    return res.status(200).json({
      success: true,
      data: {
        activeUsers,
        verifiedVendors,
        todaysBookings,
        todaysRevenue,
        avgRatingResult,
        avgRating,
      },
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard KPIs',
      error: error.message,
    });
  }
};
