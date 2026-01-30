import { bookingPopulate, bookingSelect } from '../../config/populate/bookingPopulate.js';
import { STATUS } from '../../constants/constants';
import { Booking, User, Vendor } from '../../models/index.js';
import { ApiError, logger } from '../../utils/index.js';

class BookingPaymentService {
  async handleBookingPaymentVerification(paymentEntity) {
    const { notes } = paymentEntity;
    const { orderMongoId, userId, userType } = notes || {};

    const booking = await Booking.findById(orderMongoId).populate(bookingPopulate).select(bookingSelect);
    // .session(session);

    if (!booking) {
      await this.logWebhookError('TRANSACTION_NOT_FOUND', 'Transaction not found or already processed', paymentEntity);
      throw new ApiError(STATUS.NOT_FOUND, 'Booking not found');
    }

    const user = await this.getTransactionUser(userType, userId);
  }
  
  async logWebhookError(errorCode, errorMessage, paymentEntity) {
    try {
      logger.error('WEBHOOK_ERROR:', {
        errorCode,
        errorMessage,
        paymentId: paymentEntity.id,
        orderId: paymentEntity.order_id,
        amount: paymentEntity.amount,
        timestamp: new Date().toISOString(),
        paymentEntity: paymentEntity,
      });
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }
  }

  async getTransactionUser(userType, userId) {
    let user;
    if (userType === 'Vendor') {
      user = await Vendor.findById(userId);
    } else {
      user = await User.findById(userId);
    }

    if (!user) {
      await logWebhookError('USER_NOT_FOUND', `User not found: ${userId}`, paymentEntity);
      throw new ApiError(STATUS.NOT_FOUND, 'User not found');
    }
    return user;
  }

  async updateTransactionStatus(transaction, paymentEntity, status) {
    const { id: payment_id, fee, created_at } = paymentEntity;

    transaction.status = status;
    transaction.paymentDetails.paymentStatus = 'paid';
    transaction.paymentDetails.transactionId = payment_id;
    transaction.paymentDetails.paymentDate = new Date(created_at * 1000);
    transaction.paymentDetails.gateway.transactionId = payment_id;
    transaction.paymentDetails.gateway.paymentId = payment_id;

    if (fee) {
      transaction.financial.fees.gatewayFee = fee / 100;
    }

    transaction.statusHistory.push({
      status,
      timestamp: new Date(),
      reason: 'Payment verified via webhook',
      updatedBy: transaction.user?.userId || 'system',
    });

    transaction.audit.updatedBy = transaction.user?.userId || 'system';
    transaction.audit.source = 'razorpay_webhook';

    await transaction.save();
  }

  getVendorId(booking) {
    return booking.vendorSearch?.assignedVendor?.vendorId;
  }
}

const bookingPaymentService = new BookingPaymentService();

export { bookingPaymentService };
