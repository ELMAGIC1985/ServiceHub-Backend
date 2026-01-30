import mongoose from 'mongoose';
import { Booking, Vendor, VendorService } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { VERIFICATION_STATUSES } from '../../models/vendor.model.js';
import { vendorManagementSchema } from '../../validators/vendor/vendor.validation.js';

const getAllVendors = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      isVerified,
      isEmailVerified,
      isMobileVerified,
      isKYCVerified,
      kycStatus,
      isAvailable,
      isBlocked,
      isOnline,
      serviceCategory,
      documentType,
      dateFrom,
      dateTo,
      ageFrom,
      ageTo,
      hasReferrals,
      hasWallet,
      minKycAmount,
      maxKycAmount,
      latitude,
      longitude,
      radius = 10,
      hasDocuments,
      platform,
      lastSeenFrom,
      lastSeenTo,
    } = req.query;

    // Build filter object
    const filter = {};

    // Verification status filters
    if (isVerified && isVerified.toLowerCase() !== 'all') {
      filter.isVerified = isVerified === 'true';
    }

    if (isEmailVerified && isEmailVerified.toLowerCase() !== 'all') {
      filter.isEmailVerified = isEmailVerified === 'true';
    }

    if (isMobileVerified && isMobileVerified.toLowerCase() !== 'all') {
      filter.isMobileVerified = isMobileVerified === 'true';
    }

    if (isKYCVerified && isKYCVerified.toLowerCase() !== 'all') {
      filter.isKYCVerified = isKYCVerified === 'true';
    }

    // KYC status filter
    if (kycStatus && kycStatus.toLowerCase() !== 'all' && Object.values(VERIFICATION_STATUSES).includes(kycStatus)) {
      filter.kycStatus = kycStatus;
    }

    // Availability and status filters
    if (isAvailable && isAvailable.toLowerCase() !== 'all') {
      filter.isAvailable = isAvailable === 'true';
    }

    if (isBlocked && isBlocked.toLowerCase() !== 'all') {
      filter.isBlocked = isBlocked === 'true';
    }

    if (isOnline && isOnline.toLowerCase() !== 'all') {
      filter.isOnline = isOnline === 'true';
    }

    // Service category filter
    if (
      serviceCategory &&
      serviceCategory.toLowerCase() !== 'all' &&
      mongoose.Types.ObjectId.isValid(serviceCategory)
    ) {
      filter.serviceCategories = { $in: [new mongoose.Types.ObjectId(serviceCategory)] };
    }

    // Document type filter
    if (documentType && documentType.toLowerCase() !== 'all') {
      filter.documentType = documentType;
    }

    // Documents availability filter
    if (hasDocuments === 'true') {
      filter.$and = [{ documentImage: { $exists: true, $ne: null } }, { selfieImage: { $exists: true, $ne: null } }];
    } else if (hasDocuments === 'false') {
      filter.$or = [
        { documentImage: { $exists: false } },
        { documentImage: null },
        { selfieImage: { $exists: false } },
        { selfieImage: null },
      ];
    }

    // KYC amount filter
    if (minKycAmount !== undefined || maxKycAmount !== undefined) {
      filter.kycAmount = {};
      if (minKycAmount !== undefined && !isNaN(minKycAmount) && minKycAmount !== '') {
        filter.kycAmount.$gte = parseFloat(minKycAmount);
      }
      if (maxKycAmount !== undefined && !isNaN(maxKycAmount) && maxKycAmount !== '') {
        filter.kycAmount.$lte = parseFloat(maxKycAmount);
      }
    }

    // Date range filter (registration date)
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom && dateFrom !== '') {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo && dateTo !== '') {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Age filter (calculated from DOB)
    if (ageFrom !== undefined || ageTo !== undefined) {
      const currentDate = new Date();
      if (ageTo !== undefined && !isNaN(ageTo) && ageTo !== '') {
        const minDob = new Date(
          currentDate.getFullYear() - parseInt(ageTo) - 1,
          currentDate.getMonth(),
          currentDate.getDate()
        );
        filter.dob = { ...filter.dob, $gte: minDob };
      }
      if (ageFrom !== undefined && !isNaN(ageFrom) && ageFrom !== '') {
        const maxDob = new Date(
          currentDate.getFullYear() - parseInt(ageFrom),
          currentDate.getMonth(),
          currentDate.getDate()
        );
        filter.dob = { ...filter.dob, $lte: maxDob };
      }
    }

    // Last seen filter
    if (lastSeenFrom || lastSeenTo) {
      filter.lastSeen = {};
      if (lastSeenFrom && lastSeenFrom !== '') {
        filter.lastSeen.$gte = new Date(lastSeenFrom);
      }
      if (lastSeenTo && lastSeenTo !== '') {
        filter.lastSeen.$lte = new Date(lastSeenTo);
      }
    }

    // Referral filter
    if (hasReferrals === 'true') {
      filter.referredUsers = { $exists: true, $ne: [] };
    } else if (hasReferrals === 'false') {
      filter.$or = [{ referredUsers: { $exists: false } }, { referredUsers: { $size: 0 } }];
    }

    // Wallet filter
    if (hasWallet === 'true') {
      filter.wallet = { $exists: true, $ne: null };
    } else if (hasWallet === 'false') {
      filter.$or = [{ wallet: { $exists: false } }, { wallet: null }];
    }

    // Platform filter (from FCM tokens)
    if (platform && platform.toLowerCase() !== 'all') {
      filter['fcmTokens.platform'] = platform;
    }

    // Location-based filtering
    let geoFilter = null;
    if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
      const radiusInMeters = parseInt(radius) * 1000; // Convert km to meters
      geoFilter = {
        currentCoordinates: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            $maxDistance: radiusInMeters,
          },
        },
      };
    }

    // Combine geo filter with other filters
    const finalFilter = geoFilter ? { ...filter, ...geoFilter } : filter;

    // Search functionality
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search, $options: 'i' };
      finalFilter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { referralCode: searchRegex },
      ];
    }

    // Count total documents for pagination
    const totalVendors = await Vendor.countDocuments(finalFilter);

    // Sort configuration
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination calculation
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Fetch vendors with populated references
    const vendors = await Vendor.find(finalFilter)
      .select('-password -refreshToken')
      .populate('address')
      .populate('wallet')
      .populate('referredBy', 'firstName lastName email')
      .populate('referredUsers', 'firstName lastName email createdAt')
      .populate({
        path: 'services',
        populate: [
          { path: 'service', model: 'VendorService', select: 'title description' },
          { path: 'category', model: 'Category', select: 'name description' },
          { path: 'childCategory', model: 'Category', select: 'name description' },
        ],
      })
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    // Enhance vendors with computed fields
    const enhancedVendors = vendors.map((vendor) => {
      // Calculate age from DOB
      const age = vendor.dob ? Math.floor((new Date() - new Date(vendor.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null;

      // Count referrals
      const referralCount = vendor.referredUsers ? vendor.referredUsers.length : 0;

      // Count active devices
      const activeDevices = vendor.fcmToken ? vendor.fcmToken.isActive : 0;

      // Verification completion score
      let verificationScore = 0;
      if (vendor.isEmailVerified) verificationScore += 25;
      if (vendor.isKYCPaymentVerified) verificationScore += 25;
      if (vendor.isKYCVerified) verificationScore += 25;

      // Profile completeness score
      let profileScore = 0;
      if (vendor.firstName) profileScore += 15;
      if (vendor.lastName) profileScore += 15;
      if (vendor.email) profileScore += 15;
      if (vendor.phoneNumber) profileScore += 15;
      if (vendor.dob) profileScore += 10;
      if (vendor.avatar) profileScore += 10;
      if (vendor.serviceCategories && vendor.serviceCategories.length > 0) profileScore += 20;

      // Status badge
      let statusBadge = 'inactive';
      if (vendor.isBlocked) {
        statusBadge = 'blocked';
      } else if (vendor.isVerified && vendor.isKYCVerified) {
        statusBadge = 'verified';
      } else if (vendor.kycStatus === 'approved') {
        statusBadge = 'approved';
      } else if (vendor.kycStatus === 'pending') {
        statusBadge = 'pending';
      } else {
        statusBadge = 'incomplete';
      }

      // Last activity calculation
      const daysSinceLastSeen = vendor.lastSeen
        ? Math.floor((new Date() - new Date(vendor.lastSeen)) / (24 * 60 * 60 * 1000))
        : null;

      return {
        ...vendor,
        // Remove sensitive/verbose data for list view
        fcmTokens: undefined,
        addresses: undefined,
        services: Array.isArray(vendor.services) ? vendor.services.map((s) => s.childCategory.name) : [],
        // Add computed fields
        age,
        referralCount,
        activeDevices,
        verificationScore,
        profileScore,
        statusBadge,
        daysSinceLastSeen,
        isRecentlyActive: daysSinceLastSeen !== null && daysSinceLastSeen <= 7,
        // Add formatted fields
        fullName: `${vendor.firstName} ${vendor.lastName}`.trim(),
        formattedReferralReward: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(vendor.referralReward || 0),
        formattedKycAmount: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(vendor.kycAmount || 0),
        registrationDate: new Date(vendor.createdAt).toLocaleDateString(),
        lastSeenFormatted: vendor.lastSeen ? new Date(vendor.lastSeen).toLocaleDateString() : 'Never',
        // Add summary counts
        hasWallet: !!vendor.wallet,
        hasReferrals: referralCount > 0,
        hasDocuments: !!(vendor.documentImage && vendor.selfieImage),
        serviceCount: vendor.serviceCategories ? vendor.serviceCategories.length : 0,
        // Location info (if available)
        hasLocation: !!(
          vendor.currentCoordinates &&
          vendor.currentCoordinates.coordinates &&
          vendor.currentCoordinates.coordinates[0] !== 0 &&
          vendor.currentCoordinates.coordinates[1] !== 0
        ),
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalVendors / limitNum);
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Get basic statistics
    const statisticsPromises = [
      Vendor.countDocuments({ isVerified: true }),
      Vendor.countDocuments({ isKYCVerified: true }),
      Vendor.countDocuments({ isAvailable: true }),
      Vendor.countDocuments({ isOnline: true }),
      Vendor.countDocuments({ isBlocked: true }),
      Vendor.aggregate([{ $group: { _id: '$kycStatus', count: { $sum: 1 } } }]),
      Vendor.aggregate([
        { $match: { referredUsers: { $exists: true } } },
        { $addFields: { referralCount: { $size: '$referredUsers' } } },
        { $group: { _id: null, totalReferrals: { $sum: '$referralCount' }, avgReferrals: { $avg: '$referralCount' } } },
      ]),
    ];

    const [
      verifiedVendors,
      kycVerifiedVendors,
      availableVendors,
      onlineVendors,
      blockedVendors,
      kycStatusStats,
      referralStats,
    ] = await Promise.all(statisticsPromises);

    // Prepare response
    const response = {
      success: true,
      data: {
        vendors: enhancedVendors,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          total: totalVendors,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          skip,
          showing: `${skip + 1}-${Math.min(skip + limitNum, totalVendors)} of ${totalVendors}`,
        },
        statistics: {
          total: totalVendors,
          verified: verifiedVendors,
          kycVerified: kycVerifiedVendors,
          available: availableVendors,
          online: onlineVendors,
          blocked: blockedVendors,
          byKycStatus: kycStatusStats,
          referrals: referralStats[0] || { totalReferrals: 0, avgReferrals: 0 },
        },
      },
      message: `Retrieved ${enhancedVendors.length} vendor(s) successfully`,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching vendors:', error);

    const errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';

    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendors',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

const getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUser = req.userRole;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vendor ID format',
      });
    }

    // Check authorization - vendors can only access their own profile unless they're admin
    const isAdmin = requestingUser === 'admin';
    const isOwner = req.user?._id?.toString() === id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own profile.',
      });
    }

    // Determine field selection based on role
    const selectFields = isAdmin
      ? '-password -refreshToken' // Admin can see most fields except sensitive ones
      : '-password -refreshToken -firebaseUID'; // Vendor can't see their own firebaseUID

    // Find vendor with populated references
    const vendor = await Vendor.findById(id)
      .select(selectFields)
      .populate('address')
      // .populate('serviceCategories', 'name description slug')
      // .populate('serviceChildCategories', 'name description slug')
      .populate('wallet', 'balance currency status')
      .populate('referredBy', 'firstName lastName email phoneNumber')
      .populate('referredUsers', 'firstName lastName email phoneNumber createdAt')
      // .populate('services.serviceId', 'name description basePrice')
      .lean()
      .exec();

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    // Get additional aggregated data
    const [bookingStats, serviceStats] = await Promise.all([
      // Get booking statistics if bookings collection exists
      Booking.aggregate([
        { $match: { vendor: new mongoose.Types.ObjectId(id) } },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            completedBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            cancelledBookings: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            totalEarnings: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, '$pricing.totalAmount', 0],
              },
            },
            avgRating: { $avg: '$rating.userRating.rating' },
          },
        },
      ]),

      VendorService.countDocuments({
        vendorId: new mongoose.Types.ObjectId(id),
      }),
    ]);

    const stats = bookingStats[0] || {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalEarnings: 0,
      avgRating: 0,
    };

    // Calculate enhanced vendor data
    const enhancedVendor = {
      ...vendor,

      // Basic computed fields
      fullName: `${vendor.firstName} ${vendor.lastName}`.trim(),
      age: vendor.dob ? Math.floor((new Date() - new Date(vendor.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null,

      // Verification status summary
      verificationStatus: {
        email: vendor.isEmailVerified,
        mobile: vendor.isMobileVerified,
        kyc: vendor.isKYCVerified,
        overall: vendor.isVerified,
        kycStatus: vendor.kycStatus,
        completeness: [
          vendor.isEmailVerified,
          vendor.isMobileVerified,
          vendor.isKYCVerified,
          !!(vendor.documentImage && vendor.selfieImage),
        ].filter(Boolean).length,
      },

      // Profile completeness analysis
      profileCompleteness: {
        score: (() => {
          let score = 0;
          if (vendor.firstName) score += 10;
          if (vendor.lastName) score += 10;
          if (vendor.email) score += 10;
          if (vendor.phoneNumber) score += 10;
          if (vendor.dob) score += 10;
          if (vendor.avatar) score += 10;
          if (vendor.documentImage) score += 15;
          if (vendor.selfieImage) score += 15;
          if (vendor.serviceCategories && vendor.serviceCategories.length > 0) score += 10;
          return score;
        })(),
        missingFields: [
          !vendor.firstName && 'firstName',
          !vendor.lastName && 'lastName',
          !vendor.email && 'email',
          !vendor.phoneNumber && 'phoneNumber',
          !vendor.dob && 'dateOfBirth',
          !vendor.avatar && 'avatar',
          !vendor.documentImage && 'documentImage',
          !vendor.selfieImage && 'selfieImage',
          (!vendor.serviceCategories || vendor.serviceCategories.length === 0) && 'serviceCategories',
        ].filter(Boolean),
      },

      // Business performance metrics
      performanceMetrics: {
        totalBookings: stats.totalBookings,
        completedBookings: stats.completedBookings,
        cancelledBookings: stats.cancelledBookings,
        completionRate: stats.totalBookings > 0 ? Math.round((stats.completedBookings / stats.totalBookings) * 100) : 0,
        cancellationRate:
          stats.totalBookings > 0 ? Math.round((stats.cancelledBookings / stats.totalBookings) * 100) : 0,
        averageRating: Math.round((stats.avgRating || 0) * 10) / 10,
        totalEarnings: stats.totalEarnings,
        formattedEarnings: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(stats.totalEarnings),
      },

      // Service information
      serviceInformation: {
        categories: vendor.serviceCategories || [],
        childCategories: vendor.serviceChildCategories || [],
        activeServices: vendor.services || [],
        totalServices: serviceStats || 0,
        serviceRadius:
          vendor.services && vendor.services.length > 0 ? Math.max(...vendor.services.map((s) => s.radius || 5)) : 5,
      },

      // Location details
      locationDetails: {
        hasLocation: !!(
          vendor.currentCoordinates &&
          vendor.currentCoordinates.coordinates &&
          vendor.currentCoordinates.coordinates[0] !== 0 &&
          vendor.currentCoordinates.coordinates[1] !== 0
        ),
        coordinates: vendor.currentCoordinates?.coordinates || [0, 0],
        addresses: vendor.addresses || [],
        defaultAddress: vendor.addresses?.find((addr) => addr.isDefault)?.address,
        currentAddress: vendor.addresses?.find((addr) => addr.isCurrent)?.address,
      },

      // Activity tracking
      activitySummary: {
        isOnline: vendor.isOnline,
        lastSeen: vendor.lastSeen,
        daysSinceLastSeen: vendor.lastSeen
          ? Math.floor((new Date() - new Date(vendor.lastSeen)) / (24 * 60 * 60 * 1000))
          : null,
        activeDevices: vendor.fcmTokens ? vendor.fcmTokens.filter((token) => token.isActive).length : 0,
        registrationDate: new Date(vendor.createdAt).toLocaleDateString(),
        daysSinceRegistration: Math.floor((new Date() - new Date(vendor.createdAt)) / (24 * 60 * 60 * 1000)),
      },

      // Referral analytics
      referralAnalytics: {
        totalReferred: vendor.referredUsers ? vendor.referredUsers.length : 0,
        totalReward: vendor.referralReward || 0,
        formattedReward: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(vendor.referralReward || 0),
        hasReferrer: !!vendor.referredBy,
        referralCode: vendor.referralCode,
        referredUsers: vendor.referredUsers || [],
      },

      // KYC and financial details
      kycDetails: {
        status: vendor.kycStatus,
        isVerified: vendor.isKYCVerified,
        isPaymentVerified: vendor.isKYCPaymentVerified,
        amount: vendor.kycAmount || 0,
        formattedAmount: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(vendor.kycAmount || 0),
        hasDocuments: !!(vendor.documentImage && vendor.selfieImage),
        documentType: vendor.documentType,
      },

      // Device information (sanitized)
      deviceInfo: vendor.fcmTokens
        ? vendor.fcmTokens.map((token) => ({
            platform: token.platform,
            deviceName: token.deviceName,
            isActive: token.isActive,
            lastUsed: token.lastUsed,
            createdAt: token.createdAt,
          }))
        : [],

      // Wallet summary
      walletSummary: vendor.wallet
        ? {
            hasWallet: true,
            balance: vendor.wallet.balance,
            currency: vendor.wallet.currency,
            status: vendor.wallet.status,
            formattedBalance: new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: vendor.wallet.currency || 'INR',
            }).format(vendor.wallet.balance || 0),
          }
        : {
            hasWallet: false,
            balance: 0,
            currency: 'INR',
            status: 'inactive',
          },

      // Admin insights (only for admin users)
      ...(isAdmin && {
        adminInsights: {
          riskFactors: {
            hasMultipleDevices: vendor.fcmTokens && vendor.fcmTokens.length > 2,
            highCancellationRate: stats.cancelledBookings / (stats.totalBookings || 1) > 0.2,
            incompleteProfile:
              [
                vendor.isEmailVerified,
                vendor.isMobileVerified,
                vendor.isKYCVerified,
                !!(vendor.documentImage && vendor.selfieImage),
              ].filter(Boolean).length < 3,
            inactiveForLongTime:
              vendor.lastSeen && Math.floor((new Date() - new Date(vendor.lastSeen)) / (24 * 60 * 60 * 1000)) > 30,
          },
          flags: {
            isBlocked: vendor.isBlocked,
            isUnavailable: !vendor.isAvailable,
            needsKycReview: vendor.kycStatus === 'pending',
            hasNoServices: !vendor.serviceCategories || vendor.serviceCategories.length === 0,
          },
        },
      }),
    };

    const response = {
      success: true,
      data: enhancedVendor,
      message: 'Vendor retrieved successfully',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching vendor by ID:', error);

    const errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';

    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

const toggleVendorStatus = async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const { isOnline, fcmToken, deviceId, platform, deviceName } = req.body;

    // Validate input
    if (typeof isOnline !== 'boolean') {
      return next(new ApiError(400, 'isOnline must be a boolean value'));
    }

    // Find vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return next(new ApiError(404, 'Vendor not found'));
    }

    // Update status
    vendor.isOnline = isOnline;
    vendor.lastSeen = new Date();

    // Update FCM token if provided
    if (fcmToken && deviceId && platform) {
      if (!['ios', 'android'].includes(platform.toLowerCase())) {
        return next(new ApiError(400, 'Platform must be either "ios" or "android"'));
      }

      vendor.fcmToken = {
        token: fcmToken,
        deviceId: deviceId,
        platform: platform.toLowerCase(),
        deviceName: deviceName || 'Unknown Device',
        isActive: isOnline,
        createdAt: vendor.fcmToken?.createdAt || new Date(),
        lastUsed: new Date(),
      };
    } else if (vendor.fcmToken) {
      // Update existing FCM token status
      vendor.fcmToken.isActive = isOnline;
      vendor.fcmToken.lastUsed = new Date();
    }

    await vendor.save();

    const responseData = {
      vendorId: vendor._id,
      isOnline: vendor.isOnline,
      lastSeen: vendor.lastSeen,
      fcmToken: vendor.fcmToken
        ? {
            deviceId: vendor.fcmToken.deviceId,
            platform: vendor.fcmToken.platform,
            isActive: vendor.fcmToken.isActive,
          }
        : null,
    };

    res.status(200).json({
      success: true,
      data: responseData,
      message: `Vendor is now ${isOnline ? 'online' : 'offline'}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error toggling vendor status:', error);
    return next(new ApiError(500, 'Failed to update vendor status', error.message));
  }
};

// Helper function to get number of weeks in a month
const getWeeksInMonth = (year, month) => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  return Math.ceil((lastDay + firstDayOfWeek) / 7);
};

const getVendorStats = async (req, res, next) => {
  try {
    const vendorId = req.user._id;
    const { month, year } = req.query;

    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const activeStatuses = ['vendor_assigned', 'accepted', 'confirmed', 'on_route', 'arrived', 'in_progress'];

    const stats = await Booking.aggregate([
      {
        $match: {
          'vendorSearch.assignedVendor.vendorId': vendorId,
        },
      },
      {
        $facet: {
          todayCompleted: [
            {
              $match: {
                date: { $gte: startOfDay, $lte: endOfDay },
                status: 'completed',
                paymentStatus: 'paid',
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalPrice: { $sum: '$pricing.totalAmount' },
                totalBookingCommission: { $sum: '$comission.bookingComissionAmount' },
                totalBillingCommission: { $sum: '$comission.billingComissionAmount' },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
                totalEarnings: {
                  $subtract: ['$totalPrice', { $add: ['$totalBookingCommission', '$totalBillingCommission'] }],
                },
                totalCommission: {
                  $add: ['$totalBookingCommission', '$totalBillingCommission'],
                },
              },
            },
          ],

          // Today's pending bookings
          todayPending: [
            {
              $match: {
                date: { $gte: startOfDay, $lte: endOfDay },
                status: {
                  $nin: [
                    'completed',
                    'cancelled_by_user',
                    'cancelled_by_vendor',
                    'cancelled_by_system',
                    'cancelled_by_admin',
                  ],
                },
              },
            },
            { $count: 'count' },
          ],

          // Today's active bookings
          todayActive: [
            {
              $match: {
                status: {
                  $in: activeStatuses,
                },
                date: { $gte: startOfDay, $lte: endOfDay },
              },
            },
            { $count: 'count' },
          ],

          // Monthly completed bookings with earnings
          monthlyCompleted: [
            {
              $match: {
                date: { $gte: startOfMonth, $lte: endOfMonth },
                status: 'completed',
                paymentStatus: 'paid',
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalPrice: { $sum: '$pricing.totalAmount' },
                totalBookingCommission: { $sum: '$comission.bookingComissionAmount' },
                totalBillingCommission: { $sum: '$comission.billingComissionAmount' },
                totalAddOnsCommission: { $sum: '$comission.addOnsComissionAmount' },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
                totalEarnings: {
                  $subtract: [
                    '$totalPrice',
                    { $add: ['$totalBookingCommission', '$totalBillingCommission', '$totalAddOnsCommission'] },
                  ],
                },
                totalCommission: {
                  $add: ['$totalBookingCommission', '$totalBillingCommission', '$totalAddOnsCommission'],
                },
              },
            },
          ],

          // Monthly pending bookings
          monthlyPending: [
            {
              $match: {
                date: { $gte: startOfMonth, $lte: endOfMonth },
                status: {
                  $nin: [
                    'completed',
                    'cancelled_by_user',
                    'cancelled_by_vendor',
                    'cancelled_by_system',
                    'cancelled_by_admin',
                  ],
                },
              },
            },
            { $count: 'count' },
          ],

          // Monthly cancelled bookings
          monthlyCancelled: [
            {
              $match: {
                date: { $gte: startOfMonth, $lte: endOfMonth }, // FIXED: Changed from createdAt to date
                status: { $regex: /cancelled/i },
              },
            },
            { $count: 'count' },
          ],

          // Monthly active bookings
          monthlyActive: [
            {
              $match: {
                date: { $gte: startOfMonth, $lte: endOfMonth }, // FIXED: Changed from createdAt to date
                status: { $in: activeStatuses },
              },
            },
            { $count: 'count' },
          ],

          // All time completed bookings with earnings
          allTimeCompleted: [
            {
              $match: {
                status: 'completed',
                paymentStatus: 'paid',
              },
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                totalPrice: { $sum: '$pricing.totalAmount' },
                totalBookingCommission: { $sum: '$comission.bookingComissionAmount' },
                totalBillingCommission: { $sum: '$comission.billingComissionAmount' },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
                totalEarnings: {
                  $subtract: ['$totalPrice', { $add: ['$totalBookingCommission', '$totalBillingCommission'] }],
                },
                totalCommission: {
                  $add: ['$totalBookingCommission', '$totalBillingCommission'],
                },
              },
            },
          ],

          // Monthly all bookings (for total count)
          monthlyTotal: [
            {
              $match: {
                date: { $gte: startOfMonth, $lte: endOfMonth },
              },
            },
            { $count: 'count' },
          ],

          // Weekly data for chart - FIXED VERSION
          weeklyData: [
            {
              $match: {
                date: { $gte: startOfMonth, $lte: endOfMonth }, // FIXED: Changed from createdAt to date
                status: 'completed', // FIXED: Only count completed bookings
                paymentStatus: 'paid', // FIXED: Only count paid bookings
              },
            },
            {
              $addFields: {
                weekOfMonth: {
                  $ceil: {
                    $divide: [{ $dayOfMonth: '$date' }, 7], // FIXED: Changed from createdAt to date
                  },
                },
              },
            },
            {
              $group: {
                _id: '$weekOfMonth',
                bookings: { $sum: 1 },
                earnings: {
                  $sum: {
                    $subtract: [
                      '$pricing.totalAmount',
                      {
                        $add: [
                          { $ifNull: ['$comission.bookingComissionAmount', 0] },
                          { $ifNull: ['$comission.billingComissionAmount', 0] },
                        ],
                      },
                    ],
                  },
                },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    // Extract results from aggregation
    const result = stats[0];

    const todayCompletedData = result.todayCompleted[0] || { count: 0, totalEarnings: 0, totalCommission: 0 };
    const todayActiveCount = result.todayActive[0]?.count || 0;

    const monthlyCompletedData = result.monthlyCompleted[0] || { count: 0, totalEarnings: 0, totalCommission: 0 };
    const monthlyCancelledCount = result.monthlyCancelled[0]?.count || 0;
    const monthlyActiveCount = result.monthlyActive[0]?.count || 0;
    const monthlyTotalCount = result.monthlyTotal[0]?.count || 0;

    const allTimeCompletedData = result.allTimeCompleted[0] || { count: 0, totalEarnings: 0, totalCommission: 0 };

    const weeksInMonth = getWeeksInMonth(targetYear, targetMonth - 1);
    const weeklyChartData = [];
    console.log('Weekly Data:', result.weeklyData);

    for (let week = 1; week <= weeksInMonth; week++) {
      const weekData = result.weeklyData.find((w) => w._id === week) || { bookings: 0, earnings: 0 };
      weeklyChartData.push({
        week: `Week ${week}`,
        earnings: Math.round(weekData.earnings),
        bookings: weekData.bookings,
      });
    }

    const completionRate =
      monthlyTotalCount > 0 ? Math.round((monthlyCompletedData.count / monthlyTotalCount) * 100) : 0;

    const bestWeek = weeklyChartData.reduce(
      (best, current) => (current.earnings > best.earnings ? current : best),
      weeklyChartData[0] || { week: 'Week 1', earnings: 0, bookings: 0 }
    );

    const responseData = {
      month: {
        month: targetMonth,
        year: targetYear,
        monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', {
          month: 'long',
        }),
      },
      earnings: {
        todays: Math.round(todayCompletedData.totalEarnings),
        todaysCommission: Math.round(todayCompletedData.totalCommission),
        thisMonth: Math.round(monthlyCompletedData.totalEarnings),
        thisMonthCommission: Math.round(monthlyCompletedData.totalCommission),
        totalAllTime: Math.round(allTimeCompletedData.totalEarnings),
        totalAllTimeCommission: Math.round(allTimeCompletedData.totalCommission),
      },
      bookings: {
        today: {
          completed: todayCompletedData.count,
          active: todayActiveCount,
          total: todayCompletedData.count + todayActiveCount,
        },
        thisMonth: {
          completed: monthlyCompletedData.count,
          cancelled: monthlyCancelledCount,
          active: monthlyActiveCount,
          total: monthlyTotalCount,
          completionRate: completionRate,
        },
        totalAllTimeCompleted: allTimeCompletedData.count,
      },
      weeklyChart: weeklyChartData,
      summary: {
        avgEarningsPerBooking:
          monthlyCompletedData.count > 0
            ? Math.round(monthlyCompletedData.totalEarnings / monthlyCompletedData.count)
            : 0,
        avgBookingsPerWeek: weeksInMonth > 0 ? Math.round(monthlyTotalCount / weeksInMonth) : 0,
        bestWeek: bestWeek,
      },
    };

    res.status(200).json({
      success: true,
      data: responseData,
      message: 'Vendor stats retrieved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching vendor stats:', error);
    return next(new ApiError(500, 'Failed to fetch vendor stats', error.message));
  }
};

// const getVendorStats = async (req, res, next) => {
//   try {
//     const vendorId = req.user._id;
//     const { month, year } = req.query;

//     const currentDate = new Date();
//     const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
//     const targetYear = year ? parseInt(year) : currentDate.getFullYear();

//     const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
//     const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59);

//     const [monthlyBookings, monthlyEarnings, weeklyEarnings, totalStats] = await Promise.all([
//       Booking.find({
//         'vendorSearch.assignedVendor.vendorId': vendorId,
//         createdAt: { $gte: startOfMonth, $lte: endOfMonth },
//       }).lean(),

//       Transaction.find({
//         'user.userId': vendorId,
//         'user.userType': 'Vendor',
//         transactionFor: { $in: ['commission', 'reward', 'cashback'] },
//         status: 'success',
//         createdAt: { $gte: startOfMonth, $lte: endOfMonth },
//       }).lean(),

//       Transaction.aggregate([
//         {
//           $match: {
//             'user.userId': vendorId,
//             'user.userType': 'Vendor',
//             transactionFor: { $in: ['commission', 'reward', 'cashback'] },
//             status: 'success',
//             createdAt: { $gte: startOfMonth, $lte: endOfMonth },
//           },
//         },
//         {
//           $group: {
//             _id: { $week: '$createdAt' },
//             weekEarnings: { $sum: '$amount' },
//             transactionCount: { $sum: 1 },
//             weekStart: { $min: '$createdAt' },
//           },
//         },
//         { $sort: { _id: 1 } },
//       ]),

//       Promise.all([
//         Booking.countDocuments({ 'vendorSearch.assignedVendor.vendorId': vendorId, status: 'completed' }),
//         Transaction.aggregate([
//           {
//             $match: {
//               'user.userId': vendorId,
//               'user.userType': 'Vendor',
//               transactionFor: { $in: ['commission', 'reward', 'cashback'] },
//               status: 'success',
//             },
//           },
//           {
//             $group: {
//               _id: null,
//               totalEarnings: { $sum: '$amount' },
//               totalTransactions: { $sum: 1 },
//             },
//           },
//         ]),
//       ]),
//     ]);

//     const completedBookings = monthlyBookings.filter((b) => b.status === 'completed').length;
//     const cancelledBookings = monthlyBookings.filter((b) => b.status.includes('cancelled')).length;
//     const totalBookings = monthlyBookings.length;

//     const monthlyEarningsTotal = monthlyEarnings.reduce((sum, t) => sum + t.amount, 0);

//     const weeklyChartData = [];
//     const weeksInMonth = getWeeksInMonth(targetYear, targetMonth - 1);

//     for (let week = 1; week <= weeksInMonth; week++) {
//       const weekData = weeklyEarnings.find((w) => w._id === getWeekNumber(targetYear, targetMonth - 1, week));

//       weeklyChartData.push({
//         week: `Week ${week}`,
//         earnings: weekData ? weekData.weekEarnings : 0,
//         bookings: monthlyBookings.filter((b) => {
//           const bookingWeek = getWeekOfMonth(b.createdAt);
//           return bookingWeek === week;
//         }).length,
//       });
//     }

//     const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

//     const responseData = {
//       month: {
//         month: targetMonth,
//         year: targetYear,
//         monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' }),
//       },
//       earnings: {
//         thisMonth: monthlyEarningsTotal,
//         formattedThisMonth: new Intl.NumberFormat('en-IN', {
//           style: 'currency',
//           currency: 'INR',
//         }).format(monthlyEarningsTotal),
//         totalAllTime: totalStats[1][0]?.totalEarnings || 0,
//         formattedTotalAllTime: new Intl.NumberFormat('en-IN', {
//           style: 'currency',
//           currency: 'INR',
//         }).format(totalStats[1][0]?.totalEarnings || 0),
//       },
//       bookings: {
//         thisMonth: totalBookings,
//         completed: completedBookings,
//         cancelled: cancelledBookings,
//         completionRate: completionRate,
//         totalAllTime: totalStats[0],
//       },
//       weeklyChart: weeklyChartData,
//       summary: {
//         avgEarningsPerBooking: completedBookings > 0 ? Math.round(monthlyEarningsTotal / completedBookings) : 0,
//         avgBookingsPerWeek: Math.round(totalBookings / weeksInMonth),
//         bestWeek: weeklyChartData.reduce(
//           (best, current) => (current.earnings > best.earnings ? current : best),
//           weeklyChartData[0]
//         ),
//       },
//     };

//     res.status(200).json({
//       success: true,
//       data: responseData,
//       message: 'Vendor stats retrieved successfully',
//       timestamp: new Date().toISOString(),
//     });
//   } catch (error) {
//     console.error('Error fetching vendor stats:', error);
//     return next(new ApiError(500, 'Failed to fetch vendor stats', error.message));
//   }
// };

const vendorManagement = async (req, res, next) => {
  try {
    const { error, value } = vendorManagementSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(new ApiError(400, 'Validation Error', error.details.map((d) => d.message).join(', ')));
    }

    const vendor = await Vendor.findById(value.vendorId);
    if (!vendor) {
      return next(new ApiError(404, 'Vendor not found'));
    }

    Object.keys(value).forEach((key) => {
      if (key !== 'vendorId' && value[key] !== undefined) {
        vendor[key] = value[key];
      }
    });

    await vendor.save();
    res.status(200).json({
      success: true,
      data: value,
      message: 'Vendor management operation successful',
    });
  } catch (error) {
    console.error('Error in vendor management operation:', error);
    return next(new ApiError(500, 'Vendor management operation failed', error.message));
  }
};

export { getAllVendors, getVendorById, toggleVendorStatus, getVendorStats, vendorManagement };
