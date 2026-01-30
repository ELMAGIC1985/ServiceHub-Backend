import { MembershipPlan, Membership, Transaction } from '../../models/index.js';
import { getIO } from '../../sockets/socket.config.js';
import { ApiError, ApiResponse, asyncHandler } from '../../utils/index.js';
import { createNotification } from '../notification/utils/createNotification.js';
import { createMembershipOrderRazorpay } from './utils/createRazorpayOrder.js';
import crypto from 'crypto';

export const createMembershipOrder = asyncHandler(async (req, res, next) => {
  try {
    const { planId, paymentMethod } = req.body;
    const userId = req.user._id;
    const userType = req.userType;

    if (!planId) {
      return next(new ApiError(400, 'Membership plan ID is required'));
    }

    // Fetch membership plan
    const plan = await MembershipPlan.findById(planId);
    if (!plan || !plan.isActive) {
      return next(new ApiError(404, 'Invalid or inactive membership plan'));
    }

    // Check if user already has active membership
    const existingMembership = await Membership.findOne({
      memberId: userId,
      memberType: userType,
      planId,
      status: 'ACTIVE',
    });

    if (existingMembership) {
      return next(new ApiError(400, 'You already have an active membership for this plan'));
    }

    // Generate unique membership order ID
    const randomStr = crypto.randomBytes(3).toString('hex');
    const orderId = `MEM_${userId.toString().substring(0, 6)}_${randomStr}`;

    // Create membership (status PENDING until payment success)
    const membership = new Membership({
      memberType: userType,
      memberId: userId,
      memberTypeRef: userType,
      planId,
      status: 'PENDING',
      startDate: new Date(),
      endDate: new Date(Date.now() + plan.durationInDays * 24 * 60 * 60 * 1000),
      autoRenew: false,
      membershipUsage: plan.price * 2,
    });

    // Create transaction
    const transaction = new Transaction({
      amount: plan.price,
      currency: 'INR',
      transactionType: 'debit',
      status: 'pending',
      paymentMethod,
      transactionFor: 'membership_purchase',
      user: {
        userType,
        userId,
      },
      relatedEntity: {
        entityType: 'Membership',
        entityId: membership._id,
      },
      metadata: {
        description: `Purchase membership: ${plan.name}`,
        notes: `Membership duration: ${plan.durationInDays} days`,
        channel: 'web',
      },
      financial: {
        grossAmount: plan.price,
        netAmount: plan.price,
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
          reason: 'Membership order created, awaiting payment',
        },
      ],
    });

    let razorpayOrder = null;

    if (paymentMethod?.toLowerCase() === 'razorpay') {
      try {
        const { razorpayOrder: response } = await createMembershipOrderRazorpay({
          totalAmount: plan.price,
          orderId,
          orderMongoId: membership._id.toString(),
          userId,
          userType,
          transactionId: transaction._id.toString(),
          customer: {
            name: req.user.name,
            email: req.user.email,
            contact: req.user.phoneNumber,
          },
        });

        razorpayOrder = response;

        // Update transaction with Razorpay details
        transaction.paymentDetails = {
          gateway: {
            name: 'razorpay',
            orderId: razorpayOrder.id,
            gatewayResponse: razorpayOrder,
          },
          paymentStatus: 'pending',
        };
      } catch (error) {
        return next(new ApiError(500, `Razorpay order creation failed: ${error.message}`));
      }
    }

    // Save membership and transaction
    await Promise.all([membership.save(), transaction.save()]);

    // Notification
    await createNotification({
      title: 'New Membership Purchase',
      description: `${req.user.name} purchased membership: ${plan.name}`,
      userType,
      userId,
      category: 'membership_purchase',
    });

    // Emit socket event
    getIO().to('admins').emit('newMembershipPurchase', {
      membership,
      plan,
      transaction,
      customerName: req.user.firstName,
      userType,
    });

    // Prepare response
    const responseData =
      paymentMethod?.toLowerCase() === 'cash'
        ? { membership, transactionId: transaction._id }
        : { razorpayOrder, membership, transactionId: transaction._id };

    res.status(201).json(new ApiResponse(201, responseData, 'Membership order created successfully'));
  } catch (error) {
    console.error('Membership order creation error:', error);
    return next(new ApiError(500, error.message || 'Something went wrong'));
  }
});
