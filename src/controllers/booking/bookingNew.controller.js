import mongoose from 'mongoose';
import { User, Booking, AddOn, ServiceTemplate } from '../../models/index.js';
import { STATUS } from '../../constants/constants.js';

import { NotificationService } from '../../services/notifications/NotificationService.js';
import { bookingPopulate, bookingSelect } from '../../config/populate/bookingPopulate.js';
import { getNotificationMessage, getNotificationType, formatBooking } from './utils/formatBooking.js';
import { BookingService, TransactionService } from '../../services/booking/index.js';
import { activeStatuses, paymentStatus, upcomingPaymentStatus } from './utils/constants.js';
import { createBookingService } from '../../services/booking/booking.create.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { userNotificationService } from '../../services/notifications/user.notification.service.js';
import { loaderService } from '../../services/common/loader.query.service.js';
import { bookingPriceService } from '../../services/booking/booking.price.service.js';
import logger from '../../utils/logger.js';

export const createBooking = asyncHandler(async (req, res) => {
  try {
    const requestData = {
      ...req.body,
      userId: req.user._id.toString(),
    };
    const result = await createBookingService.createBooking(requestData);
    return res.status(STATUS.OK).json(result);
  } catch (error) {
    throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
  }
});

export const acceptBookingRequest = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const vendorId = req.user._id;
    const bookingId = req.params.bookingId;

    const result = await BookingService.acceptBooking({
      vendorId,
      bookingId,
      req,
      session,
    });

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Error in accept booking', error);
    throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
  } finally {
    await session.endSession();
  }
});

export const getEligibleVendors = asyncHandler(async (req, res) => {
  const requestData = {
    ...req.body,
    userId: req.user._id.toString(),
  };
  try {
    const eligibleVendor = await createBookingService.getEligibleVendors(requestData);
    res.status(STATUS.OK).json(eligibleVendor);
  } catch (error) {
    throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
  }
});

export const getVendorBookingTransactionsHistory = asyncHandler(async (req, res) => {
  try {
    const vendorId = req.user._id;

    const result = await TransactionService.getVendorBookingTransactions({ vendorId });

    res.status(200).json({
      success: true,
      message: 'Vendor booking history fetched successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Error in get vendor booking history', error);
    throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
  }
});

export const getVendorActiveBookings = async (req, res) => {
  try {
    const vendorId = req.user?._id;
    const { page = 1, limit = 100 } = req.query;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required',
      });
    }

    const objectVendorId = new mongoose.Types.ObjectId(vendorId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const filter = {
      status: { $in: activeStatuses },
      'vendorSearch.assignedVendor.vendorId': objectVendorId,
      date: { $gte: today, $lt: tomorrow },
      paymentStatus: { $in: paymentStatus },
    };

    const bookings = await Booking.find(filter)
      .populate(bookingPopulate)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const sortedBookings = bookings.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA !== dateB) return dateA - dateB;

      const getStartMinutes = (slot) => {
        const [start] = slot.split(' - ');
        const [time, meridian] = start.split(' ');
        let [hour, minute] = time.split(':').map(Number);
        if (meridian === 'PM' && hour !== 12) hour += 12;
        if (meridian === 'AM' && hour === 12) hour = 0;
        return hour * 60 + minute;
      };

      return getStartMinutes(a.timeSlot) - getStartMinutes(b.timeSlot);
    });

    const total = await Booking.countDocuments(filter);

    const cleanBookingsResponse = (bookings = []) => bookings.map(formatBooking);

    return res.status(200).json({
      success: true,
      message: 'Active bookings fetched successfully',
      data: cleanBookingsResponse(sortedBookings),
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor active bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching active bookings',
      error: error.message,
    });
  }
};

export const getVendorAllBookings = async (req, res) => {
  try {
    const vendorId = req.user?._id;
    const { page = 1, limit = 100 } = req.query;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required',
      });
    }

    const objectVendorId = new mongoose.Types.ObjectId(vendorId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = {
      status: { $in: activeStatuses },
      'vendorSearch.assignedVendor.vendorId': objectVendorId,
      date: { $gt: today },
      paymentStatus: { $in: upcomingPaymentStatus },
    };

    const bookings = await Booking.find(filter)
      .populate(bookingPopulate)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const sortedBookings = bookings.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA !== dateB) return dateA - dateB;

      const getStartMinutes = (slot) => {
        const [start] = slot.split(' - ');
        const [time, meridian] = start.split(' ');
        let [hour, minute] = time.split(':').map(Number);
        if (meridian === 'PM' && hour !== 12) hour += 12;
        if (meridian === 'AM' && hour === 12) hour = 0;
        return hour * 60 + minute;
      };

      return getStartMinutes(a.timeSlot) - getStartMinutes(b.timeSlot);
    });

    const total = await Booking.countDocuments(filter);

    const cleanBookingsResponse = (bookings = []) => bookings.map(formatBooking);

    return res.status(200).json({
      success: true,
      message: 'Active bookings fetched successfully',
      data: cleanBookingsResponse(sortedBookings),
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor active bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching active bookings',
      error: error.message,
    });
  }
};

