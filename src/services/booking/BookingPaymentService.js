import crypto from 'crypto';
import { bookingPopulate } from '../../config/populate/bookingPopulate.js';
import { Booking, Setting, Transaction } from '../../models/index.js';
import { CommissionService } from '../commission/CommissionService.js';
import { PaymentGatewayService } from '../payment/PaymentGatewayService.js';
import { NotificationService } from '../notifications/NotificationService.js';

class BookingPaymentService {
  constructor() {
    this.commissionService = new CommissionService();
    this.paymentGatewayService = new PaymentGatewayService();
    this.notificationService = new NotificationService();
  }

  async createUserPayment({ bookingId, paymentMethod, userId, userType, userDetails }) {
    const booking = await this.validateBooking(bookingId, userId, userType);
    const paymentBreakdown = await this.calculatePaymentBreakdown(booking);
    const paymentResult = await this.processPayment({
      booking,
      paymentMethod,
      paymentBreakdown,
      userId,
      userType,
      userDetails,
    });

    await this.handlePostPayment(booking, paymentResult);

    return paymentResult;
  }

  async createVendorPayment({ bookingId, paymentMethod, userId, userType, userDetails, session }) {
    const booking = await this.validateBooking(bookingId, userId, userType, session);
    const paymentBreakdown = await this.calculatePaymentBreakdown(booking);
    booking.comission = {
      ...booking.comission,
      addOnsComissionRate: paymentBreakdown.addOnsCommissionRate,
      addOnsComissionAmount: paymentBreakdown.addOnsCommissionAmount,
      billingComissionRate: paymentBreakdown.billingCommissionRate,
      billingComissionAmount: paymentBreakdown.billingCommissionAmount,
      status: 'completed',
    };

    const paymentResult = await this.processPayment({
      booking,
      paymentMethod,
      paymentBreakdown,
      userId,
      userType,
      userDetails,
      session,
    });

    return paymentResult;
  }

  async processPayment({ booking, paymentMethod, paymentBreakdown, userId, userType, userDetails, session }) {
    const normalizedMethod = paymentMethod.toLowerCase().trim();
    const isCashPayment = ['cash', 'cod'].includes(normalizedMethod);

    if (isCashPayment) {
      return await this.processCashPayment({ booking, paymentBreakdown, userId, userType, session });
    } else if (normalizedMethod === 'razorpay') {
      return await this.processRazorpayPayment({
        booking,
        paymentMethod: normalizedMethod,
        paymentBreakdown,
        userId,
        userType,
        userDetails,
        session,
      });
    } else if (normalizedMethod === 'qr') {
      return await this.processQRCodePayment({
        booking,
        paymentBreakdown,
        userId,
        userType,
        userDetails,
        session,
      });
    }
  }

  async processCashPayment({ booking, paymentBreakdown, userId, userType, session }) {
    const vendorId = this.extractVendorId(booking);
    const orderId = this.generateOrderId(userId);

    console.log('Processing cash payment', { vendorId, orderId, paymentBreakdown });

    const result = await this.commissionService.handleCashPaymentCommission({
      vendorId,
      commissionAmount: paymentBreakdown.commissionAmount,
      paymentBreakdown,
      booking,
      orderId,
      session,
      userType,
    });

    const updatedBooking = await this.updateBookingPaymentStatus({
      booking,
      status: 'paid',
      userId,
      userType,
      reason: 'Cash payment collected',
      session,
    });

    return {
      paymentMethod: result.mode,
      paymentBreakdown,
      booking: updatedBooking,
      vendorTransaction: result.vendorTransaction,
      adminTransaction: result.adminTransaction,
      transaction: result.transaction,
      vendorWallet: result.vendorWallet,
    };
  }

  async processQRCodePayment({ booking, paymentMethod, paymentBreakdown, userId, userType, userDetails, session }) {
    const orderId = this.generateOrderId(userId);

    // Create transaction
    const transaction = await this.createTransaction({
      booking,
      paymentBreakdown,
      userId,
      userType,
      orderId,
      isCashPayment: false,
      status: 'pending',
    });

    // Create Razorpay order
    const razorpayResponse = await this.paymentGatewayService.createQrOrder({
      totalAmount: paymentBreakdown.totalAmount,
      orderId,
      orderMongoId: booking._id.toString(),
      userId,
      userType,
      transactionId: transaction._id.toString(),
      customer: userDetails,
    });

    // Update transaction with gateway details
    transaction.paymentDetails = {
      gateway: {
        name: 'razorpay',
        orderId: razorpayResponse.id,
        gatewayResponse: razorpayResponse,
      },
      paymentStatus: 'pending',
    };
    await transaction.save();

    await this.updateBookingPaymentStatus({
      booking,
      status: 'pending',
      userId,
      reason: 'Payment initiated',
      session,
    });

    return {
      transaction,
      razorpayOrder: razorpayResponse,
      paymentLink: razorpayResponse.paymentLink,
      paymentMethod,
      paymentBreakdown,
      booking,
    };
  }

