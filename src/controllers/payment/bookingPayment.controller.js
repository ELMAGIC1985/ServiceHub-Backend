import mongoose from 'mongoose';
import { BookingPaymentService } from '../../services/booking/BookingPaymentService.js';
import { ApiError, ApiResponse, asyncHandler, logger } from '../../utils/index.js';

export const createBookingPayment = asyncHandler(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId, paymentMethod } = req.body;
    const userId = req.user._id;
    const userType = req.userType;

    if (!bookingId) {
      return next(new ApiError(400, 'Booking ID is required'));
    }

    if (!paymentMethod) {
      return next(new ApiError(400, 'Payment method is required'));
    }

    const bookingPaymentService = new BookingPaymentService();
    const paymentResult = await bookingPaymentService.createVendorPayment({
      bookingId,
      paymentMethod,
      userId,
      userType,
      userDetails: {
        name: req.user.name || `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        contact: req.user.phoneNumber,
      },
      session,
    });

    const isCashPayment = paymentResult.paymentMethod === 'cash';
    const isLiability = paymentResult.paymentMethod === 'liability_created';
    const isWalletPayment = paymentResult.paymentMethod === 'wallet';

    const responseData = {
      ...(isCashPayment || isLiability || isWalletPayment
        ? {
            ...(!isLiability
              ? {
                  transactionId: paymentResult.vendorTransaction._id,
                }
              : {
                  transactionId: paymentResult.transaction._id,
                }),

            paymentMethod: paymentResult.paymentMethod,
          }
        : {
            paymentLink: paymentResult.paymentLink,
            qr_image: paymentResult?.image_url,
            razorpayOrder: paymentResult.razorpayOrder,
            transactionId: paymentResult.transaction._id,
            paymentMethod: paymentResult.paymentMethod,
          }),
      booking: {
        pricing: paymentResult.booking.pricing,
        commission: paymentResult.booking.commission,
      },
      paymentBreakdown: {
        ...paymentResult.paymentBreakdown,
        commissionRate: `${paymentResult.paymentBreakdown.commissionRate}%`,
      },
    };

    const successMessage = isCashPayment
      ? 'Cash payment recorded successfully'
      : 'Booking payment initiated successfully';

    await session.commitTransaction();

    res.status(201).json(new ApiResponse(201, responseData, successMessage));
  } catch (error) {
    await session.abortTransaction();
    logger.error('Booking payment creation error:', error);
    return next(new ApiError(500, error.message || 'Failed to initiate booking payment'));
  } finally {
    await session.endSession();
  }
});

export const createBookingPaymentQr = asyncHandler(async (req, res, next) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    const userId = req.user._id;
    const userType = req.userType;

    // Validate input
    if (!bookingId) {
      return next(new ApiError(400, 'Booking ID is required'));
    }

    if (!paymentMethod) {
      return next(new ApiError(400, 'Payment method is required'));
    }

    // Use service layer
    const bookingPaymentService = new BookingPaymentService();
    const paymentResult = await bookingPaymentService.createVendorPayment({
      bookingId,
      paymentMethod,
      userId,
      userType,
      userDetails: {
        name: req.user.name || `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        contact: req.user.phoneNumber,
      },
    });

    // Prepare response
    const isCashPayment = paymentResult.paymentMethod === 'cash';
    const responseData = {
      ...(isCashPayment
        ? {
            booking: paymentResult.booking,
            transactionId: paymentResult.transaction._id,
            paymentMethod: 'cash',
            walletUpdate: paymentResult.walletUpdate,
          }
        : {
            razorpayOrder: paymentResult.razorpayOrder,
            paymentLink: paymentResult.paymentLink,
            booking: paymentResult.booking,
            transactionId: paymentResult.transaction._id,
            paymentMethod: paymentResult.paymentMethod,
          }),
      paymentBreakdown: {
        ...paymentResult.paymentBreakdown,
        commissionRate: `${paymentResult.paymentBreakdown.commissionRate}%`,
      },
    };

    const successMessage = isCashPayment
      ? 'Cash payment recorded successfully'
      : 'Booking payment initiated successfully';

    res.status(201).json(new ApiResponse(201, responseData, successMessage));
  } catch (error) {
    console.error('Booking payment creation error:', error);

    return next(new ApiError(500, error.message || 'Failed to initiate booking payment'));
  }
});

export const createBookingPaymentCash = asyncHandler(async (req, res, next) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    const userId = req.user._id;
    const userType = req.userType;

    // Validate input
    if (!bookingId) {
      return next(new ApiError(400, 'Booking ID is required'));
    }

    if (!paymentMethod) {
      return next(new ApiError(400, 'Payment method is required'));
    }

    // Use service layer
    const bookingPaymentService = new BookingPaymentService();
    const paymentResult = await bookingPaymentService.createUserPayment({
      bookingId,
      paymentMethod,
      userId,
      userType,
      userDetails: {
        name: req.user.name || `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        contact: req.user.phoneNumber,
      },
    });

    // Prepare response
    const isCashPayment = paymentResult.paymentMethod === 'cash';
    const responseData = {
      ...(isCashPayment
        ? {
            booking: paymentResult.booking,
            transactionId: paymentResult.transaction._id,
            paymentMethod: 'cash',
            walletUpdate: paymentResult.walletUpdate,
          }
        : {
            razorpayOrder: paymentResult.razorpayOrder,
            paymentLink: paymentResult.paymentLink,
            booking: paymentResult.booking,
            transactionId: paymentResult.transaction._id,
            paymentMethod: paymentResult.paymentMethod,
          }),
      paymentBreakdown: {
        ...paymentResult.paymentBreakdown,
        commissionRate: `${paymentResult.paymentBreakdown.commissionRate}%`,
      },
    };

    const successMessage = isCashPayment
      ? 'Cash payment recorded successfully'
      : 'Booking payment initiated successfully';

    res.status(201).json(new ApiResponse(201, responseData, successMessage));
  } catch (error) {
    console.error('Booking payment creation error:', error);

    return next(new ApiError(500, error.message || 'Failed to initiate booking payment'));
  }
});