export const getVendorBookingHistory = async (req, res) => {
  try {
    const vendorId = req.user?._id;
    const { page = 1, limit = 100 } = req.query;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: 'Vendor ID is required',
      });
    }

    const objectVendorId = new mongoose.Types.ObjectId(vendorId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = {
      'vendorSearch.assignedVendor.vendorId': objectVendorId,
    };

    const bookings = await Booking.find(filter)
      .populate(bookingPopulate)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const sortedBookings = bookings.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (dateA !== dateB) return dateA - dateB;

      const getStartMinutes = (slot) => {
        const [start] = slot.split(' - ');
        const [time, meridian] = start.split(' ');
        let [hour, minute] = time.split(':').map(Number);
        if (meridian === 'PM' && hour !== 12) hour += 12;
        if (meridian === 'AM' && hour === 12) hour = 0;
        return hour * 60 + minute;
      };

      return getStartMinutes(a.timeSlot) - getStartMinutes(b.timeSlot);
    });

    const total = await Booking.countDocuments(filter);

    const cleanBookingsResponse = (bookings = []) => bookings.map(formatBooking);

    return res.status(200).json({
      success: true,
      message: 'Active bookings fetched successfully',
      data: cleanBookingsResponse(sortedBookings),
      pagination: {
        total,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching vendor active bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching active bookings',
      error: error.message,
    });
  }
};

export const getUserActiveBookings = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 100 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const bookings = await Booking.find({
      user: userId,
      date: { $gte: today },
      status: { $in: activeStatuses },
      paymentStatus: { $in: ['pending'] },
    })
      .populate(bookingPopulate)
      .sort({ date: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Booking.countDocuments({
      user: userId,
      date: { $gte: today },
      status: { $in: activeStatuses },
      paymentStatus: { $in: paymentStatus },
    });

    const sortedBookings = bookings.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      const getStartMinutes = (slot) => {
        const [start] = slot.split(' - ');
        const [time, meridian] = start.split(' ');
        let [hour, minute] = time.split(':').map(Number);
        if (meridian === 'PM' && hour !== 12) hour += 12;
        if (meridian === 'AM' && hour === 12) hour = 0;
        return hour * 60 + minute;
      };

      return getStartMinutes(a.timeSlot) - getStartMinutes(b.timeSlot);
    });

    const cleanBookingsResponse = (sortedBookings || []).map((booking) =>
      typeof formatBooking === 'function' ? formatBooking(booking) : booking
    );

    return res.status(200).json({
      success: true,
      message: 'Active bookings fetched successfully',
      data: cleanBookingsResponse,
      pagination: {
        total,
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching user active bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching active bookings',
      error: error.message,
    });
  }
};

