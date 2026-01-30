import crypto from 'crypto';
import { asyncHandler, logger } from '../../utils/index.js';
import { Membership, Order, Transaction, User, Vendor, VendorKYC, Wallet, CalculatorLead } from '../../models/index.js';
import { KYC_STATUSES } from '../../constants/constants.js';
import { createNotification } from '../notification/utils/createNotification.js';
import { getIO } from '../../sockets/socket.config.js';
import { handleBookingPaymentCommission } from './utils/handleBookingPaymentCommission.js';
import mongoose from 'mongoose';
import { loaderService } from '../../services/common/loader.query.service.js';
import { walletService } from '../../services/wallet/wallet.service.js';
import { bookingNotificationService } from '../../services/booking/booking.notification.service.js';

export const verifyPayment = asyncHandler(async (req, res, next) => {
  let processingResult = false;
  try {
    const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '123456';
    const razorpay_signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const digest = crypto.createHmac('sha256', RAZORPAY_SECRET).update(JSON.stringify(req.body)).digest('hex');

    if (digest !== razorpay_signature) {
      console.error('Webhook signature verification failed', {
        receivedSignature: razorpay_signature,
        computedSignature: digest,
        timestamp: new Date().toISOString(),
      });

      // Still return success to avoid webhook disabling
      return res.status(200).json({
        status: 'ok',
        message: 'Invalid signature - logged for investigation',
      });
    }

    const { event, payload } = req.body;

    // Only process payment captured events
    if (event !== 'payment.captured') {
      return res.status(200).json({ status: 'ok', message: 'Event ignored' });
    }

    const paymentEntity = payload.payment.entity;
    const { notes, order_id, id: payment_id } = paymentEntity;

    console.log('Processing payment:', {
      paymentId: payment_id,
      orderId: order_id,
      paymentType: notes?.type,
      amount: paymentEntity.amount / 100, // Convert paise to rupees
    });

    // Route to appropriate handler based on payment type
    switch (notes?.type) {
      case 'product_order':
        processingResult = await handleProductOrderPayment(paymentEntity);
        break;
      case 'kyc_payment':
        processingResult = await handleKYCPayment(paymentEntity);
        break;
      case 'subscription_payment':
        processingResult = await handleSubscriptionPayment(paymentEntity);
        break;
      case 'service_payment':
        processingResult = await handleServicePayment(paymentEntity);
        break;
      case 'wallet_topup':
        processingResult = await handleWalletTopupPayment(paymentEntity);
        break;
      case 'membership_purchase':
        processingResult = await handleMembershipPayment(paymentEntity);
        break;
      case 'booking_payment':
        processingResult = await handleBookingPayment(paymentEntity);
        break;

      case 'appointment_payment':
        processingResult = await handleCalculatorAppointmentPayment(paymentEntity);
        break;
      default:
        console.warn('Unknown payment type:', notes?.type, {
          paymentId: payment_id,
          orderId: order_id,
          notes: notes,
        });
        processingResult = await handleGenericPayment(paymentEntity);
    }
    const responseMessage = processingResult
      ? 'Payment processed successfully'
      : 'Payment received - processing completed with warnings';

    console.log('Webhook processing completed:', {
      paymentId: payment_id,
      success: processingResult,
      message: responseMessage,
    });

    res.status(200).json({
      status: 'ok',
      message: responseMessage,
    });
  } catch (error) {
    console.error('Critical webhook processing error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      body: req.body,
    });

    res.status(200).json({
      status: 'ok',
      message: 'Webhook received - error logged for investigation',
    });
  }
});