  async processRazorpayPayment({ booking, paymentMethod, paymentBreakdown, userId, userType, userDetails, session }) {
    const orderId = this.generateOrderId(userId);

    const transaction = await this.createTransaction({
      booking,
      paymentBreakdown,
      userId,
      userType,
      orderId,
      isCashPayment: false,
      status: 'pending',
      session,
    });

    const razorpayResponse = await this.paymentGatewayService.createOrder({
      totalAmount: paymentBreakdown.totalAmount,
      orderId,
      orderMongoId: booking._id.toString(),
      userId,
      userType,
      transactionId: transaction._id.toString(),
      customer: userDetails,
    });

    transaction.paymentDetails = {
      gateway: {
        name: 'razorpay',
        orderId: razorpayResponse.id,
        gatewayResponse: razorpayResponse,
      },
      paymentStatus: 'pending',
    };
    await transaction.save({ session });

    await this.updateBookingPaymentStatus({
      booking,
      status: 'pending',
      userId,
      reason: 'Payment initiated',
      session,
      userType,
    });

    return {
      transaction,
      razorpayOrder: razorpayResponse.razorpayOrder,
      paymentLink: razorpayResponse.paymentLink,
      paymentMethod,
      paymentBreakdown,
      booking,
    };
  }

  extractVendorId(booking) {
    const vendorId = booking.vendorSearch?.assignedVendor?.vendorId?._id;
    if (!vendorId) {
      throw new ValidationError('Vendor not found for this booking');
    }
    return vendorId;
  }

  generateOrderId(userId) {
    const randomStr = crypto.randomBytes(3).toString('hex');
    return `BKG_${userId.toString().substring(0, 6)}_${randomStr}`;
  }

  async createTransaction({ booking, paymentBreakdown, userId, userType, orderId, isCashPayment, status, session }) {
    console.log('userId', userId, userType);

    const transaction = await Transaction.create(
      [
        {
          amount: paymentBreakdown.totalAmount,
          currency: paymentBreakdown.currency,
          transactionType: 'debit',
          status,
          paymentMethod: isCashPayment ? 'cash' : 'razorpay',
          transactionFor: 'booking_payment',
          user: { userType, userId },
          relatedEntity: {
            entityType: 'Booking',
            entityId: booking._id,
          },
          metadata: {
            description: `Payment for booking service: ${booking.serviceTemplate?.name || 'Service'}`,
            notes: isCashPayment
              ? `Cash payment collected by vendor on ${booking.date?.toLocaleDateString() || 'service date'}`
              : `Booking date: ${booking.date?.toLocaleDateString() || 'N/A'}`,
            channel: 'mobile_app',
          },
          references: {
            referenceId: `TXN_${orderId}`,
          },
          statusHistory: [
            {
              status,
              timestamp: new Date(),
              reason: isCashPayment
                ? 'Cash payment collected by vendor'
                : 'Booking payment initiated, awaiting payment confirmation',
            },
          ],
        },
      ],
      { session }
    );

    return transaction[0];
  }

  async updateBookingPaymentStatus({ booking, status, userId, userType, reason, session }) {
    booking.paymentStatus = status;
    booking.statusHistory ||= [];

    booking.statusHistory.push({
      status: status,
      timestamp: new Date(),
      changedBy: userId,
      changedByModel: userType,
      reason,
    });

    await booking.save({ session });

    return booking;
  }

  async validateBooking(bookingId, userId, userType, session) {
    const booking = await Booking.findById(bookingId)
      .populate(bookingPopulate)
      .select('-notifications -statusHistory')
      .session(session);

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (userType === 'Vendor') {
      if (booking.vendorSearch.assignedVendor.vendorId._id.toString() !== userId.toString()) {
        throw new UnauthorizedError('Unauthorized to access this booking');
      }
    } else {
      if (booking.user._id.toString() !== userId.toString()) {
        throw new UnauthorizedError('Unauthorized to access this booking');
      }
    }

    if (!['completed'].includes(booking.status)) {
      throw new ValidationError(`Cannot process payment for booking with status: ${booking.status}`);
    }

    if (booking.paymentStatus === 'paid') {
      throw new ValidationError('Payment already completed for this booking');
    }

    return booking;
  }

  async calculatePaymentBreakdown(booking) {
    const totalAmount = booking.pricing?.totalAmount;

    if (totalAmount <= 0) {
      throw new ValidationError('Invalid booking amount');
    }

    const settings = await Setting.findOne();
    if (!settings) throw new Error('SETTINGS_NOT_FOUND');

    const addOnsTotal = booking.pricing?.addOnsTotal || 0;
    const bookingAmount = booking.pricing?.totalAmount || 0;

    const bookingAmountExcludingAddOns = Math.max(0, bookingAmount - addOnsTotal);

    const addOnsCommissionRate = booking.comission?.totalComissionRate || 0;
    const addOnsCommissionAmount = (addOnsTotal * addOnsCommissionRate) / 100;

    const billingCommissionRate = booking.comission?.totalComissionRate - settings.commissionPerServiceBooking;

    const billingCommissionAmount = (bookingAmountExcludingAddOns * billingCommissionRate) / 100;

    const totalCommissionAmount = billingCommissionAmount + addOnsCommissionAmount;

    const vendorEarning = bookingAmount - totalCommissionAmount;
    const adminCommissionEarning = totalCommissionAmount;

    return {
      totalAmount,
      commissionAmount: adminCommissionEarning,
      addOnsCommissionAmount,
      addOnsCommissionRate,
      billingCommissionAmount,
      billingCommissionRate,
      vendorAmount: vendorEarning,
      currency: 'INR',
    };
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export { BookingPaymentService };