export const addAddOnToBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let isCommitted = false;

  try {
    const { addOns, bookingId } = req.body;
    const vendorId = req.user._id;

    if (!Array.isArray(addOns) || addOns.length === 0) {
      throw new Error('Add-ons array is required and must not be empty');
    }

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new Error('Booking not found');

    if (booking.vendorSearch.assignedVendor.vendorId.toString() !== vendorId.toString()) {
      throw new Error('You are not authorized to modify add-ons for this booking');
    }

    const allowedStatuses = ['arrived', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      throw new Error(`Add-ons only allowed when status is arrived/in_progress. Current: ${booking.status}`);
    }

    booking.addOns = [];

    let notificationMessages = [];
    let addedCount = 0;

    for (const item of addOns) {
      const { addOnId, quantity = 1, notes } = item;
      if (!addOnId || quantity < 1) continue;

      const addOn = await AddOn.findById(addOnId).session(session);
      if (!addOn || !addOn.isActive || addOn.isDeleted) continue;

      const isApplicable = addOn.serviceTemplates.some((st) => st.toString() === booking.serviceTemplate.toString());
      if (!isApplicable) continue;

      const unitPrice = addOn.pricing.price;
      const totalPrice = unitPrice * quantity;

      booking.addOns.push({
        addOn: addOnId,
        name: addOn.name,
        quantity,
        unitPrice,
        totalPrice,
        addedBy: vendorId,
        isApprovedByUser: false,
        notes: notes || '',
      });

      notificationMessages.push(
        `Vendor added "${addOn.name}" (₹${totalPrice}) to your booking. Please approve or decline.`
      );

      addedCount++;
    }

    if (addedCount === 0) {
      throw new Error('No valid add-ons to process');
    }

    const currentAddOnsTotal = booking.addOns.reduce((sum, item) => sum + item.totalPrice, 0);
    booking.pricing.addOnsTotal = currentAddOnsTotal;

    const pricing = await bookingPriceService.calculateBookingPricingWithAddons({
      pricing: booking.pricing,
      addonsTotalAmount: currentAddOnsTotal,
    });

    booking.pricing = pricing;

    notificationMessages.forEach((message) => {
      booking.notifications.userNotifications.push({
        type: 'addon_added',
        sentAt: new Date(),
        status: 'sent',
        message,
      });
    });

    await booking.save({ session });

    await session.commitTransaction();
    isCommitted = true;

    const formatedBooking = await Booking.findById(bookingId).populate(bookingPopulate).select(bookingSelect);

    const user = await User.findById(booking.user).select('fcmToken');

    if (user?.fcmToken?.token) {
      await userNotificationService.sendAddonAddNotification(addedCount, user, bookingId);
    }

    return res.status(200).json({
      success: true,
      message: `${addedCount} add-on(s) replaced successfully.`,
      data: formatedBooking,
    });
  } catch (error) {
    if (!isCommitted) {
      try {
        await session.abortTransaction();
      } catch (e) {}
    }

    console.error('Error replacing add-ons:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to replace add-ons',
    });
  } finally {
    session.endSession();
  }
};