// Handler for product order payments
const handleProductOrderPayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes, amount, method } = paymentEntity;
  const { orderId } = notes || {};

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      console.error(`Order not found for Razorpay order ID: ${orderId}`, {
        paymentId: payment_id,
        orderId: orderId,
        notes: notes,
      });
      await logWebhookError('ORDER_NOT_FOUND', `Order not found for Razorpay order ID: ${orderId}`, paymentEntity);
      return false;
    }

    // Find the related transaction
    const transaction = await Transaction.findOne({
      'relatedEntity.entityId': order._id,
      'relatedEntity.entityType': 'Order',
      status: 'pending',
    });

    if (!transaction) {
      console.error('Transaction not found or already processed', {
        orderId: order._id,
        razorpayOrderId: order_id,
        paymentId: payment_id,
      });
      await logWebhookError('TRANSACTION_NOT_FOUND', 'Transaction not found or already processed', paymentEntity);
      return false;
    }

    // Update transaction
    await updateTransactionStatus(transaction, paymentEntity, 'success');

    // Update order
    await Order.findByIdAndUpdate(order._id, {
      'payment.paymentStatus': 'paid',
      'payment.paymentMethod': method,
      'payment.transactionId': payment_id,
      'payment.paymentDate': new Date(),
      orderStatus: 'confirmed',
    });

    console.log(`Product order payment processed successfully: ${order.orderId}`, {
      paymentId: payment_id,
      orderId: order._id,
      amount: amount / 100,
    });

    return true; // Success
  } catch (error) {
    console.error('Error processing product order payment:', error, {
      paymentId: payment_id,
      orderId: order_id,
      errorMessage: error.message,
      stack: error.stack,
    });

    // Log error but don't throw - update transaction status silently
    await handlePaymentErrorSilent(order_id, payment_id, error.message, 'Order');
    return false;
  }
};

