import mongoose from 'mongoose';
import { Booking, Rating } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { bookingPopulate, bookingSelect } from '../../config/populate/bookingPopulate.js';
import { formatAddress, formatBooking } from './utils/formatBooking.js';
import { activeStatuses } from './utils/constants.js';

export const getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      paymentStatus,
      userId,
      vendorId,
      serviceId,
      categoryId,
      dateFrom,
      dateTo,
      search,
      minAmount,
      maxAmount,
      city,
      state,
      country,
      platform,
      hasRating,
      timeSlot,
      cancelledBy,
      priceRange,
    } = req.query;

    const filter = {};

    // Status Filter
    if (status && status.toLowerCase() !== 'all') {
      filter.status = status.includes(',') ? { $in: status.split(',').map((s) => s.trim()) } : status;
    }

    // Payment Status
    if (paymentStatus && paymentStatus.toLowerCase() !== 'all') {
      filter.paymentStatus = paymentStatus;
    }

    // User ID
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.user = new mongoose.Types.ObjectId(userId);
    }

    // Vendor ID - Only check assigned vendor
    if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
      filter['vendorSearch.assignedVendor.vendorId'] = new mongoose.Types.ObjectId(vendorId);
    }

    // Service ID
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      filter.serviceTemplate = new mongoose.Types.ObjectId(serviceId);
    }

    // Category ID
    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      filter.category = new mongoose.Types.ObjectId(categoryId);
    }

    // Date Range
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    // Price Range
    if (minAmount || maxAmount) {
      filter['pricing.totalAmount'] = {};
      if (minAmount) filter['pricing.totalAmount'].$gte = parseFloat(minAmount);
      if (maxAmount) filter['pricing.totalAmount'].$lte = parseFloat(maxAmount);
    }

    // Predefined Price Tiers
    if (priceRange && priceRange.toLowerCase() !== 'all') {
      const ranges = {
        low: { $lt: 500 },
        medium: { $gte: 500, $lt: 2000 },
        high: { $gte: 2000, $lt: 5000 },
        premium: { $gte: 5000 },
      };
      if (ranges[priceRange]) {
        filter['pricing.totalAmount'] = ranges[priceRange];
      }
    }

    // Location Filters
    if (city) filter['address.city'] = { $regex: city, $options: 'i' };
    if (state) filter['address.state'] = { $regex: state, $options: 'i' };
    if (country) filter['address.country'] = { $regex: country, $options: 'i' };

    // Platform Filter
    if (platform && platform.toLowerCase() !== 'all') {
      filter['metadata.platform'] = platform;
    }

    // Time Slot Filter
    if (timeSlot) filter.timeSlot = { $regex: timeSlot, $options: 'i' };

    // Rating Filter
    if (hasRating === 'true') {
      filter['rating.userRating.rating'] = { $exists: true };
    } else if (hasRating === 'false') {
      filter['rating.userRating.rating'] = { $exists: false };
    }

    // Cancelled By Filter
    if (cancelledBy && cancelledBy.toLowerCase() !== 'all') {
      filter['cancellation.cancelledByModel'] = cancelledBy;
    }

    // Search (Coupon, Notes, etc.)
    if (search) {
      filter.$or = [
        { 'appliedCoupon.couponCode': { $regex: search, $options: 'i' } },
        { specialRequirements: { $regex: search, $options: 'i' } },
        { userNotes: { $regex: search, $options: 'i' } },
        { vendorNotes: { $regex: search, $options: 'i' } },
      ];
    }

    const sortObject = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const totalBookings = await Booking.countDocuments(filter);

    const bookings = await Booking.find(filter)
      .populate(bookingPopulate)
      .select(bookingSelect)
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const formattedBookings = bookings.map((booking) => {
      // Duration Calculation
      let durationMinutes = null;
      if (booking.timing?.actualStartTime && booking.timing?.actualEndTime) {
        durationMinutes =
          (new Date(booking.timing.actualEndTime) - new Date(booking.timing.actualStartTime)) / (1000 * 60);
      } else {
        durationMinutes = booking.timing?.totalDuration || null;
      }
      const formattedDuration = durationMinutes
        ? `${Math.floor(durationMinutes / 60)}h ${Math.round(durationMinutes % 60)}m`
        : null;

      // Total & Additional Charges
      const totalAmount = booking.pricing?.totalAmount || booking.totalPrice || 0;
      const baseAmount = booking.pricing?.basePrice || booking.price || 0;
      const additionalCharges = totalAmount - baseAmount;

      // Address
      const fullAddress = booking.address
        ? [
            booking.address.completeAddress,
            booking.address.city,
            booking.address.state,
            booking.address.pinCode,
            booking.address.country,
          ]
            .filter(Boolean)
            .join(', ')
        : 'No address provided';

      let vendorDetails = null;

      if (booking.vendorSearch?.assignedVendor?.vendorId) {
        const assignedVendor = booking.vendorSearch.assignedVendor.vendorId;
        vendorDetails = {
          id: assignedVendor._id,
          name: `${assignedVendor.firstName || ''} ${assignedVendor.lastName || ''}`.trim(),
          email: assignedVendor.email || null,
          phone: assignedVendor.phoneNumber || null,
          selfieImage: assignedVendor.selfieImage,
          rating: assignedVendor.rating || null,
          isAssigned: true,
          assignedAt: booking.vendorSearch.assignedVendor.assignedAt || null,
          acceptedAt: booking.vendorSearch.assignedVendor.acceptedAt || null,
          distance: booking.vendorSearch.assignedVendor.distance.toFixed(2) || null,
        };
      }

      return {
        id: booking._id,
        ...booking,
        service: {
          id: booking.serviceTemplate?._id,
          title: booking.serviceTemplate?.title || 'N/A',
          category: booking.category?.name || 'N/A',
          subCategory: booking.subCategory?.name || null,
        },
        customer: booking.user
          ? {
              id: booking.user._id,
              name: `${booking.user.firstName} ${booking.user.lastName}`.trim(),
              email: booking.user.email,
              phone: booking.user.phoneNumber,
              avatar: booking.user.avatar,
            }
          : null,

        vendor: vendorDetails,

        pricing: booking.pricing,

        timing: {
          scheduledDate: booking.date,
          slot: booking.timeSlot || null,
          actualStartTime: booking.timing?.actualStartTime || null,
          actualEndTime: booking.timing?.actualEndTime || null,
          duration: formattedDuration,
        },

        location: {
          address: fullAddress,
        },

        status: {
          current: booking.status,
          paymentStatus: booking.paymentStatus,
          priority: calculatePriority(booking.status),
          isCompleted: booking.status === 'completed',
          isCancelled: booking.status.includes('cancelled'),
          isPaid: booking.paymentStatus === 'paid',
          hasRating: !!booking.rating?.userRating?.rating,
        },

        bookingId: booking?.bookingId,

        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      };
    });

    const totalPages = Math.ceil(totalBookings / limitNum);

    res.status(200).json({
      success: true,
      message: `Retrieved ${formattedBookings.length} booking(s) successfully`,
      data: {
        bookings: formattedBookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          total: totalBookings,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message,
    });
  }
};