export const removeAddOnFromBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { addOnIds, bookingId } = req.body;
    const vendorId = req.user._id;

    if (!Array.isArray(addOnIds) || addOnIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Add-on IDs array is required and must not be empty',
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Verify vendor is assigned to this booking
    if (booking.vendorSearch.assignedVendor.vendorId._id.toString() !== vendorId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to remove add-ons from this booking',
      });
    }

    const allowedStatuses = ['arrived', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Add-ons can only be removed when booking status is 'arrived' or 'in_progress'. Current status: ${booking.status}`,
      });
    }

    let removedCount = 0;
    let notificationMessages = [];

    // Process each add-on ID in the array
    for (const addOnId of addOnIds) {
      // Find the add-on in the booking
      const addOnIndex = booking.addOns.findIndex((item) => item.addOn.toString() === addOnId.toString());

      if (addOnIndex === -1) {
        continue; // Skip if add-on not found in booking
      }

      const removedAddOn = booking.addOns[addOnIndex];
      const addOnName = removedAddOn.name;
      const addOnPrice = removedAddOn.totalPrice;

      // Remove the add-on from the array
      booking.addOns.splice(addOnIndex, 1);
      removedCount++;

      notificationMessages.push(`Vendor has removed "${addOnName}" (₹${addOnPrice}) from your booking.`);
    }

    if (removedCount === 0) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'No valid add-ons found to remove',
      });
    }

    // Update pricing
    const currentAddOnsTotal = booking.addOns.reduce((sum, item) => sum + item.totalPrice, 0);
    booking.pricing.addOnsTotal = currentAddOnsTotal;
    booking.pricing.totalAmount =
      booking.pricing.basePrice +
      booking.pricing.taxAmount +
      booking.pricing.platformFee +
      currentAddOnsTotal -
      booking.pricing.discountAmount -
      booking.pricing.couponDiscount;

    // Add notifications
    notificationMessages.forEach((message) => {
      booking.notifications.userNotifications.push({
        type: 'addon_removed',
        sentAt: new Date(),
        status: 'sent',
        message: message,
      });
    });

    await booking.save({ session });
    await session.commitTransaction();

    // Populate the response
    const formatedBooking = await Booking.findById(bookingId).populate(bookingPopulate).select(bookingSelect);

    res.status(200).json({
      success: true,
      message: `${removedCount} add-on(s) removed successfully`,
      data: formatedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error removing add-ons from booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove add-ons from booking',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, reason, notes, userId } = req.body;
    const vendorId = req.user?._id;

    const booking = await Booking.findById(bookingId)
      .populate('user', 'firstName lastName fcmToken')
      .populate('vendorSearch.assignedVendor.vendorId', 'name');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const isVendor =
      vendorId && booking.vendorSearch?.assignedVendor?.vendorId?._id?.toString() === vendorId.toString();

    if (!isVendor) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking',
      });
    }

    // Store old status
    const oldStatus = booking.status;

    // Update status
    booking.status = status;

    // Add to status history
    booking.statusHistory.push({
      status,
      timestamp: new Date(),
      changedBy: vendorId,
      changedByModel: 'Vendor',
      reason: reason || '',
      notes: notes || '',
    });

    // Handle specific status updates
    switch (status) {
      case 'accepted':
        if (booking.vendorSearch?.assignedVendor) {
          booking.vendorSearch.assignedVendor.acceptedAt = new Date();
        }
        break;

      case 'arrived':
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const bookingDate = new Date(booking.date);
        bookingDate.setHours(0, 0, 0, 0);

        if (bookingDate > today) {
          return res.status(400).json({
            success: false,
            message: 'Future booking cannot be started.',
          });
        }
        booking.timing.actualStartTime = new Date();
        break;

      case 'in_progress':
        if (!booking.timing.actualStartTime) {
          booking.timing.actualStartTime = new Date();
        }
        break;

      case 'completed':
        booking.timing.actualEndTime = new Date();
        if (booking.timing.actualStartTime) {
          const duration = Math.floor((booking.timing.actualEndTime - booking.timing.actualStartTime) / (1000 * 60));
          booking.timing.totalDuration = duration;
        }
        break;

      case 'cancelled_by_user':
      case 'cancelled_by_vendor':
      case 'cancelled_by_system':
        booking.cancellation = {
          cancelledBy: userId || vendorId,
          cancelledByModel: status.includes('user') ? 'User' : status.includes('vendor') ? 'Vendor' : 'System',
          cancelledAt: new Date(),
          reason: reason || 'No reason provided',
          refundStatus: 'pending',
        };
        break;
    }

    // Add user notification (for record)
    booking.notifications.userNotifications.push({
      type: getNotificationType(status),
      sentAt: new Date(),
      status: 'sent',
      message: getNotificationMessage(status),
    });

    await booking.save();

    // Fetch formatted booking for response
    const formattedBooking = await Booking.findById(bookingId).populate(bookingPopulate).select(bookingSelect);

    // ✅ Send push notification to user
    const user = booking.user;

    if (user?.fcmToken) {
      await NotificationService.sendNotification({
        token: user.fcmToken?.token,
        title: `Booking ${status.replace(/_/g, ' ').toUpperCase()}`,
        body: getNotificationMessage(status),
        data: {
          bookingId: booking._id.toString(),
          status,
          type: getNotificationType(status),
        },
        channelId: 'booking_updates',
        clickAction: 'OPEN_BOOKING_DETAILS',
        color: '#1976D2',
      });
    }

    res.status(200).json({
      success: true,
      message: `Booking status updated from '${oldStatus}' to '${status}'`,
      data: formattedBooking,
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message,
    });
  }
};

export const previewBookingPricing = async (req, res) => {
  try {
    const { serviceId, appliedCoupon, quantity = 1 } = req.body;
    const userId = req.user._id;

    const service = await ServiceTemplate.findById(serviceId);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const settings = await loaderService.loadSetting();
    const serviceTemplate = await loaderService.loadServiceTemplate(serviceId);
    const user = await loaderService.loadUser(userId);

    const bookingPrice = await bookingPriceService.calculateBookingPricing({
      service: serviceTemplate,
      appliedCoupon,
      user,
      settings,
      quantity,
    });

    return res.status(200).json({
      success: true,
      message: 'Pricing preview fetched successfully',
      pricing: bookingPrice,
    });
  } catch (error) {
    console.error('Preview pricing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing preview',
    });
  }
};

export const verifyBookingOtp = async (req, res) => {
  try {
    const { bookingId, otp } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const result = await booking.verifyOtp(otp, req.user._id);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

export const addSingleAddOnToBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { addOnId, bookingId } = req.body;
    const vendorId = req.user._id;

    if (!addOnId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'addOnId is required',
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check vendor authorization
    if (booking.vendorSearch.assignedVendor.vendorId.toString() !== vendorId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to add add-ons to this booking',
      });
    }

    // Check booking status
    const allowedStatuses = ['arrived', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Add-ons can only be added when booking status is 'arrived' or 'in_progress'. Current status: ${booking.status}`,
      });
    }

    // Find add-on
    const addOn = await AddOn.findById(addOnId).session(session);
    if (!addOn || !addOn.isActive || addOn.isDeleted) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive add-on',
      });
    }

    // Check applicability
    if (!addOn.serviceTemplates.some((st) => st.toString() === booking.serviceTemplate.toString())) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'This add-on is not applicable for the booked service',
      });
    }

    // Default quantity = 1
    const quantity = 1;
    const unitPrice = addOn.pricing.price;

    // Check if add-on already exists
    const existingAddOnIndex = booking.addOns.findIndex((item) => item.addOn.toString() === addOnId);
    if (existingAddOnIndex !== -1) {
      // Update existing add-on quantity
      booking.addOns[existingAddOnIndex].quantity += quantity;
      booking.addOns[existingAddOnIndex].totalPrice =
        booking.addOns[existingAddOnIndex].unitPrice * booking.addOns[existingAddOnIndex].quantity;
    } else {
      // Add new add-on
      booking.addOns.push({
        addOn: addOnId,
        name: addOn.name,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        addedBy: vendorId,
        isApprovedByUser: false,
        notes: '',
      });
    }

    // Update pricing totals
    const currentAddOnsTotal = booking.addOns.reduce((sum, item) => sum + item.totalPrice, 0);
    booking.pricing.addOnsTotal = currentAddOnsTotal;
    booking.pricing.totalAmount =
      booking.pricing.basePrice +
      booking.pricing.taxAmount +
      booking.pricing.platformFee +
      currentAddOnsTotal -
      booking.pricing.discountAmount -
      booking.pricing.couponDiscount;

    // Add notification
    booking.notifications.userNotifications.push({
      type: 'addon_added',
      sentAt: new Date(),
      status: 'sent',
      message: `Vendor added "${addOn.name}" (₹${unitPrice}) to your booking. Please approve or decline.`,
    });

    await booking.save({ session });
    await session.commitTransaction();

    const formattedBooking = await Booking.findById(bookingId).populate(bookingPopulate).select(bookingSelect).lean();

    res.status(200).json({
      success: true,
      message: 'Add-on added successfully. Waiting for user approval.',
      data: formattedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error adding single add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add add-on',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

export const removeSingleAddOnFromBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { addOnId, bookingId } = req.body;
    const vendorId = req.user._id;

    if (!addOnId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'addOnId is required',
      });
    }

    // Find booking
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check vendor authorization
    if (booking.vendorSearch.assignedVendor.vendorId.toString() !== vendorId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to remove add-ons from this booking',
      });
    }

    // Check booking status
    const allowedStatuses = ['arrived', 'in_progress'];
    if (!allowedStatuses.includes(booking.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Add-ons can only be removed when booking status is 'arrived' or 'in_progress'. Current status: ${booking.status}`,
      });
    }

    // Find add-on in booking
    const addOnIndex = booking.addOns.findIndex((item) => item.addOn.toString() === addOnId);
    if (addOnIndex === -1) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Add-on not found in this booking',
      });
    }

    // Remove 1 quantity or delete entirely if quantity = 1
    if (booking.addOns[addOnIndex].quantity > 1) {
      booking.addOns[addOnIndex].quantity -= 1;
      booking.addOns[addOnIndex].totalPrice =
        booking.addOns[addOnIndex].unitPrice * booking.addOns[addOnIndex].quantity;
    } else {
      booking.addOns.splice(addOnIndex, 1);
    }

    // Update pricing totals
    const currentAddOnsTotal = booking.addOns.reduce((sum, item) => sum + item.totalPrice, 0);
    booking.pricing.addOnsTotal = currentAddOnsTotal;
    booking.pricing.totalAmount =
      booking.pricing.basePrice +
      booking.pricing.taxAmount +
      booking.pricing.platformFee +
      currentAddOnsTotal -
      booking.pricing.discountAmount -
      booking.pricing.couponDiscount;

    // Add notification
    booking.notifications.userNotifications.push({
      type: 'addon_removed',
      sentAt: new Date(),
      status: 'sent',
      message: `Vendor has removed one quantity of an add-on from your booking. Please review.`,
    });

    await booking.save({ session });
    await session.commitTransaction();

    const formattedBooking = await Booking.findById(bookingId).populate(bookingPopulate).select(bookingSelect).lean();

    res.status(200).json({
      success: true,
      message: 'One quantity of add-on removed successfully. Waiting for user approval.',
      data: formattedBooking,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error removing add-on:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove add-on',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};
