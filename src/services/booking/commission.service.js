import { logger } from '../../utils/logger.js';

export const CommissionService = {
  async calculateBookingComission({ booking, settings }) {
    const commissionRate = settings.commissionPerServiceBooking || 0;
    const bookingAmount = booking.pricing.totalAmount || 0;
    const commissionAmount = (booking.pricing.totalAmount * commissionRate) / 100;

    logger.info('Commission calculation', {
      bookingAmount,
      commissionRate,
      commissionAmount,
      bookingId: booking._id,
    });

    return {
      rate: commissionRate,
      amount: commissionAmount,
      appliedOn: bookingAmount,
      settingsId: settings._id,
    };
  },

  async calculateBillingComission({ booking, settings }) {
    const commissionRate = settings.commissionPerBilling || 0;
    const bookingAmount = booking.pricing.totalAmount || 0;
    const commissionAmount = (booking.pricing.totalAmount * commissionRate) / 100;

    logger.info('Commission calculation', {
      bookingAmount,
      commissionRate,
      commissionAmount,
      bookingId: booking._id,
    });

    return {
      rate: commissionRate,
      amount: commissionAmount,
      appliedOn: bookingAmount,
      settingsId: settings._id,
    };
  },

  async handleBookingPaymentCommission() {},
};