function calculatePriority(status) {
  const priorities = {
    pending: 1,
    searching: 2,
    vendor_assigned: 3,
    accepted: 4,
    confirmed: 5,
    on_route: 6,
    arrived: 7,
    in_progress: 8,
    completed: 9,
    cancelled_by_user: 10,
    cancelled_by_vendor: 10,
    cancelled_by_system: 10,
    rejected: 10,
    failed: 10,
    expired: 10,
  };
  return priorities[status] || 0;
}

export const getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    const targetUserId = userId || requestingUser._id;

    const isAdmin = requestingUser.role === 'admin';
    const isOwner = requestingUser._id.toString() === targetUserId.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own bookings.',
      });
    }

    const { page = 1, limit = 100, dateFrom, dateTo, sortBy = 'createdAt' } = req.query;

    const filter = { user: new mongoose.Types.ObjectId(targetUserId) };

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    const totalBookings = await Booking.countDocuments(filter);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const bookings = await Booking.find(filter)
      .populate(bookingPopulate)
      .select(bookingSelect)
      .skip(skip)
      .limit(limitNum)
      .sort(sortBy)
      .lean()
      .exec();

    const totalPages = Math.ceil(totalBookings / limitNum);

    const cleanBookingsResponse = (bookings || []).map((booking) =>
      typeof formatBooking === 'function' ? formatBooking(booking) : booking
    );

    res.status(200).json({
      success: true,
      data: {
        bookings: cleanBookingsResponse,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBookings,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      message: `Retrieved ${cleanBookingsResponse.length} user booking(s) successfully`,
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

export const getVendorBookings = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const requestingUser = req.user;

    const targetVendorId = vendorId || requestingUser._id;

    // Authorization check
    const isAdmin = requestingUser.role === 'admin';
    const isVendor =
      requestingUser.roles?.includes('vendor') && requestingUser._id.toString() === targetVendorId.toString();

    if (!isAdmin && !isVendor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Vendors can only view their own bookings.',
      });
    }

    const { page = 1, limit = 10, status, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'asc' } = req.query;

    // Build filter
    const filter = {
      'vendorSearch.assignedVendor.vendorId': new mongoose.Types.ObjectId(targetVendorId),
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }

    const totalBookings = await Booking.countDocuments(filter);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const bookings = await Booking.find(filter)
      .populate(bookingPopulate)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    const totalPages = Math.ceil(totalBookings / limitNum);

    const cleanBookingsResponse = (bookings || []).map((booking) =>
      typeof formatBooking === 'function' ? formatBooking(booking) : booking
    );

    res.status(200).json({
      success: true,
      data: {
        bookings: cleanBookingsResponse,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBookings,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      message: `Retrieved ${cleanBookingsResponse.length} vendor booking(s) successfully`,
    });
  } catch (error) {
    console.error('Error fetching vendor bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format',
      });
    }

    // Find booking with all populated data
    let booking = await Booking.findById(id).populate(bookingPopulate).select(bookingSelect).lean().exec();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    if (booking?.vendorSearch?.assignedVendor?.vendorId) {
      booking.vendor = booking.vendorSearch.assignedVendor.vendorId;
    }

    delete booking.vendorSearch;

    if (booking.address) {
      booking.address = formatAddress(booking.address);
    }

    const rating = await Rating.findOne({
      itemId: booking.vendor._id,
      itemType: 'Vendor',
      sourceId: booking._id,
      sourceType: 'Booking',
    });

    res.status(200).json({
      success: true,
      data: {
        ...booking,
        rating,
      },
      message: 'Booking retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching booking by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

export const getBookingStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return next(new ApiError(400, 'Valid booking ID is required'));
    }

    const booking = await Booking.findById(bookingId).populate(bookingPopulate).select(bookingSelect).lean().exec();
    if (!booking) {
      return next(new ApiError(404, 'Booking not found'));
    }

    const now = new Date();
    const bookingDate = new Date(booking.date);
    const isExpired = booking.timing?.searchTimeout ? now > new Date(booking.timing.searchTimeout) : false;
    const timeUntilBooking = bookingDate > now ? Math.ceil((bookingDate - now) / (1000 * 60 * 60)) : 0; // hours

    // Determine booking progress and next expected action
    const getBookingProgress = (status) => {
      const progressMap = {
        pending: { step: 1, total: 8, percentage: 12.5 },
        searching: { step: 2, total: 8, percentage: 25 },
        vendor_assigned: { step: 3, total: 8, percentage: 37.5 },
        accepted: { step: 4, total: 8, percentage: 50 },
        confirmed: { step: 5, total: 8, percentage: 62.5 },
        on_route: { step: 6, total: 8, percentage: 75 },
        arrived: { step: 7, total: 8, percentage: 87.5 },
        in_progress: { step: 7, total: 8, percentage: 87.5 },
        completed: { step: 8, total: 8, percentage: 100 },
      };
      return progressMap[status] || { step: 1, total: 8, percentage: 12.5 };
    };

    const getNextExpectedAction = (status) => {
      const actionMap = {
        pending: 'Searching for available vendors',
        searching: 'Waiting for vendor acceptance',
        vendor_assigned: 'Waiting for vendor to accept booking',
        accepted: 'Booking confirmation in progress',
        confirmed: 'Vendor will be on route soon',
        on_route: 'Vendor is coming to your location',
        arrived: 'Vendor has arrived, service will start',
        in_progress: 'Service is being performed',
        completed: 'Service completed successfully',
        cancelled_by_user: 'Booking cancelled by user',
        cancelled_by_vendor: 'Booking cancelled by vendor',
        cancelled_by_system: 'Booking cancelled by system',
        rejected: 'Booking was rejected',
        failed: 'Service failed',
        expired: 'Booking expired - no vendor found',
      };
      return actionMap[status] || 'Status update pending';
    };

    // Create status flags for frontend logic
    const statusFlags = {
      isPending: booking.status === 'pending',
      isSearching: booking.status === 'searching',
      hasVendorAssigned: booking.status === 'vendor_assigned',
      isAccepted: booking.status === 'accepted',
      isConfirmed: booking.status === 'confirmed',
      isOnRoute: booking.status === 'on_route',
      hasArrived: booking.status === 'arrived',
      isInProgress: booking.status === 'in_progress',
      isCompleted: booking.status === 'completed',
      isCancelled: booking.status.includes('cancelled'),
      isRejected: booking.status === 'rejected',
      isFailed: booking.status === 'failed',
      isExpired: booking.status === 'expired' || isExpired,
      canCancel: ['pending', 'searching', 'vendor_assigned', 'accepted', 'confirmed'].includes(booking.status),
      canRate: booking.status === 'completed' && !booking.rating?.userRating?.rating,
      needsPayment: booking.paymentStatus === 'pending' || booking.paymentStatus === 'unpaid',
    };

    // Vendor information
    const vendorInfo = booking.vendorSearch?.assignedVendor?.vendorId || booking.vendor;
    const assignedVendor = vendorInfo
      ? {
          _id: vendorInfo._id,
          name: vendorInfo.firstName
            ? `${vendorInfo.firstName} ${vendorInfo.lastName || ''}`.trim()
            : vendorInfo.businessName,
          businessName: vendorInfo.businessName,
          phoneNumber: vendorInfo.phoneNumber,
          assignedAt: booking.vendorSearch?.assignedVendor?.assignedAt,
          acceptedAt: booking.vendorSearch?.assignedVendor?.acceptedAt,
          distance: booking.vendorSearch?.assignedVendor?.distance,
        }
      : null;

    // Search progress information
    const searchProgress = {
      eligibleVendorsCount: booking.vendorSearch?.eligibleVendors?.length || 0,
      pendingResponses: booking.vendorSearch?.eligibleVendors?.filter((v) => v.response === 'pending').length || 0,
      searchAttempts: booking.vendorSearch?.searchAttempts || 0,
      searchRadius: booking.vendorSearch?.searchRadius,
      maxRadius: booking.vendorSearch?.maxRadius,
      lastSearchAt: booking.vendorSearch?.lastSearchAt,
      searchTimeoutAt: booking.timing?.searchTimeout,
    };

    // Recent status updates (last 5)
    const recentStatusHistory =
      booking.statusHistory
        ?.slice(-5)
        .reverse()
        .map((history) => ({
          status: history.status,
          timestamp: history.timestamp,
          timeAgo: Math.floor((now - new Date(history.timestamp)) / (1000 * 60)), // minutes ago
          changedBy: history.changedByModel,
          reason: history.reason,
        })) || [];

    const progress = getBookingProgress(booking.status);

    // Construct the response
    const bookingStatus = {
      _id: booking._id,

      // Basic booking info
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      date: booking.date,
      timeSlot: booking.timeSlot,
      bookingId: booking.bookingId,

      // Progress tracking
      progress: {
        ...progress,
        nextAction: getNextExpectedAction(booking.status),
      },

      // Status flags for frontend logic
      statusFlags,

      // Pricing information
      pricing: booking.pricing || {},

      service: {
        _id: booking.serviceTemplate._id,
        name: booking.serviceTemplate.title,
        category: booking.category?.name,
        subCategory: booking.subCategory?.name,
      },

      // Vendor information
      assignedVendor,

      // Search progress (useful for polling)
      searchProgress,

      // Timing information
      timing: {
        bookingDate: booking.date,
        timeSlot: booking.timeSlot,
        timeUntilBooking: timeUntilBooking > 0 ? `${timeUntilBooking} hours` : 'Today',
        estimatedStartTime: booking.timing?.estimatedStartTime,
        estimatedEndTime: booking.timing?.estimatedEndTime,
        actualStartTime: booking.timing?.actualStartTime,
        actualEndTime: booking.timing?.actualEndTime,
        isExpired,
        searchTimeoutAt: booking.timing?.searchTimeout,
      },

      // Address
      address: booking.address,

      // Recent status changes
      recentStatusHistory,

      // Last updated
      lastUpdated: booking.updatedAt,
      createdAt: booking.createdAt,

      // Additional info that might be useful for polling
      specialRequirements: booking.specialRequirements,
      userNotes: booking.userNotes,

      // For completed bookings
      rating: booking.status === 'completed' ? booking.rating : null,

      // For cancelled bookings
      cancellation: booking.status.includes('cancelled') ? booking.cancellation : null,
      otpDeatils: booking.otpDeatils,
      addons: booking.addOns,
      isVendorRated: booking.isVendorRated || false,
      isServiceTemplateRated: booking.isServiceTemplateRated || false,
    };

    res.status(200).json({
      success: true,
      data: bookingStatus,
      message: 'Booking status retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching booking status:', error);
    return next(new ApiError(500, 'Failed to fetch booking status', error.message));
  }
};

