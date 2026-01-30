import mongoose from 'mongoose';
import Transaction from '../../models/transaction.model.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const getAllTransactions = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      transactionType,
      transactionFor,
      paymentMethod,
      currency,
      userType,
      userId,
      search,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      amountRange,
      paymentStatus,
      gateway,
      isKYCPayment,
      isReconciled,
      isFlagged,
      riskScore,
      entityType,
      hasRefunds,
      channel,
      region,
    } = req.query;

    // Build filter object
    const filter = {};

    // Status filters
    if (status && status.toLowerCase() !== 'all') {
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map((s) => s.trim()) };
      } else {
        filter.status = status;
      }
    }

    // Transaction type filter
    if (transactionType && transactionType.toLowerCase() !== 'all') {
      filter.transactionType = transactionType;
    }

    // Transaction purpose filter
    if (transactionFor && transactionFor.toLowerCase() !== 'all') {
      if (transactionFor.includes(',')) {
        filter.transactionFor = { $in: transactionFor.split(',').map((t) => t.trim()) };
      } else {
        filter.transactionFor = transactionFor;
      }
    }

    // Payment method filter
    if (paymentMethod && paymentMethod.toLowerCase() !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    // Currency filter
    if (currency && currency.toLowerCase() !== 'all') {
      filter.currency = currency;
    }

    // User type filter
    if (userType && userType.toLowerCase() !== 'all') {
      filter['user.userType'] = userType;
    }

    // User ID filter
    if (userId && userId.toLowerCase() !== 'all' && mongoose.Types.ObjectId.isValid(userId)) {
      filter['user.userId'] = new mongoose.Types.ObjectId(userId);
    }

    // Payment status filter
    if (paymentStatus && paymentStatus.toLowerCase() !== 'all') {
      filter['paymentDetails.paymentStatus'] = paymentStatus;
    }

    // Gateway filter
    if (gateway && gateway.toLowerCase() !== 'all') {
      filter['paymentDetails.gateway.name'] = gateway;
    }

    // Entity type filter
    if (entityType && entityType.toLowerCase() !== 'all') {
      filter['relatedEntity.entityType'] = entityType;
    }

    // Channel filter
    if (channel && channel.toLowerCase() !== 'all') {
      filter['metadata.channel'] = channel;
    }

    // Region filter
    if (region && region.toLowerCase() !== 'all') {
      filter['metadata.region'] = region;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom && dateFrom !== '') {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo && dateTo !== '') {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Amount filters
    if (minAmount !== undefined || maxAmount !== undefined) {
      filter.amount = {};
      if (minAmount !== undefined && !isNaN(minAmount) && minAmount !== '') {
        filter.amount.$gte = parseFloat(minAmount);
      }
      if (maxAmount !== undefined && !isNaN(maxAmount) && maxAmount !== '') {
        filter.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Predefined amount ranges
    if (amountRange && amountRange.toLowerCase() !== 'all') {
      const ranges = {
        micro: { $lt: 100 },
        small: { $gte: 100, $lt: 1000 },
        medium: { $gte: 1000, $lt: 10000 },
        large: { $gte: 10000, $lt: 100000 },
        huge: { $gte: 100000 },
      };
      if (ranges[amountRange]) {
        filter.amount = ranges[amountRange];
      }
    }

    // KYC payment filter
    if (isKYCPayment === 'true') {
      filter.transactionFor = 'kyc_payment';
    } else if (isKYCPayment === 'false') {
      filter.transactionFor = { $ne: 'kyc_payment' };
    }

    // Reconciliation filter
    if (isReconciled && isReconciled.toLowerCase() !== 'all') {
      filter['reconciliation.isReconciled'] = isReconciled === 'true';
    }

    // Risk assessment filters
    if (isFlagged && isFlagged.toLowerCase() !== 'all') {
      filter['riskAssessment.isFlagged'] = isFlagged === 'true';
    }

    if (riskScore && !isNaN(riskScore)) {
      filter['riskAssessment.riskScore'] = { $gte: parseFloat(riskScore) };
    }

    // Refund filter
    if (hasRefunds === 'true') {
      filter['references.parentTransactionId'] = { $exists: true };
    } else if (hasRefunds === 'false') {
      filter['references.parentTransactionId'] = { $exists: false };
    }

    // Search functionality
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { 'references.referenceId': searchRegex },
        { 'paymentDetails.transactionId': searchRegex },
        { 'paymentDetails.gateway.orderId': searchRegex },
        { 'paymentDetails.gateway.paymentId': searchRegex },
        { 'references.invoiceNumber': searchRegex },
        { 'references.receiptNumber': searchRegex },
        { 'metadata.description': searchRegex },
        { 'paymentDetails.upiDetails.vpa': searchRegex },
      ];
    }

    // Count total documents for pagination
    const totalTransactions = await Transaction.countDocuments(filter);

    // Sort configuration
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination calculation
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Fetch transactions with populated references
    const transactions = await Transaction.find(filter)
      .populate('user.userId', 'firstName lastName email phoneNumber fullName')
      .populate('relatedEntity.entityId')
      .populate('references.parentTransactionId', 'amount status references.referenceId')
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    // Enhance transactions with computed fields
    const enhancedTransactions = transactions.map((transaction) => {
      // Calculate fees total
      const totalFees = transaction.financial?.fees
        ? Object.values(transaction.financial.fees).reduce((sum, fee) => sum + (fee || 0), 0)
        : 0;

      // Determine transaction age in days
      const transactionAge = Math.floor((new Date() - new Date(transaction.createdAt)) / (24 * 60 * 60 * 1000));

      // Risk level based on risk score
      const riskLevel =
        transaction.riskAssessment?.riskScore >= 70
          ? 'high'
          : transaction.riskAssessment?.riskScore >= 40
          ? 'medium'
          : 'low';

      // Settlement status
      const isSettled = transaction.financial?.settlement?.status === 'settled';

      return {
        ...transaction,
        // Computed fields
        totalFees,
        netAmountAfterFees: transaction.amount - totalFees,
        transactionAge,
        riskLevel,
        isSettled,
        isRefund: !!transaction.references?.parentTransactionId,
        isKYCTransaction: transaction.transactionFor === 'kyc_payment',

        // Formatted fields
        formattedAmount: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: transaction.currency || 'INR',
        }).format(transaction.amount),

        formattedNetAmount: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: transaction.currency || 'INR',
        }).format(transaction.financial?.netAmount || transaction.amount),

        formattedDate: new Date(transaction.createdAt).toLocaleDateString(),
        formattedTime: new Date(transaction.createdAt).toLocaleTimeString(),

        // Status badges
        statusBadge: transaction.status,
        paymentStatusBadge: transaction.paymentDetails?.paymentStatus || 'unknown',

        // User information summary
        userInfo: transaction.user?.userId
          ? {
              name: transaction.user.userId.firstName
                ? `${transaction.user.userId.firstName} ${transaction.user.userId.lastName}`.trim()
                : transaction.user.userId.businessName || 'Unknown',
              email: transaction.user.userId.email,
              type: transaction.user.userType,
            }
          : transaction.user?.guestInfo || null,

        // Payment method details
        paymentMethodDetails: {
          method: transaction.paymentMethod,
          gateway: transaction.paymentDetails?.gateway?.name,
          last4: transaction.paymentDetails?.cardDetails?.last4Digits,
          upi: transaction.paymentDetails?.upiDetails?.vpa,
        },

        // KYC specific fields (if applicable)
        ...(transaction.transactionFor === 'kyc_payment' && {
          kycStatus: {
            isExpired: transaction.kycDetails?.isExpired,
            canSubmitKYC: transaction.kycDetails?.canSubmitKYC,
            isSubmitted: transaction.kycDetails?.isKYCSubmitted,
            validUntil: transaction.kycDetails?.validUntil,
            remainingDays: transaction.kycDetails?.validUntil
              ? Math.max(
                  0,
                  Math.ceil((new Date(transaction.kycDetails.validUntil) - new Date()) / (24 * 60 * 60 * 1000))
                )
              : 0,
          },
        }),
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalTransactions / limitNum);
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Get comprehensive statistics
    const statisticsPromises = [
      Transaction.countDocuments({ status: 'success' }),
      Transaction.countDocuments({ status: 'failed' }),
      Transaction.countDocuments({ status: 'pending' }),
      Transaction.countDocuments({ transactionFor: 'kyc_payment' }),
      Transaction.countDocuments({ 'riskAssessment.isFlagged': true }),
      Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } }]),
      Transaction.aggregate([
        { $group: { _id: '$transactionFor', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([{ $group: { _id: '$paymentMethod', count: { $sum: 1 } } }]),
      Transaction.aggregate([
        {
          $group: {
            _id: null,
            totalVolume: { $sum: '$amount' },
            avgTransaction: { $avg: '$amount' },
            totalFees: { $sum: '$financial.fees.gatewayFee' },
          },
        },
      ]),
    ];

    const [
      successfulTransactions,
      failedTransactions,
      pendingTransactions,
      kycTransactions,
      flaggedTransactions,
      statusStats,
      purposeStats,
      paymentMethodStats,
      volumeStats,
    ] = await Promise.all(statisticsPromises);

    const response = {
      success: true,
      data: {
        transactions: enhancedTransactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          total: totalTransactions,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          skip,
          showing: `${skip + 1}-${Math.min(skip + limitNum, totalTransactions)} of ${totalTransactions}`,
        },
        statistics: {
          total: totalTransactions,
          successful: successfulTransactions,
          failed: failedTransactions,
          pending: pendingTransactions,
          kyc: kycTransactions,
          flagged: flaggedTransactions,
          byStatus: statusStats,
          byPurpose: purposeStats,
          byPaymentMethod: paymentMethodStats,
          volume: volumeStats[0] || { totalVolume: 0, avgTransaction: 0, totalFees: 0 },
        },
        filters: {
          applied: {
            status,
            transactionType,
            transactionFor,
            paymentMethod,
            currency,
            userType,
            userId,
            dateFrom,
            dateTo,
            minAmount,
            maxAmount,
            search,
            gateway,
            isKYCPayment,
            isFlagged,
          },
          count: Object.keys(filter).length,
        },
      },
      message: `Retrieved ${enhancedTransactions.length} transaction(s) successfully`,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching all transactions:', error);

    const errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';

    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

const getVendorTransactions = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const requestingUser = req.user;

    const targetVendorId = vendorId || requestingUser._id;

    // Authorization check
    const isAdmin = requestingUser.role === 'admin';
    const isVendor = requestingUser.role === 'vendor' && requestingUser._id.toString() === targetVendorId.toString();

    console.log(targetVendorId, isAdmin, isVendor);

    if (!isAdmin && !isVendor) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Vendors can only view their own transactions.',
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      transactionFor,
      paymentMethod,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeKYC = true,
      kycStatus = 'all',
    } = req.query;

    // Build filter for vendor transactions
    const filter = {
      'user.userId': new mongoose.Types.ObjectId(targetVendorId),
      'user.userType': 'Vendor',
    };

    // Apply additional filters
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (transactionFor && transactionFor !== 'all') {
      filter.transactionFor = transactionFor;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    // KYC specific filters
    if (!includeKYC) {
      filter.transactionFor = { $ne: 'kyc_payment' };
    } else if (includeKYC === 'only') {
      filter.transactionFor = 'kyc_payment';
    }

    // if (kycStatus && kycStatus !== 'all') {
    //   if (kycStatus === 'valid') {
    //     filter.transactionFor = 'kyc_payment';
    //     filter.status = 'success';
    //     filter['kycDetails.isExpired'] = false;
    //     filter['kycDetails.validUntil'] = { $gt: new Date() };
    //   } else if (kycStatus === 'expired') {
    //     filter.transactionFor = 'kyc_payment';
    //     filter['kycDetails.isExpired'] = true;
    //   } else if (kycStatus === 'submitted') {
    //     filter.transactionFor = 'kyc_payment';
    //     filter['kycDetails.isKYCSubmitted'] = true;
    //   }
    // }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const totalTransactions = await Transaction.countDocuments(filter);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const transactions = await Transaction.find(filter)
      .populate('relatedEntity.entityId', 'firstName lastName')
      .populate('kycDetails.kycSubmissionId')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    // Enhance vendor transactions with relevant computed fields
    const enhancedTransactions = transactions.map((transaction) => {
      const isKYCTransaction = transaction.transactionFor === 'kyc_payment';

      // KYC specific enhancements
      let kycDetails = null;
      if (isKYCTransaction) {
        const isValid =
          transaction.status === 'success' &&
          !transaction.kycDetails?.isExpired &&
          transaction.kycDetails?.validUntil > new Date();

        const remainingDays = transaction.kycDetails?.validUntil
          ? Math.max(0, Math.ceil((new Date(transaction.kycDetails.validUntil) - new Date()) / (24 * 60 * 60 * 1000)))
          : 0;

        // kycDetails = {
        //   isValid,
        //   isExpired: transaction.kycDetails?.isExpired || false,
        //   canSubmitKYC: transaction.kycDetails?.canSubmitKYC || false,
        //   isSubmitted: transaction.kycDetails?.isKYCSubmitted || false,
        //   validUntil: transaction.kycDetails?.validUntil,
        //   remainingDays,
        //   submittedAt: transaction.kycDetails?.kycSubmittedAt,
        //   attemptCount: transaction.kycDetails?.attemptCount || 1,
        //   maxAttempts: transaction.kycDetails?.maxAttempts || 3,
        // };
      }

      return {
        ...transaction,
        formattedAmount: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: transaction.currency || 'INR',
        }).format(transaction.amount),
        formattedDate: new Date(transaction.createdAt).toLocaleDateString(),
        statusBadge: transaction.status,
        // isKYCTransaction,
        // kycDetails,

        // Vendor-specific fields
        canWithdraw:
          transaction.status === 'success' &&
          transaction.transactionFor === 'commission' &&
          transaction.financial?.settlement?.status === 'settled',

        earningsType: ['commission', 'reward', 'cashback'].includes(transaction.transactionFor) ? 'earning' : 'payment',

        purpose: transaction.transactionFor.replace(/_/g, ' ').toUpperCase(),
        method: transaction.paymentMethod.replace(/_/g, ' ').toUpperCase(),

        transactionAge: Math.floor((new Date() - new Date(transaction.createdAt)) / (24 * 60 * 60 * 1000)),
      };
    });

    // Vendor-specific statistics
    const vendorStatsPromises = [
      // Basic transaction stats
      Transaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),

      // KYC payment stats
      Transaction.aggregate([
        {
          $match: {
            'user.userId': new mongoose.Types.ObjectId(targetVendorId),
            'user.userType': 'Vendor',
            transactionFor: 'kyc_payment',
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),

      // Earnings summary
      Transaction.aggregate([
        {
          $match: {
            'user.userId': new mongoose.Types.ObjectId(targetVendorId),
            'user.userType': 'Vendor',
            status: 'success',
            transactionFor: { $in: ['commission', 'reward', 'cashback'] },
          },
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$amount' },
            totalTransactions: { $sum: 1 },
          },
        },
      ]),
    ];

    const [transactionStats, kycStats, earningsStats] = await Promise.all(vendorStatsPromises);

    const totalPages = Math.ceil(totalTransactions / limitNum);

    res.status(200).json({
      success: true,
      data: {
        transactions: enhancedTransactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTransactions,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
        summary: {
          byStatus: transactionStats,
          kyc: {
            stats: kycStats,
            hasValidKYCPayment: enhancedTransactions.some((t) => t.isKYCTransaction && t.kycDetails?.isValid),
          },
          earnings: {
            total: earningsStats[0]?.totalEarnings || 0,
            transactions: earningsStats[0]?.totalTransactions || 0,
            formatted: new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
            }).format(earningsStats[0]?.totalEarnings || 0),
          },
        },
      },
      message: `Retrieved ${enhancedTransactions.length} vendor transaction(s) successfully`,
    });
  } catch (error) {
    console.error('Error fetching vendor transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    // If no userId provided, use requesting user's ID
    const targetUserId = userId || requestingUser._id;

    // Authorization check
    const isAdmin = requestingUser.role === 'admin';
    const isOwner = requestingUser._id.toString() === targetUserId.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own transactions.',
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      transactionFor,
      paymentMethod,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeKYC = 'true',
    } = req.query;

    // Build filter for user transactions
    const filter = {
      'user.userId': new mongoose.Types.ObjectId(targetUserId),
      'user.userType': 'User',
    };

    // Apply additional filters
    if (status && status !== 'all') {
      filter.status = status;
    }

    if (transactionFor && transactionFor !== 'all') {
      filter.transactionFor = transactionFor;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    // Exclude KYC transactions if requested (users typically don't have KYC payments)
    if (includeKYC === 'false') {
      filter.transactionFor = { $ne: 'kyc_payment' };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const totalTransactions = await Transaction.countDocuments(filter);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const transactions = await Transaction.find(filter)
      .populate('relatedEntity.entityId')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    // Enhance user transactions with relevant computed fields
    const enhancedTransactions = transactions.map((transaction) => {
      const totalFees = transaction.financial?.fees
        ? Object.values(transaction.financial.fees).reduce((sum, fee) => sum + (fee || 0), 0)
        : 0;

      return {
        ...transaction,
        formattedAmount: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: transaction.currency || 'INR',
        }).format(transaction.amount),
        formattedDate: new Date(transaction.createdAt).toLocaleDateString(),
        statusBadge: transaction.status,
        canRefund:
          transaction.status === 'success' &&
          ['product_order', 'service_booking', 'subscription'].includes(transaction.transactionFor) &&
          !transaction.references?.parentTransactionId,
        isRefund: !!transaction.references?.parentTransactionId,
        netAmount: transaction.amount - totalFees,
        transactionAge: Math.floor((new Date() - new Date(transaction.createdAt)) / (24 * 60 * 60 * 1000)),

        // Simplified for user view
        purpose: transaction.transactionFor.replace(/_/g, ' ').toUpperCase(),
        method: transaction.paymentMethod.replace(/_/g, ' ').toUpperCase(),
      };
    });

    // User-specific statistics
    const userStats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const totalSpent = await Transaction.aggregate([
      {
        $match: {
          ...filter,
          status: 'success',
          transactionType: 'debit',
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    const totalPages = Math.ceil(totalTransactions / limitNum);

    res.status(200).json({
      success: true,
      data: {
        transactions: enhancedTransactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalTransactions,
          limit: limitNum,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
        summary: {
          totalSpent: totalSpent[0]?.totalSpent || 0,
          totalTransactions: totalSpent[0]?.totalTransactions || 0,
          byStatus: userStats,
        },
      },
      message: `Retrieved ${enhancedTransactions.length} user transaction(s) successfully`,
    });
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

export { getAllTransactions, getVendorTransactions, getUserTransactions };