// Handler for KYC payments
const handleKYCPayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes, amount, method, fee } = paymentEntity;
  const { transactionId, userType, userId } = notes || {};
  try {
    const transaction = await Transaction.findOne({
      _id: transactionId,
      status: 'pending',
    });

    const vendor = await Vendor.findById(userId);

    if (userType === 'Vendor' && !vendor.wallet) {
      const wallet = new Wallet({
        userId,
        userType,
      });

      vendor.wallet = wallet._id;

      await wallet.save();
      await vendor.save();
    }

    if (!transaction) {
      console.error('KYC transaction not found or already processed', {
        orderId: order_id,
        paymentId: payment_id,
        notes: notes,
      });
      await logWebhookError(
        'KYC_TRANSACTION_NOT_FOUND',
        'KYC transaction not found or already processed',
        paymentEntity
      );
      return false;
    }

    // Update transaction status using the existing method
    await transaction.markKYCPaymentCompleted(payment_id, null, method);

    // Update additional payment details
    transaction.paymentDetails.gateway.paymentId = payment_id;
    transaction.paymentDetails.gateway.gatewayResponse = {
      id: payment_id,
      amount: amount,
      currency: paymentEntity.currency,
      status: paymentEntity.status,
      method: method,
      captured: paymentEntity.captured,
      fee: fee,
      created_at: paymentEntity.created_at,
    };

    // Add payment method details
    transaction.paymentMethodDetails = {
      method: method,
      bank: paymentEntity.bank || null,
      wallet: paymentEntity.wallet || null,
      vpa: paymentEntity.vpa || null,
      card: paymentEntity.card || null,
    };

    // Add gateway fees if available
    if (fee) {
      transaction.financial.fees.gatewayFee = fee / 100;
    }

    transaction.statusHistory.push({
      status: 'success',
      timestamp: new Date(),
      reason: 'KYC payment verified via webhook',
      updatedBy: transaction.user?.userId || 'webhook_system',
    });

    await transaction.save();

    // Update vendor KYC payment status
    if (transaction.user?.userId) {
      try {
        const vendorUpdateResult = await Vendor.findByIdAndUpdate(
          transaction.user.userId,
          {
            isKYCPaymentVerified: true,
            kycAmount: transaction.amount,
            kycStatus: KYC_STATUSES.PENDING,
          },
          { new: true }
        );

        if (!vendorUpdateResult) {
          console.error('Failed to update vendor KYC status', {
            vendorId: transaction.user.userId,
            paymentId: payment_id,
          });
        }

        // Update VendorKYC record
        const vendorKYC = await VendorKYC.findOne({ vendor: transaction.user.userId });
        if (vendorKYC) {
          vendorKYC.isKYCPaymentVerified = true;
          vendorKYC.kycAmount = transaction.amount;
          await vendorKYC.save();
        } else {
          console.warn('VendorKYC record not found', {
            vendorId: transaction.user.userId,
            paymentId: payment_id,
          });
        }

        console.log(`KYC payment processed successfully for vendor: ${transaction.user.userId}`, {
          paymentId: payment_id,
          amount: amount / 100,
          transactionId: transaction._id,
          kycStatus: KYC_STATUSES.PENDING,
        });
      } catch (vendorUpdateError) {
        console.error('Error updating vendor KYC status:', {
          error: vendorUpdateError.message,
          vendorId: transaction.user.userId,
          paymentId: payment_id,
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Error processing KYC payment:', error, {
      paymentId: payment_id,
      orderId: order_id,
      errorMessage: error.message,
      stack: error.stack,
    });

    // Try to mark transaction as failed
    await handlePaymentErrorSilent(order_id, payment_id, error.message, 'KYC');
    return false;
  }
};

const handleMembershipPayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes, amount, method } = paymentEntity;
  const { orderMongoId, orderId, userId, userType } = notes || {};

  try {
    // Find the membership using the MongoDB order ID from notes
    const membership = await Membership.findById(orderMongoId);
    if (!membership) {
      console.error(`Membership not found for order ID: ${orderMongoId}`, {
        paymentId: payment_id,
        orderMongoId: orderMongoId,
        notes: notes,
      });
      await logWebhookError(
        'MEMBERSHIP_NOT_FOUND',
        `Membership not found for order ID: ${orderMongoId}`,
        paymentEntity
      );
      return false;
    }

    // Find the related transaction
    const transaction = await Transaction.findOne({
      'relatedEntity.entityId': membership._id,
      'relatedEntity.entityType': 'Membership',
      status: 'pending',
    });

    if (!transaction) {
      console.error('Transaction not found or already processed', {
        membershipId: membership._id,
        razorpayOrderId: order_id,
        paymentId: payment_id,
      });
      await logWebhookError('TRANSACTION_NOT_FOUND', 'Transaction not found or already processed', paymentEntity);
      return false;
    }

    let user;
    if (userType === 'Vendor') {
      user = await Vendor.findById(userId);
    } else {
      user = await User.findById(userId);
    }

    user.membership = membership._id;
    await user.save();

    await updateTransactionStatus(transaction, paymentEntity, 'success');

    await Membership.findByIdAndUpdate(membership._id, {
      status: 'ACTIVE',
      paymentStatus: 'paid',
      paymentMethod: method.toUpperCase(),
      transactionId: payment_id,
      paymentDate: new Date(),
      startDate: new Date(),
      activatedAt: new Date(),
      paymentDetails: {
        paymentMethod: method.toUpperCase(),
        transactionId: orderId,
        amountPaid: amount / 100,
      },
    });

    // Create success notification
    await createNotification({
      title: 'Membership Activated',
      description: `Your membership has been successfully activated and is now active.`,
      userType: membership.memberType,
      userId: membership.memberId,
      category: 'membership_activation',
    });

    // Emit socket event for real-time updates
    getIO().to(`${membership.memberType}_${membership.memberId}`).emit('membershipActivated', {
      membershipId: membership._id,
      status: 'ACTIVE',
      paymentId: payment_id,
    });

    // Emit to admins
    getIO()
      .to('admins')
      .emit('membershipPaymentSuccess', {
        membership,
        transaction,
        paymentId: payment_id,
        amount: amount / 100,
      });

    console.log(`Membership payment processed successfully: ${membership._id}`, {
      paymentId: payment_id,
      membershipId: membership._id,
      amount: amount / 100,
      memberType: membership.memberType,
      memberId: membership.memberId,
    });

    return true; // Success
  } catch (error) {
    console.error('Error processing membership payment:', error, {
      paymentId: payment_id,
      orderId: order_id,
      errorMessage: error.message,
      stack: error.stack,
    });

    // Log error but don't throw - update transaction status silently
    await handlePaymentErrorSilent(order_id, payment_id, error.message, 'Membership');
    return false;
  }
};

const handleWalletTopupPayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes, amount } = paymentEntity;
  const { orderMongoId, transactionId, userId, userType } = notes || {};

  try {
    const transaction = await loaderService.loadTransaction(transactionId);
    if (transaction.status === 'success') {
      console.warn('Duplicate webhook call ignored: ', payment_id);
      return true;
    }
    const wallet = await loaderService.loadWalletById(orderMongoId);
    const user = await loaderService.loadUserByUserTypeAndUserId(userType, userId);

    await updateTransactionStatus(transaction, paymentEntity, 'success');

    const creditAmount = Number(amount) / 100;
    const { prev, current } = await walletService.credit(wallet, creditAmount);
    await walletService.addRecentTransaction(wallet, transaction._id);

    await createNotification({
      title: 'Wallet Top-up Successful',
      description: `₹${creditAmount} has been successfully added to your wallet. New balance: ₹${current}`,
      userType: userType,
      userId: userId,
      category: 'wallet_topup_success',
    });

    getIO().to(`${userType}_${userId}`).emit('walletTopupSuccess', {
      walletId: wallet._id,
      amount: creditAmount,
      oldBalance: prev,
      newBalance: current,
      paymentId: payment_id,
    });

    getIO()
      .to('admins')
      .emit('walletTopupPaymentSuccess', {
        wallet: wallet,
        transaction,
        user: {
          id: userId,
          name: user.name,
          type: userType,
        },
        paymentId: payment_id,
        amount: creditAmount,
        balanceChange: {
          before: prev,
          after: current,
        },
      });

    logger.info('Wallet top-up payment processed successfully', {
      paymentId: payment_id,
      walletId: wallet._id,
      amount: creditAmount,
      userId: userId,
      userType: userType,
      balanceBefore: prev,
      balanceAfter: current,
    });

    return true;
  } catch (error) {
    logger.error('Error processing wallet top-up payment:', error, {
      paymentId: payment_id,
      orderId: order_id,
      errorMessage: error.message,
      stack: error.stack,
    });

    await handlePaymentErrorSilent(order_id, payment_id, error.message, 'Wallet');
    return false;
  }
};

const handleBookingPayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes, amount, method } = paymentEntity;
  const { orderMongoId, userId, userType } = notes || {};

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const booking = await loaderService.loadBookingByIdWithPopulate(orderMongoId, session);
    const transaction = await loaderService.loadTransactionByEntityTypeAndEntityId(
      'Booking',
      booking._id,
      {
        status: 'pending',
      },
      session
    );

    const user = await loaderService.loadUserByUserTypeAndUserId(userType, userId);

    await updateTransactionStatus(transaction, paymentEntity, 'success', session);

    const vendorId = booking.vendorSearch?.assignedVendor?.vendorId;
    const vendor = await loaderService.loadVendor(vendorId);

    const commissionResult = await handleBookingPaymentCommission(booking, session, {
      vendorId: vendorId,
      req: null,
    });

    // Update booking with payment and commission details
    booking.paymentStatus = 'paid';
    booking.status = 'completed';

    booking.comission = {
      ...booking.comission,
      addOnsComissionRate: commissionResult.commission.addOnsCommissionRate,
      addOnsComissionAmount: commissionResult.commission.addOnsCommissionAmount,
      billingComissionRate: commissionResult.commission.billingCommissionRate,
      billingComissionAmount: commissionResult.commission.billingCommissionAmount,
      status: 'completed',
    };

    if (!booking.statusHistory) {
      booking.statusHistory = [];
    }

    // Add status history
    booking.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
      changedBy: userId,
      changedByModel: userType,
      reason: 'Payment successful',
    });

    await booking.save({ session });

    // Commit the transaction
    await session.commitTransaction();

    await bookingNotificationService.sendBookingConformationNotificationToVendor({ booking, vendor });

    try {
      getIO()
        .to('admins')
        .emit('bookingPaymentSuccess', {
          booking,
          transaction,
          paymentId: payment_id,
          amount: amount / 100,
          customerName: user.firstName || user.name,
          vendorName: booking?.vendor?.businessName || booking?.vendor?.name || 'Not assigned',
          commission: {
            billingCommissionRate: commissionResult.commission.billingCommissionRate,
            billingCommissionAmount: commissionResult.commission.billingCommissionAmount,
            addOnsCommissionRate: commissionResult.commission.addOnsCommissionRate,
            addOnsCommissionAmount: commissionResult.commission.addOnsCommissionAmount,
          },
        });
    } catch (socketError) {
      console.error('Error emitting socket event:', socketError);
    }

    logger.info(`Booking payment processed successfully: ${booking._id}`, {
      paymentId: payment_id,
      bookingId: booking._id,
      amount: amount / 100,
      userId: userId,
      userType: userType,
      vendorId: vendorId,
      serviceTemplate: booking.serviceTemplate?.name,
      commission: {
        billingCommissionRate: commissionResult.commission.billingCommissionRate,
        billingCommissionAmount: commissionResult.commission.billingCommissionAmount,
        addOnsCommissionRate: commissionResult.commission.addOnsCommissionRate,
        addOnsCommissionAmount: commissionResult.commission.addOnsCommissionAmount,
      },
      vendorTransactionId: commissionResult.vendorTransaction._id,
      adminTransactionId: commissionResult.adminTransaction?._id,
    });

    return true; // Success
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error processing booking payment:', error, {
      paymentId: payment_id,
      orderId: order_id,
      errorMessage: error.message,
      stack: error.stack,
    });

    await handlePaymentErrorSilent(order_id, payment_id, error.message, 'Booking');
    return false;
  } finally {
    await session.endSession();
  }
};

const handleSubscriptionPayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes } = paymentEntity;

  try {
    const transaction = await Transaction.findOne({
      'paymentDetails.gateway.orderId': order_id,
      transactionFor: 'subscription',
      status: 'pending',
    });

    if (!transaction) {
      throw new Error('Subscription transaction not found');
    }

    await updateTransactionStatus(transaction, paymentEntity, 'success');

    // Update subscription status
    // Add your subscription activation logic here
    console.log(`Subscription payment processed: ${notes?.subscriptionId}`);
  } catch (error) {
    console.error('Error processing subscription payment:', error);
    await handlePaymentError(order_id, payment_id, error.message, 'Subscription');
  }
};

const handleServicePayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes } = paymentEntity;

  try {
    const transaction = await Transaction.findOne({
      'paymentDetails.gateway.orderId': order_id,
      transactionFor: 'service_payment',
      status: 'pending',
    });

    if (!transaction) {
      throw new Error('Service transaction not found');
    }

    await updateTransactionStatus(transaction, paymentEntity, 'success');

    // Update service booking status
    // Add your service booking logic here
    console.log(`Service payment processed: ${notes?.serviceId}`);
  } catch (error) {
    console.error('Error processing service payment:', error);
    await handlePaymentError(order_id, payment_id, error.message, 'Service');
  }
};

const handleCalculatorAppointmentPayment = async (paymentEntity) => {
  const { order_id, id: payment_id, notes } = paymentEntity;

  try {
    const transaction = await Transaction.findById(notes?.transactionId);

    if (!transaction) {
      throw new Error('Calculator appointment transaction not found');
    }

    await updateTransactionStatus(transaction, paymentEntity, 'success');

    // Update appointment booking status\

    const lead = await CalculatorLead.findById(notes?.orderMongoId);
    if (!lead) {
      throw new Error('Calculator lead not found');
    }

    lead.payment = {
      amount: paymentEntity.amount / 100,
      paymentMethod: 'razorpay',
      paymentStatus: 'paid',
      razorpayOrderId: notes?.orderId,
      paidAt: new Date(),
    };

    await lead.save();

    // Add your appointment booking logic here
    console.log(`Calculator appointment payment processed: ${notes?.orderMongoId}`);

    return true;
  } catch (error) {
    console.error('Error processing calculator appointment payment:', error);
    await handlePaymentError(order_id, payment_id, error.message, 'Calculator appointment');
  }
};

