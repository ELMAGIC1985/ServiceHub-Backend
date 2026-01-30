import razorpay from '../../config/razorpay.config.js';
import Transaction from '../../models/transaction.model.js';
import Wallet from '../../models/wallet.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import crypto from 'crypto';
import Order from '../../models/order.model.js';
import config from '../../config/config.js';
import mongoose from 'mongoose';

const createVendorWalletOrder = asyncHandler(async (req, res, next) => {
  const { amount, currency = 'INR', vendorId } = req.body;

  if (!amount || amount <= 0) {
    return next(new ApiError('Invalid amount', 400));
  }

  const transaction = new Transaction({
    userId: vendorId,
    userType: 'Vendor',
    amount: amount,
    transactionType: 'credit',
    status: 'pending',
    paymentMethod: 'razorpay',
    transactionFor: 'Wallet_TopUp',
  });

  try {
    const options = {
      amount: amount * 100,
      currency,
      receipt: `WAL_${transaction._id}`,
      notes: {
        type: 'wallet',
        walletTransactionId: transaction._id,
        vendorId: vendorId,
      },
    };

    await transaction.save();
    const order = await razorpay.orders.create(options);
    res.status(201).json(new ApiResponse(201, order, 'Order created successfully'));
  } catch (error) {
    return new ApiError('Razorpay order creation failed', 500);
  }
});

export const razorpayWebhook = async (req, res) => {
  try {
    const secret = config.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify Razorpay signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const expectedSignature = shasum.digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const { event, payload } = req.body;
    const payment = payload.payment.entity;
    const { order_id, notes, id } = payment;

    console.log('Received Webhook Event:', event);

    // Handle payment success for orders
    if (event === 'payment.captured') {
      if (notes.type === 'order') {
        await Order.findOneAndUpdate(
          { _id: notes.orderId },
          {
            paymentStatus: 'paid',
            orderStatus: 'confirmed',
            payment: {
              paymentStatus: 'paid',
              paymentMethod: 'razorpay',
              transactionId: id,
              paymentDate: new Date(),
            },
          }
        );
        await Transaction.findOneAndUpdate(
          { _id: notes.orderTransactionId },
          {
            status: 'success',
            razorpayPaymentId: id,
            razorpayOrderId: order_id,
            payment: {
              paymentStatus: 'paid',
              paymentMethod: 'razorpay',
              transactionId: id,
              paymentDate: new Date(),
            },
          }
        );
        console.log(`Order ${notes.orderId} marked as Paid.`);
      }

      // Handle wallet recharge
      else if (notes.type === 'wallet') {
        await Transaction.findOneAndUpdate(
          { _id: notes.walletTransactionId },
          {
            status: 'success',
            razorpayPaymentId: id,
            razorpayOrderId: order_id,
            payment: {
              paymentStatus: 'paid',
              paymentMethod: 'razorpay',
              transactionId: id,
              paymentDate: new Date(),
            },
          }
        );
        const wallet = await Wallet.findOne({ userId: notes.vendorId });
        wallet.balance = wallet.balance + payment.amount / 100;
        await wallet.save();
        console.log(`Wallet Recharge ${notes.walletTransactionId} completed.`);
      }
    }

    // Handle failed payments
    if (event === 'payment.failed') {
      if (notes.type === 'order') {
        await Order.findOneAndUpdate({ _id: notes.orderId }, { paymentStatus: 'failed', orderStatus: 'cancelled' });
        console.log(`Order ${notes.orderId} marked as Failed.`);
      } else if (notes.type === 'wallet') {
        await Transaction.findOneAndUpdate({ _id: notes.walletTransactionId }, { status: 'failed' });
        console.log(`Wallet Recharge ${notes.walletTransactionId} failed.`);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;
    const userType = req.userType;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required',
      });
    }

    // Find transaction by reference ID or MongoDB ID
    const transaction = await Transaction.findById(transactionId).select(
      'status paymentDetails.paymentStatus kycDetails.isExpired kycDetails.canSubmitKYC'
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Build lightweight response for polling
    const response = {
      success: true,
      data: {
        status: transaction.status,
        paymentStatus: transaction.paymentDetails.paymentStatus,
      },
    };

    // Add KYC specific fields only if it's a KYC payment
    if (transaction.kycDetails) {
      response.data.isExpired = transaction.kycDetails.isExpired;
    }

    return res.status(200).json({
      ...response,
    });
  } catch (error) {
    console.error('Error fetching payment status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment status',
      error: error.message,
    });
  }
};

export const getPaymentStatusBatch = async (req, res) => {
  try {
    const { transactionIds } = req.body;
    const userId = req.user._id;
    const userType = req.user.userType || 'Vendor';

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transaction IDs array is required',
      });
    }

    // Limit batch size to prevent abuse
    if (transactionIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 50 transactions can be checked at once',
      });
    }

    const transactions = await Transaction.find({
      $or: [
        { _id: { $in: transactionIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } },
        { 'references.referenceId': { $in: transactionIds } },
        { 'paymentDetails.transactionId': { $in: transactionIds } },
      ],
      'user.userId': userId,
      'user.userType': userType,
    }).select(
      '_id references.referenceId status paymentDetails.paymentStatus kycDetails.isExpired kycDetails.canSubmitKYC'
    );

    const statusMap = transactions.map((transaction) => ({
      transactionId: transaction._id.toString(),
      referenceId: transaction.references?.referenceId,
      status: transaction.status,
      paymentStatus: transaction.paymentDetails.paymentStatus,
      ...(transaction.kycDetails && {
        isExpired: transaction.kycDetails.isExpired,
        canSubmitKYC: transaction.kycDetails.canSubmitKYC,
      }),
    }));

    return res.status(200).json({
      success: true,
      count: statusMap.length,
      transactions: statusMap,
    });
  } catch (error) {
    console.error('Error fetching payment statuses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statuses',
      error: error.message,
    });
  }
};

export { createVendorWalletOrder };
