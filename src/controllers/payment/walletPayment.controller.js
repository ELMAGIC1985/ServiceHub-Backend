import crypto from 'crypto';

import { Transaction } from '../../models/index.js';

import config from '../../config/config.js';

import { getIO } from '../../sockets/socket.config.js';
import { ApiError, ApiResponse, asyncHandler } from '../../utils/index.js';
import { createNotification } from '../notification/utils/createNotification.js';
import { createWalletTopupOrderRazorpay } from './utils/createRazorpayOrder.js';
import { loaderService } from '../../services/common/loader.query.service.js';

export const createWalletTopupOrder = asyncHandler(async (req, res, next) => {
  try {
    const { amount, currency = 'INR', paymentMethod = 'razorpay' } = req.body;
    const userId = req.user._id;
    const userType = req.userType;

    if (!amount || amount <= 0) {
      return next(new ApiError(400, 'Invalid amount. Amount must be greater than 0'));
    }

    const minTopupAmount = parseFloat(config.MIN_WALLET_TOPUP_AMOUNT || 10);
    const maxTopupAmount = parseFloat(config.MAX_WALLET_TOPUP_AMOUNT || 100000);

    if (amount < minTopupAmount) {
      return next(new ApiError(400, `Minimum top-up amount is ₹${minTopupAmount}`));
    }

    if (amount > maxTopupAmount) {
      return next(new ApiError(400, `Maximum top-up amount is ₹${maxTopupAmount}`));
    }

    let wallet = await loaderService.loadWallet(userId, userType);

    const randomStr = crypto.randomBytes(3).toString('hex');
    const orderId = `WALLET_${userId.toString().substring(0, 6)}_${randomStr}`;

    const transaction = new Transaction({
      amount,
      currency,
      transactionType: 'credit',
      status: 'pending',
      paymentMethod,
      transactionFor: 'wallet_topup',
      user: {
        userType,
        userId,
      },
      relatedEntity: {
        entityType: 'Wallet',
        entityId: wallet._id,
      },
      metadata: {
        description: 'Wallet top-up payment',
        notes: `Top-up amount: ₹${amount}`,
        channel: 'web',
      },
      financial: {
        grossAmount: amount,
        netAmount: amount,
      },
      references: {
        referenceId: `TXN_${orderId}`,
      },
      audit: {
        createdBy: userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        source: 'web_app',
      },
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
          reason: 'Wallet top-up order created, awaiting payment',
        },
      ],
    });

    await transaction.save();

    let razorpayOrder = null;

    if (paymentMethod?.toLowerCase() === 'razorpay') {
      try {
        const { razorpayOrder: response, paymentLink } = await createWalletTopupOrderRazorpay({
          totalAmount: amount,
          orderId,
          orderMongoId: wallet._id.toString(),
          userId: userId.toString(),
          userType,
          transactionId: transaction._id.toString(),
          customer: {
            name: req.user.name,
            email: req.user.email,
            contact: req.user.phoneNumber,
          },
        });

        console.log('Step 5.2 - Payment link:', paymentLink);

        razorpayOrder = response;

        transaction.paymentDetails = {
          gateway: {
            name: 'razorpay',
            orderId: razorpayOrder.id,
            gatewayResponse: razorpayOrder,
          },
          paymentStatus: 'pending',
        };

        await transaction.save();
      } catch (error) {
        console.error('Razorpay order creation failed:', error);
        return next(new ApiError(500, `Razorpay order creation failed: ${error.message}`));
      }
    }

    // Notification
    await createNotification({
      title: 'New Wallet Top-up',
      description: `${req.user.name} initiated wallet top-up of ₹${amount}`,
      userType,
      userId,
      category: 'wallet_topup',
    });

    // Emit socket event
    getIO().to('admins').emit('newWalletTopup', {
      wallet,
      transaction,
      amount,
      customerName: req.user.firstName,
      userType,
    });

    // Prepare response
    const responseData =
      paymentMethod?.toLowerCase() === 'cash'
        ? {
            wallet: {
              id: wallet._id,
              currentBalance: wallet.balance,
              availableBalance: wallet.balance - wallet.frozenBalance,
              currency: wallet.currency,
            },
            transactionId: transaction._id,
          }
        : {
            razorpayOrder,
            wallet: {
              id: wallet._id,
              currentBalance: wallet.balance,
              availableBalance: wallet.balance - wallet.frozenBalance,
              currency: wallet.currency,
            },
            transactionId: transaction._id,
            razorpayConfig: {
              key: config.RAZORPAY_KEY_ID,
              name: 'Wallet Top-up',
              description: 'Add money to your wallet',
              theme: {
                color: '#3399cc',
              },
            },
          };

    console.log('=== WALLET TOPUP ORDER CREATION SUCCESS ===', {
      orderId,
      walletId: wallet._id.toString(),
      transactionId: transaction._id.toString(),
      razorpayOrderId: razorpayOrder?.id,
    });

    res.status(201).json(new ApiResponse(201, responseData, 'Wallet top-up order created successfully'));
  } catch (error) {
    console.error('=== WALLET TOPUP ORDER CREATION ERROR ===', error);
    return next(new ApiError(500, error.message || 'Something went wrong'));
  }
});

const verifyWebhookPayment = async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return next(new ApiError(400, 'Missing required webhook parameters'));
    }

    // Verify webhook signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET) // Different secret for webhooks
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return next(new ApiError(400, 'Invalid webhook signature'));
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (!payment) {
      return next(new ApiError(404, 'Payment not found'));
    }

    // Determine payment type from payment notes
    const paymentType = payment.notes?.orderType || payment.notes?.type;
    let result = false;

    // Process based on payment type
    if (paymentType === 'membership' || payment.notes?.type === 'membership_purchase') {
      result = await handleMembershipPayment(payment);
    } else if (paymentType === 'wallet' || payment.notes?.type === 'wallet_topup') {
      result = await handleWalletTopupPayment(payment);
    } else {
      console.error('Unknown payment type in webhook:', { paymentType, notes: payment.notes });
      return next(new ApiError(400, 'Unknown payment type'));
    }

    // Always return 200 for webhooks (Razorpay requirement)
    res.status(200).json({
      status: 'received',
      processed: result,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error('Webhook payment verification error:', error);

    // Always return 200 for webhooks even on error (Razorpay requirement)
    res.status(200).json({
      status: 'received',
      processed: false,
      error: 'Processing failed',
    });
  }
};
