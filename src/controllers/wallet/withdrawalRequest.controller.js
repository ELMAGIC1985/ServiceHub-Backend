import mongoose from 'mongoose';
import { Wallet, WithdrawalRequest, BankAccount } from '../../models/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { loaderService } from '../../services/common/loader.query.service.js';
import { walletService } from '../../services/wallet/wallet.service.js';
import logger from '../../utils/logger.js';

export const createWithdrawalRequest = asyncHandler(async (req, res) => {
  const { amount, bank, vendorNotes } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const vendor = req.user._id;
    // 1. Find vendor's wallet
    const wallet = await Wallet.findOne({
      userId: vendor,
      userType: 'Vendor',
    }).session(session);

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const bankDetails = await BankAccount.findById(bank);

    if (!bankDetails) {
      throw new Error('Bank account not found');
    }

    // 2. Validate wallet status
    if (wallet.status !== 'active') {
      throw new Error(`Wallet is ${wallet.status}. Cannot process withdrawal.`);
    }

    // 3. Validate withdrawal amount

    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    if (amount > wallet.availableBalance) {
      throw new Error('Insufficient available balance');
    }

    const pendingRequests = await WithdrawalRequest.getTotalPendingAmount(vendor);
    const totalPending = pendingRequests[0]?.totalPendingAmount || 0;

    if (amount + totalPending > wallet.availableBalance) {
      throw new Error('Total pending withdrawals exceed available balance');
    }

    // 5. Calculate processing fee (example: 2% or minimum ₹10)
    const processingFee = 0;

    // 6. Freeze the amount in wallet
    wallet.frozenBalance += amount;
    await wallet.save({ session });

    // 7. Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      vendor,
      wallet: wallet._id,
      amount,
      currency: wallet.currency,
      bank,
      vendorNotes,
      processingFee,
      netAmount: amount - processingFee,
    });

    await withdrawalRequest.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      data: withdrawalRequest,
      message: 'Withdrawal request created successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const getMyWithdrawals = asyncHandler(async (req, res) => {
  const { status, from, to, page = 1, limit = 10 } = req.query;
  const vendor = req.user._id;

  const filters = { vendor };

  if (status) filters.status = status;

  if (from || to) {
    filters.requestedAt = {};
    if (from) filters.requestedAt.$gte = new Date(from);
    if (to) filters.requestedAt.$lte = new Date(to);
  }

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const [data, total] = await Promise.all([
    WithdrawalRequest.find(filters)
      .populate('wallet', 'balance currency')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    WithdrawalRequest.countDocuments(filters),
  ]);

  const totalPages = Math.ceil(total / limitNumber);

  res.status(200).json({
    success: true,
    message: 'Withdrawal requests fetched successfully',
    data,
    pagination: {
      currentPage: pageNumber,
      totalPages,
      total,
      limit: limitNumber,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1,
      skip,
      showing: `${skip + 1}-${Math.min(skip + limitNumber, total)} of ${total}`,
    },
  });
});

export const cancelWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const vendor = req.user.id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await WithdrawalRequest.findOne({
      _id: id,
      vendor,
    })
      .populate('wallet')
      .session(session);

    if (!request) {
      throw new Error('Withdrawal request not found');
    }

    if (!['pending', 'approved'].includes(request.status)) {
      throw new Error('Cannot cancel this request');
    }

    // Update request status
    request.status = 'cancelled';
    await request.save({ session });

    // Unfreeze amount
    const wallet = request.wallet;
    wallet.frozenBalance -= request.amount;
    await wallet.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Withdrawal request cancelled successfully',
      data: request,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const getAllWithdrawals = asyncHandler(async (req, res) => {
  const { status, priority, currency, from, to, page = 1, limit = 10 } = req.query;

  const filters = {};

  if (status) filters.status = status;
  if (priority) filters.priority = priority;
  if (currency) filters.currency = currency;

  if (from || to) {
    filters.requestedAt = {};
    if (from) filters.requestedAt.$gte = new Date(from);
    if (to) filters.requestedAt.$lte = new Date(to);
  }

  // ✅ Exclude withdrawals where vendor is null or missing
  filters.vendor = { $ne: null, $exists: true };

  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);
  const skip = (pageNumber - 1) * limitNumber;

  const [data, total] = await Promise.all([
    WithdrawalRequest.find(filters)
      .populate('vendor', 'firstName lastName name email phoneNumber')
      .populate('wallet', 'balance currency')
      .populate('bank', 'bankName accountNumber accountHolderName ifscCode')
      .populate('approvedBy', 'fullName')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean(),
    WithdrawalRequest.countDocuments(filters),
  ]);

  const totalPages = Math.ceil(total / limitNumber);
  const validWithdrawals = data.filter((w) => w.vendor !== null);

  res.status(200).json({
    success: true,
    message: 'Withdrawal requests fetched successfully',
    data: {
      withdrawals: validWithdrawals,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        total,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        skip,
        showing: `${skip + 1}-${Math.min(skip + limitNumber, total)} of ${total}`,
      },
      stats: {
        totalRequests: total,
        totalAmount: data.reduce((sum, req) => sum + req.amount, 0),
        totalPending: data.filter((req) => req.status === 'pending').length,
        totalApproved: data.filter((req) => req.status === 'approved').length,
        totalRejected: data.filter((req) => req.status === 'rejected').length,
        totalCompleted: data.filter((req) => req.status === 'completed').length,
      },
    },
  });
});

export const approveWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.user._id;

  const request = await WithdrawalRequest.findById(id);

  if (!request) {
    return res.status(404).json({
      success: false,
      message: 'Withdrawal request not found',
    });
  }

  if (request.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Only pending requests can be approved',
    });
  }

  const wallet = await loaderService.loadWallet(request.vendor, 'Vendor');

  request.status = 'approved';
  request.approvedBy = adminId;
  request.approvedAt = new Date();

  const { prev, current } = await walletService.debit(wallet, request.amount);
  await request.save();

  logger.info('Withdrawal request approved', {
    requestId: request._id,
    vendorId: request.vendor,
    amount: request.amount,
    prev: prev,
    current: current,
  });

  res.status(200).json({
    success: true,
    message: 'Withdrawal request approved successfully',
    data: request,
  });
});

export const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await WithdrawalRequest.findById(id).populate('wallet').session(session);

    if (!request) {
      throw new Error('Withdrawal request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Only pending requests can be rejected');
    }

    // Update request
    request.status = 'rejected';
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.rejectionReason = reason;
    await request.save({ session });

    // Unfreeze amount
    const wallet = request.wallet;
    wallet.frozenBalance -= request.amount;
    await wallet.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Withdrawal request rejected successfully',
      data: request,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export const processWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const request = await WithdrawalRequest.findById(id).populate('wallet').session(session);

    if (!request) {
      throw new Error('Withdrawal request not found');
    }

    if (request.status !== 'approved') {
      throw new Error('Only approved requests can be processed');
    }

    // Mark as processing
    request.status = 'processing';
    request.processedAt = new Date();
    await request.save({ session });

    // Deduct from wallet
    const wallet = request.wallet;
    wallet.balance -= request.amount;
    wallet.frozenBalance -= request.amount;
    await wallet.save({ session });

    // Mark as completed
    request.status = 'completed';
    request.completedAt = new Date();
    await request.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Withdrawal processed successfully',
      data: request,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});