export const getLiveBookings = async (req, res) => {
  try {
    const activeStatuses = ['accepted', 'confirmed', 'on_route', 'arrived', 'in_progress', 'vendor_assigned'];

    const bookings = await Booking.find({
      status: { $in: activeStatuses },
      'vendorSearch.assignedVendor': { $exists: true },
      'vendorSearch.assignedVendor.vendorId': { $ne: null },
    })
      .populate(bookingPopulate)
      .select(bookingSelect)
      .sort({ createdAt: -1 })
      .lean();
    // Transform data into required format
    const liveBookingsData = bookings.map((booking, index) => {
      // Calculate estimated duration
      let estimatedDuration = null;
      if (booking.timing?.estimatedStartTime && booking.timing?.estimatedEndTime) {
        const diffMinutes =
          (new Date(booking.timing.estimatedEndTime) - new Date(booking.timing.estimatedStartTime)) / (1000 * 60);
        const hours = Math.floor(diffMinutes / 60);
        const minutes = Math.round(diffMinutes % 60);
        estimatedDuration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      }
      const vendor = booking.vendorSearch?.assignedVendor?.vendorId || booking.vendor;

      return {
        key: booking?._id,
        bookingId: booking?._id,
        serviceType: booking.serviceTemplate?.title || 'N/A',
        customerName: `${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`.trim(),
        customerLocation: booking.address ? `${booking.address.completeAddress || ''}`.trim() : 'No address provided',
        vendorName: vendor
          ? vendor.firstName
            ? `${vendor.firstName} ${vendor.lastName || ''}`.trim()
            : vendor.businessName
          : 'Unassigned',
        vendorContact: vendor?.phoneNumber || 'N/A',
        vendorRating: booking?.vendor?.rating || null,
        scheduledTime: booking.date,
        amount: booking.totalPrice,
        status: booking.status,
        priority: calculatePriority(booking.status),
        estimatedDuration: estimatedDuration || 'N/A',
        slot: booking?.timeSlot,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Live bookings retrieved successfully',
      data: liveBookingsData,
      total: liveBookingsData.length,
    });
  } catch (error) {
    console.error('Error fetching live bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live bookings',
      error: error.message,
    });
  }
};

