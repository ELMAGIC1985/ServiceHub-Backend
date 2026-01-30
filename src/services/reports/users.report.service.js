import mongoose from 'mongoose';
import { User } from '../../models/index.js';

class UserStatsService {
  async getAllUsersStats(options = {}) {
    const { startDate, endDate, role } = options;

    const matchStage = { isDeleted: false };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    if (role) matchStage.role = role;

    const [stats] = await User.aggregate([
      { $match: matchStage },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                verifiedUsers: {
                  $sum: { $cond: ['$isVerified', 1, 0] },
                },
                emailVerifiedUsers: {
                  $sum: { $cond: ['$isEmailVerified', 1, 0] },
                },
                mobileVerifiedUsers: {
                  $sum: { $cond: ['$isMobileVerified', 1, 0] },
                },
                blockedUsers: {
                  $sum: { $cond: ['$isBlocked', 1, 0] },
                },
                usersWithAvatar: {
                  $sum: { $cond: [{ $ne: ['$avatar', null] }, 1, 0] },
                },
                totalReferralRewards: { $sum: '$referralReward' },
                avgReferralReward: { $avg: '$referralReward' },
              },
            },
          ],
          roleDistribution: [
            {
              $group: {
                _id: '$role',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ],
          verificationStats: [
            {
              $group: {
                _id: {
                  isVerified: '$isVerified',
                  isEmailVerified: '$isEmailVerified',
                  isMobileVerified: '$isMobileVerified',
                },
                count: { $sum: 1 },
              },
            },
          ],
          referralStats: [
            {
              $group: {
                _id: null,
                usersWithReferrals: {
                  $sum: {
                    $cond: [{ $gt: [{ $size: { $ifNull: ['$referredUsers', []] } }, 0] }, 1, 0],
                  },
                },
                totalReferrals: {
                  $sum: { $size: { $ifNull: ['$referredUsers', []] } },
                },
                usersReferred: {
                  $sum: { $cond: [{ $ne: ['$referredBy', null] }, 1, 0] },
                },
              },
            },
          ],
          addressStats: [
            {
              $group: {
                _id: null,
                usersWithAddresses: {
                  $sum: {
                    $cond: [{ $gt: [{ $size: { $ifNull: ['$addresses', []] } }, 0] }, 1, 0],
                  },
                },
                avgAddressesPerUser: {
                  $avg: { $size: { $ifNull: ['$addresses', []] } },
                },
              },
            },
          ],
          bookingStats: [
            {
              $group: {
                _id: null,
                usersWithBookings: {
                  $sum: {
                    $cond: [{ $gt: [{ $size: { $ifNull: ['$bookings', []] } }, 0] }, 1, 0],
                  },
                },
                totalBookings: {
                  $sum: { $size: { $ifNull: ['$bookings', []] } },
                },
                avgBookingsPerUser: {
                  $avg: { $size: { $ifNull: ['$bookings', []] } },
                },
              },
            },
          ],
          membershipStats: [
            {
              $group: {
                _id: null,
                usersWithMembership: {
                  $sum: { $cond: [{ $ne: ['$membership', null] }, 1, 0] },
                },
              },
            },
          ],
          registrationTrend: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 },
          ],
        },
      },
    ]);

    return {
      overview: stats.overview[0] || {},
      roleDistribution: stats.roleDistribution || [],
      verificationStats: stats.verificationStats || [],
      referralStats: stats.referralStats[0] || {},
      addressStats: stats.addressStats[0] || {},
      bookingStats: stats.bookingStats[0] || {},
      membershipStats: stats.membershipStats[0] || {},
      registrationTrend: stats.registrationTrend || [],
    };
  }

  async getUserStats(userId, options = {}) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const { startDate, endDate } = options;

    const user = await User.findById(userId)
      .populate('referredUsers', 'firstName lastName email createdAt')
      .populate('referredBy', 'firstName lastName email')
      .populate('bookings')
      .populate('membership')
      .populate('wallet')
      .select('-password -refreshToken');

    if (!user) {
      throw new Error('User not found');
    }

    // Apply date filters to referredUsers if dates provided
    let filteredReferredUsers = user.referredUsers || [];
    if (startDate || endDate) {
      filteredReferredUsers = filteredReferredUsers.filter((ref) => {
        const refDate = new Date(ref.createdAt);
        if (startDate && refDate < new Date(startDate)) return false;
        if (endDate && refDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Apply date filters to bookings if dates provided
    let filteredBookings = user.bookings || [];
    if (startDate || endDate) {
      filteredBookings = filteredBookings.filter((booking) => {
        const bookingDate = new Date(booking.createdAt);
        if (startDate && bookingDate < new Date(startDate)) return false;
        if (endDate && bookingDate > new Date(endDate)) return false;
        return true;
      });
    }

    const userStats = {
      userInfo: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },

      verificationStatus: {
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
        isMobileVerified: user.isMobileVerified,
        verificationScore: this._calculateVerificationScore(user),
      },

      accountStatus: {
        isBlocked: user.isBlocked,
        isDeleted: user.isDeleted,
        accountAge: this._calculateAccountAge(user.createdAt),
      },

      referralStats: {
        referralCode: user.referralCode,
        referredBy: user.referredBy
          ? {
              id: user.referredBy._id,
              name: `${user.referredBy.firstName} ${user.referredBy.lastName}`,
              email: user.referredBy.email,
            }
          : null,
        totalReferrals: filteredReferredUsers.length,
        referredUsers: filteredReferredUsers.map((ref) => ({
          id: ref._id,
          name: `${ref.firstName} ${ref.lastName}`,
          email: ref.email,
          joinedAt: ref.createdAt,
        })),
        referralReward: user.referralReward || 0,
        dateFiltered: !!(startDate || endDate),
      },

      addressStats: {
        totalAddresses: user.addresses?.length || 0,
        hasDefaultAddress: user.addresses?.some((addr) => addr.isDefault) || false,
        addresses: user.addresses || [],
      },

      bookingStats: {
        totalBookings: filteredBookings.length,
        bookings: filteredBookings,
        dateFiltered: !!(startDate || endDate),
      },

      membershipInfo: user.membership
        ? {
            hasMembership: true,
            membership: user.membership,
          }
        : {
            hasMembership: false,
          },

      walletInfo: user.wallet
        ? {
            hasWallet: true,
            wallet: user.wallet,
          }
        : {
            hasWallet: false,
          },

      couponsStats: {
        totalCoupons: user.coupons?.length || 0,
      },

      deviceInfo: user.fcmToken
        ? {
            hasDevice: true,
            platform: user.fcmToken.platform,
            deviceName: user.fcmToken.deviceName,
            isActive: user.fcmToken.isActive,
            lastUsed: user.fcmToken.lastUsed,
          }
        : {
            hasDevice: false,
          },

      engagementMetrics: {
        isActiveUser: this._isActiveUser(user),
        profileCompleteness: this._calculateProfileCompleteness(user),
      },
    };

    return userStats;
  }

  async getUserGrowthStats(options = {}) {
    const { period = 'monthly', limit = 12 } = options;

    const groupByFormat = this._getGroupByFormat(period);

    const growthData = await User.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: groupByFormat,
          newUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: limit },
    ]);

    return growthData.reverse();
  }

  async getTopReferrers(limit = 10, options = {}) {
    const { startDate, endDate } = options;

    const pipeline = [
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: 'users',
          localField: 'referredUsers',
          foreignField: '_id',
          as: 'referredUsersData',
        },
      },
    ];

    // Add date filtering stage if dates provided
    if (startDate || endDate) {
      const dateMatch = {};
      if (startDate) dateMatch.$gte = new Date(startDate);
      if (endDate) dateMatch.$lte = new Date(endDate);

      pipeline.push({
        $addFields: {
          filteredReferrals: {
            $filter: {
              input: '$referredUsersData',
              as: 'ref',
              cond: {
                $and: [
                  startDate ? { $gte: ['$ref.createdAt', new Date(startDate)] } : true,
                  endDate ? { $lte: ['$ref.createdAt', new Date(endDate)] } : true,
                ].filter((c) => c !== true),
              },
            },
          },
        },
      });
    } else {
      pipeline.push({
        $addFields: {
          filteredReferrals: '$referredUsersData',
        },
      });
    }

    pipeline.push(
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          referralCount: { $size: '$filteredReferrals' },
          referralReward: 1,
          createdAt: 1,
        },
      },
      { $match: { referralCount: { $gt: 0 } } },
      { $sort: { referralCount: -1 } },
      { $limit: limit }
    );

    const topReferrers = await User.aggregate(pipeline);

    return topReferrers;
  }

  async getUserActivityStats(userId, options = {}) {
    const { startDate, endDate } = options;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID');
    }

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const user = await User.findById(userId)
      .populate({
        path: 'bookings',
        match: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
      })
      .populate({
        path: 'referredUsers',
        match: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
      });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      userId: user._id,
      period: {
        startDate: startDate || user.createdAt,
        endDate: endDate || new Date(),
      },
      metrics: {
        bookingsInPeriod: user.bookings?.length || 0,
        referralsInPeriod: user.referredUsers?.length || 0,
        lastActivity: user.updatedAt,
      },
    };
  }

  async getFilteredStats(options = {}) {
    const { startDate, endDate, role, isVerified, isBlocked } = options;

    const matchStage = { isDeleted: false };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    if (role) matchStage.role = role;
    if (typeof isVerified === 'boolean') matchStage.isVerified = isVerified;
    if (typeof isBlocked === 'boolean') matchStage.isBlocked = isBlocked;

    const stats = await User.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
          blockedUsers: { $sum: { $cond: ['$isBlocked', 1, 0] } },
          totalReferralRewards: { $sum: '$referralReward' },
          avgReferralReward: { $avg: '$referralReward' },
          usersWithBookings: {
            $sum: {
              $cond: [{ $gt: [{ $size: { $ifNull: ['$bookings', []] } }, 0] }, 1, 0],
            },
          },
          totalBookings: { $sum: { $size: { $ifNull: ['$bookings', []] } } },
        },
      },
    ]);

    return {
      filters: { startDate, endDate, role, isVerified, isBlocked },
      statistics: stats[0] || {},
      generatedAt: new Date(),
    };
  }

  _calculateVerificationScore(user) {
    let score = 0;
    if (user.isVerified) score += 33;
    if (user.isEmailVerified) score += 33;
    if (user.isMobileVerified) score += 34;
    return score;
  }

  _calculateAccountAge(createdAt) {
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      days: diffDays,
      months: Math.floor(diffDays / 30),
      years: Math.floor(diffDays / 365),
    };
  }

  _isActiveUser(user) {
    const hasBookings = user.bookings && user.bookings.length > 0;
    const hasMembership = !!user.membership;
    const recentlyUpdated = Date.now() - new Date(user.updatedAt) < 30 * 24 * 60 * 60 * 1000;

    return hasBookings || hasMembership || recentlyUpdated;
  }

  _calculateProfileCompleteness(user) {
    const fields = [
      user.firstName,
      user.lastName,
      user.email,
      user.phoneNumber,
      user.dob,
      user.avatar,
      user.addresses?.length > 0,
    ];

    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
  }

  _getGroupByFormat(period) {
    switch (period) {
      case 'daily':
        return {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        };
      case 'weekly':
        return {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' },
        };
      case 'yearly':
        return {
          year: { $year: '$createdAt' },
        };
      default: // monthly
        return {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        };
    }
  }
}

const userStatsService = new UserStatsService();
export { userStatsService };