// Generic payment handler for unknown types
const handleGenericPayment = async (paymentEntity) => {
  const { order_id, id: payment_id } = paymentEntity;

  try {
    // Try to find any pending transaction with this Razorpay order ID
    const transaction = await Transaction.findOne({
      'paymentDetails.gateway.orderId': order_id,
      status: 'pending',
    });

    if (transaction) {
      await updateTransactionStatus(transaction, paymentEntity, 'success');
      console.log(`Generic payment processed: ${payment_id}`, {
        paymentId: payment_id,
        transactionId: transaction._id,
      });
      return true;
    } else {
      console.warn(`No pending transaction found for order: ${order_id}`, {
        paymentId: payment_id,
        orderId: order_id,
      });
      await logWebhookError(
        'GENERIC_TRANSACTION_NOT_FOUND',
        `No pending transaction found for order: ${order_id}`,
        paymentEntity
      );
      return false;
    }
  } catch (error) {
    console.error('Error processing generic payment:', error, {
      paymentId: payment_id,
      orderId: order_id,
      errorMessage: error.message,
    });
    return false;
  }
};

const updateTransactionStatus = async (transaction, paymentEntity, status) => {
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
};

const handlePaymentError = async (order_id, errorMessage, entityType) => {
  try {
    let query = {};

    if (entityType === 'Order') {
      const order = await Order.findOne({ 'payment.razorpayOrderId': order_id });
      if (order) {
        query = {
          'relatedEntity.entityId': order._id,
          'relatedEntity.entityType': 'Order',
        };
      }
    } else {
      query = {
        'paymentDetails.gateway.orderId': order_id,
      };
    }

    const transaction = await Transaction.findOne(query);

    if (transaction) {
      transaction.status = 'failed';
      transaction.statusHistory.push({
        status: 'failed',
        timestamp: new Date(),
        reason: `Webhook processing error: ${errorMessage}`,
      });
      await transaction.save();
    }
  } catch (updateError) {
    logger.error('Failed to update transaction on error:', updateError);
  }
};

const handlePaymentErrorSilent = async (order_id, payment_id, errorMessage, entityType) => {
  try {
    let query = {};

    if (entityType === 'Order') {
      const order = await Order.findOne({ 'payment.razorpayOrderId': order_id });
      if (order) {
        query = {
          'relatedEntity.entityId': order._id,
          'relatedEntity.entityType': 'Order',
        };
      }
    } else {
      query = {
        'paymentDetails.gateway.orderId': order_id,
      };
    }

    const transaction = await Transaction.findOne(query);

    if (transaction) {
      transaction.status = 'failed';
      transaction.statusHistory.push({
        status: 'failed',
        timestamp: new Date(),
        reason: `Webhook processing error: ${errorMessage}`,
        updatedBy: 'webhook_system',
      });

      await transaction.save();

      logger.info('Transaction marked as failed', {
        transactionId: transaction._id,
        paymentId: payment_id,
        reason: errorMessage,
      });
    }
  } catch (updateError) {
    logger.error('Failed to update transaction status on error (silent)', {
      error: updateError.message,
      paymentId: payment_id,
      orderId: order_id,
    });
  }
};

const logWebhookError = async (errorCode, errorMessage, paymentEntity) => {
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
};

export {
  handleProductOrderPayment,
  handleKYCPayment,
  handleSubscriptionPayment,
  handleServicePayment,
  updateTransactionStatus,
};