export const getVendorAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const vendorId = req.user._id;

    if (!vendorId || !mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid vendorId is required',
      });
    }

    const filter = {
      'vendorSearch.assignedVendor.vendorId': new mongoose.Types.ObjectId(vendorId),
      status: { $in: ['completed', 'cancelled'] },
    };

    const sortObject = { [sortBy]: sortOrder === 'asce' ? -1 : 1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const totalBookings = await Booking.countDocuments(filter);

    const bookings = await Booking.find(filter)
      .populate(bookingPopulate)
      .select(bookingSelect)
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const cleanBookingsResponse = (bookings || []).map((booking) =>
      typeof formatBooking === 'function' ? formatBooking(booking) : booking
    );

    const totalPages = Math.ceil(totalBookings / limitNum);

    res.status(200).json({
      success: true,
      message: `Retrieved ${cleanBookingsResponse.length} booking(s) successfully for vendor`,
      data: {
        bookings: cleanBookingsResponse,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBookings,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching vendor bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor bookings',
      error: error.message,
    });
  }
};

export const cancelBookingByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refundAmount = 0 } = req.body;
    const adminId = req.user?._id;

    // Step 1: Find booking
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const nonCancellableStatuses = [
      'cancelled_by_user',
      'cancelled_by_vendor',
      'cancelled_by_system',
      'cancelled_by_admin',
      'completed',
    ];

    if (nonCancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Booking cannot be cancelled. Current status: ${booking.status}`,
      });
    }

    // Step 3: Update cancellation details
    booking.cancellation = {
      cancelledBy: adminId,
      cancelledByModel: 'Admin',
      cancelledAt: new Date(),
      reason: reason || 'Cancelled by Admin',
      refundAmount,
      refundStatus: refundAmount > 0 ? 'pending' : 'not_applicable',
    };

    booking.addStatusHistory('cancelled_by_admin', adminId, 'Admin', reason);

    // Step 5: Save booking
    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully by admin.',
      data: {
        id: booking._id,
        status: booking.status,
        cancellation: booking.cancellation,
      },
    });
  } catch (error) {
    console.error('❌ Error cancelling booking by admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling booking.',
      error: error.message,
    });
  }
};
