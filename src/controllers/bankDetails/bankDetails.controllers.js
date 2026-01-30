import { ApiResponse, ApiError, asyncHandler } from '../../utils/index.js';
import { validationResult } from 'express-validator';

import { BankAccount } from '../../models/index.js';

// Create Bank Account
const createBankAccount = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req.body);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, 'Validation failed'));
  }

  const {
    accountHolderName,
    accountNumber,
    ifscCode,
    bankName,
    branchName,
    branchAddress,
    accountType = 'savings',
    isPrimary = false,
    dailyLimit,
    monthlyLimit,
    notes,
    tags,
  } = req.body;

  let isUserExists = req.user;

  if (!isUserExists) {
    return next(new ApiError(404, 'User not found'));
  }

  // Check if account number already exists
  const existingAccount = await BankAccount.findOne({ accountNumber });
  if (existingAccount) {
    return next(new ApiError(409, 'Bank account with this account number already exists'));
  }

  // If setting as primary, check if user already has a primary account
  if (isPrimary) {
    const existingPrimary = await BankAccount.findOne({
      user: req.user._id,
      userType: req.userType,
      isPrimary: true,
      isActive: true,
    });
    if (existingPrimary) {
      return next(new ApiError(409, 'User already has a primary bank account'));
    }
  }

  const bankAccount = new BankAccount({
    accountHolderName,
    accountNumber,
    ifscCode: ifscCode.toUpperCase(),
    bankName,
    branchName,
    branchAddress,
    accountType,
    user: req.user._id,
    userType: req.userType,
    isPrimary,
    limits: {
      dailyLimit: dailyLimit || 50000,
      monthlyLimit: monthlyLimit || 1000000,
      minimumTransfer: 1,
      maximumTransfer: 200000,
    },
    metadata: {
      addedBy: req.user?._id,
      source: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'web',
      notes,
      tags: tags || [],
    },
  });

  await bankAccount.save();
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(201, bankAccount, 'Bank account created successfully'));
});

const getUserBankAccounts = asyncHandler(async (req, res, next) => {
  const { includeInactive = false, verified = null } = req.query;

  const user = req.user;
  const userId = user?._id;

  console.log('User ID:', userId, req.userType);

  if (!user) {
    return next(new ApiError(404, 'User not found'));
  }

  const query = { user: userId };

  if (!includeInactive) {
    query.isActive = true;
  }

  const bankAccounts = await BankAccount.findOne(query)
    .populate('userDetails', 'name email')
    .populate('verification.verifiedBy', 'name email')
    .select('-metadata -auditLog -__v -encryptedAccountNumber')
    .sort({ isPrimary: -1, createdAt: -1 });

  return res.json(new ApiResponse(200, bankAccounts, 'Bank accounts retrieved successfully'));
});

// Get Bank Account by ID
const getBankAccountById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { includeDecrypted = false } = req.query;

  console.log('get asdafsd');

  const bankAccount = await BankAccount.findById(id)
    .populate('userDetails', 'name email')
    .populate('verification.verifiedBy', 'name email');

  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  // Include decrypted account number if requested and user has permission
  if (includeDecrypted && req.user?.role === 'admin') {
    const decryptedNumber = bankAccount.getDecryptedAccountNumber();
    bankAccount.decryptedAccountNumber = decryptedNumber;
  }

  return res.json(new ApiResponse(200, bankAccount, 'Bank account retrieved successfully'));
});

// Update Bank Account
const updateBankAccount = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, 'Validation failed'));
  }

  const { id } = req.params;
  const {
    accountHolderName,
    bankName,
    branchName,
    branchAddress,
    accountType,
    isPrimary,
    dailyLimit,
    monthlyLimit,
    notes,
    tags,
  } = req.body;

  const bankAccount = await BankAccount.findById(id).select('-metadata -__v -encryptedAccountNumber');
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  console.log('User Role:', req.user?.role, 'User ID:', req.user?._id, 'Account User ID:', bankAccount.user);

  // Check if user has permission to update this account
  if (req.user?.role !== 'admin' && bankAccount.user.toString() !== req.user?._id.toString()) {
    return next(new ApiError(403, 'Unauthorized to update this bank account'));
  }

  // If setting as primary, ensure no other account is primary
  if (isPrimary && !bankAccount.isPrimary) {
    await BankAccount.updateMany(
      {
        user: bankAccount.user,
        userType: bankAccount.userType,
        _id: { $ne: id },
      },
      { $set: { isPrimary: false } }
    );
  }

  // Update allowed fields
  if (accountHolderName) bankAccount.accountHolderName = accountHolderName;
  if (bankName) bankAccount.bankName = bankName;
  if (branchName) bankAccount.branchName = branchName;
  if (branchAddress) bankAccount.branchAddress = branchAddress;
  if (accountType) bankAccount.accountType = accountType;
  if (isPrimary !== undefined) bankAccount.isPrimary = isPrimary;
  if (notes) bankAccount.metadata.notes = notes;
  if (tags) bankAccount.metadata.tags = tags;

  // Update limits if provided
  if (req.user.role === 'admin') {
    if (dailyLimit) bankAccount.limits.dailyLimit = dailyLimit;
    if (monthlyLimit) bankAccount.limits.monthlyLimit = monthlyLimit;
  }

  await bankAccount.save();
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(200, bankAccount, 'Bank account updated successfully'));
});

// Set Primary Bank Account
const setPrimaryBankAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  // Check if user has permission
  if (req.user?.role !== 'admin' && bankAccount.userId.toString() !== req.user?.id) {
    return next(new ApiError(403, 'Unauthorized to update this bank account'));
  }

  if (!bankAccount.isActive) {
    return next(new ApiError(400, 'Cannot set inactive account as primary'));
  }

  if (!bankAccount.isVerified) {
    return next(new ApiError(400, 'Cannot set unverified account as primary'));
  }

  await bankAccount.setPrimary();
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(200, bankAccount, 'Primary bank account set successfully'));
});

// Verify Bank Account
const verifyBankAccount = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, 'Validation failed', errors.array()));
  }

  const { id } = req.params;
  const { verificationMethod, pennyDropData, documents } = req.body;

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  if (bankAccount.verification.status === 'verified') {
    return next(new ApiError(400, 'Bank account is already verified'));
  }

  // Handle penny drop verification
  if (verificationMethod === 'penny_drop') {
    bankAccount.verification.pennyDrop = {
      amount: pennyDropData.amount || 1,
      referenceId: pennyDropData.referenceId,
      transactionId: pennyDropData.transactionId,
      status: pennyDropData.status || 'pending',
      attempts: (bankAccount.verification.pennyDrop?.attempts || 0) + 1,
      lastAttemptAt: new Date(),
    };

    if (pennyDropData.status === 'success') {
      await bankAccount.verify(verificationMethod, req.user?.id);
    } else {
      bankAccount.verification.status = 'in_progress';
    }
  }

  // Handle document verification
  if (verificationMethod === 'bank_statement' || verificationMethod === 'passbook') {
    if (documents && documents.length > 0) {
      bankAccount.verification.documents = documents.map((doc) => ({
        type: doc.type,
        fileUrl: doc.fileUrl,
        uploadedAt: new Date(),
        status: 'pending',
      }));
      bankAccount.verification.status = 'in_progress';
    }
  }

  // Manual verification by admin
  if (verificationMethod === 'manual' && req.user?.role === 'admin') {
    await bankAccount.verify(verificationMethod, req.user.id);
  }

  await bankAccount.save();
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(200, bankAccount, 'Bank account verification updated successfully'));
});

// Approve Bank Account Verification
const approveBankAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { verificationMethod = 'manual' } = req.body;

  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Only admins can approve bank account verification'));
  }

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  if (bankAccount.verification.status === 'verified') {
    return next(new ApiError(400, 'Bank account is already verified'));
  }

  await bankAccount.verify(verificationMethod, req.user.id);
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(200, bankAccount, 'Bank account approved successfully'));
});

// Reject Bank Account Verification
const rejectBankAccount = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, 'Validation failed', errors.array()));
  }

  const { id } = req.params;
  const { reason } = req.body;

  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Only admins can reject bank account verification'));
  }

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  await bankAccount.reject(reason, req.user.id);
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(200, bankAccount, 'Bank account verification rejected'));
});

// Deactivate Bank Account
const deactivateBankAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { reason = 'User requested deactivation' } = req.body;

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  // Check if user has permission
  if (req.user?.role !== 'admin' && bankAccount.userId.toString() !== req.user?.id) {
    return next(new ApiError(403, 'Unauthorized to deactivate this bank account'));
  }

  if (!bankAccount.isActive) {
    return next(new ApiError(400, 'Bank account is already inactive'));
  }

  await bankAccount.deactivate(reason, req.user?.id);
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(200, bankAccount, 'Bank account deactivated successfully'));
});

// Reactivate Bank Account
const reactivateBankAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  if (req.user?.role !== 'admin') {
    return next(new ApiError(403, 'Only admins can reactivate bank accounts'));
  }

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  if (bankAccount.isActive) {
    return next(new ApiError(400, 'Bank account is already active'));
  }

  bankAccount.isActive = true;
  bankAccount.auditLog.push({
    action: 'reactivated',
    performedBy: req.user.id,
    changes: { status: 'Account reactivated' },
  });

  await bankAccount.save();
  await bankAccount.populate('userDetails', 'name email');

  return res.json(new ApiResponse(200, bankAccount, 'Bank account reactivated successfully'));
});

// Delete Bank Account (Soft Delete)
const deleteBankAccount = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { reason = 'Account deletion requested' } = req.body;

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  // Check if user has permission
  if (req.user?.roles.includes('admin') && bankAccount.userId.toString() !== req.user?._id) {
    return next(new ApiError(403, 'Unauthorized to delete this bank account'));
  }

  // Prevent deletion of primary account if user has other accounts
  if (bankAccount.isPrimary) {
    const otherAccounts = await BankAccount.countDocuments({
      userId: bankAccount.userId,
      userType: bankAccount.userType,
      isActive: true,
      _id: { $ne: id },
    });

    if (otherAccounts > 0) {
      return next(new ApiError(400, 'Cannot delete primary account. Set another account as primary first.'));
    }
  }

  bankAccount.isDeleted = true;

  await bankAccount.deactivate(reason, req.user?._id);

  await bankAccount.save();

  return res.json(new ApiResponse(200, null, 'Bank account deleted successfully'));
});

// Get Bank Account Analytics
const getBankAccountAnalytics = asyncHandler(async (req, res, next) => {
  const { userId, userType } = req.params;

  // Verify user exists and has permission
  if (req.user?.role !== 'admin' && req.user?.id !== userId) {
    return next(new ApiError(403, 'Unauthorized to view analytics'));
  }

  const analytics = await BankAccount.aggregate([
    {
      $match: { userId: mongoose.Types.ObjectId(userId), userType },
    },
    {
      $group: {
        _id: null,
        totalAccounts: { $sum: 1 },
        activeAccounts: { $sum: { $cond: ['$isActive', 1, 0] } },
        verifiedAccounts: { $sum: { $cond: ['$isVerified', 1, 0] } },
        totalTransfers: { $sum: '$usage.totalTransfers' },
        totalAmount: { $sum: '$usage.totalAmount' },
        failedTransfers: { $sum: '$usage.failedTransfers' },
        accountTypes: { $push: '$accountType' },
      },
    },
    {
      $project: {
        _id: 0,
        totalAccounts: 1,
        activeAccounts: 1,
        verifiedAccounts: 1,
        totalTransfers: 1,
        totalAmount: 1,
        failedTransfers: 1,
        successRate: {
          $cond: [
            { $eq: ['$totalTransfers', 0] },
            0,
            {
              $multiply: [
                {
                  $divide: [{ $subtract: ['$totalTransfers', '$failedTransfers'] }, '$totalTransfers'],
                },
                100,
              ],
            },
          ],
        },
        accountTypes: 1,
      },
    },
  ]);

  const result = analytics[0] || {
    totalAccounts: 0,
    activeAccounts: 0,
    verifiedAccounts: 0,
    totalTransfers: 0,
    totalAmount: 0,
    failedTransfers: 0,
    successRate: 0,
    accountTypes: [],
  };

  return res.json(new ApiResponse(200, result, 'Bank account analytics retrieved successfully'));
});

// Record Transfer Usage
const recordTransferUsage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { amount, success = true } = req.body;

  const bankAccount = await BankAccount.findById(id);
  if (!bankAccount) {
    return next(new ApiError(404, 'Bank account not found'));
  }

  await bankAccount.recordTransfer(amount, success);

  return res.json(new ApiResponse(200, bankAccount.usage, 'Transfer usage recorded successfully'));
});

const getAllBankAccounts = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      userType,
      accountType,
      bankName,
      ifscCode,
      isActive,
      isPrimary,
      isVerified,
      verificationStatus,
      userId,
      search,
      dateFrom,
      dateTo,
      accountHolderName,
      branchName,
      minTransfers,
      maxTransfers,
      hasFailedTransfers,
      lastUsedFrom,
      lastUsedTo,
    } = req.query;

    // Build filter object
    const filter = { isDeleted: false }; // Always exclude deleted accounts

    // User type filter
    if (userType && userType.toLowerCase() !== 'all' && ['User', 'Vendor', 'Admin'].includes(userType)) {
      filter.userType = userType;
    }

    // Account type filter
    if (
      accountType &&
      accountType.toLowerCase() !== 'all' &&
      ['savings', 'current', 'salary', 'overdraft', 'nri'].includes(accountType)
    ) {
      filter.accountType = accountType;
    }

    // Bank name filter
    if (bankName && bankName.toLowerCase() !== 'all' && bankName.trim() !== '') {
      filter.bankName = { $regex: bankName, $options: 'i' };
    }

    // IFSC code filter
    if (ifscCode && ifscCode.toLowerCase() !== 'all' && ifscCode.trim() !== '') {
      filter.ifscCode = { $regex: ifscCode.toUpperCase(), $options: 'i' };
    }

    // Boolean filters
    if (isActive && isActive.toLowerCase() !== 'all') {
      filter.isActive = isActive;
    }

    if (isPrimary && isPrimary.toLowerCase() !== 'all') {
      filter.isPrimary = isPrimary;
    }

    if (isVerified && isVerified.toLowerCase() !== 'all') {
      filter.isVerified = isVerified;
    }

    // Verification status filter
    if (
      verificationStatus &&
      verificationStatus.toLowerCase() !== 'all' &&
      ['pending', 'in_progress', 'verified', 'rejected'].includes(verificationStatus)
    ) {
      filter['verification.status'] = verificationStatus;
    }

    // User ID filter with proper validation
    if (userId && userId.toLowerCase() !== 'all' && userId.trim() !== '') {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        filter.userId = new mongoose.Types.ObjectId(userId);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId format',
        });
      }
    }

    // Account holder name filter
    if (accountHolderName && accountHolderName.trim() !== '') {
      filter.accountHolderName = { $regex: accountHolderName, $options: 'i' };
    }

    // Branch name filter
    if (branchName && branchName.trim() !== '') {
      filter.branchName = { $regex: branchName, $options: 'i' };
    }

    // Transfer count filters
    if (minTransfers !== undefined || maxTransfers !== undefined) {
      filter['usage.totalTransfers'] = {};
      if (minTransfers !== undefined && !isNaN(minTransfers) && minTransfers !== '') {
        filter['usage.totalTransfers'].$gte = parseInt(minTransfers);
      }
      if (maxTransfers !== undefined && !isNaN(maxTransfers) && maxTransfers !== '') {
        filter['usage.totalTransfers'].$lte = parseInt(maxTransfers);
      }
    }

    // Failed transfers filter
    if (hasFailedTransfers === 'true') {
      filter['usage.failedTransfers'] = { $gt: 0 };
    } else if (hasFailedTransfers === 'false') {
      filter['usage.failedTransfers'] = { $eq: 0 };
    }

    // Date range filter (creation date)
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom && dateFrom !== '') {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo && dateTo !== '') {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Last used date filter
    if (lastUsedFrom || lastUsedTo) {
      filter['usage.lastUsedAt'] = {};
      if (lastUsedFrom && lastUsedFrom !== '') {
        filter['usage.lastUsedAt'].$gte = new Date(lastUsedFrom);
      }
      if (lastUsedTo && lastUsedTo !== '') {
        filter['usage.lastUsedAt'].$lte = new Date(lastUsedTo);
      }
    }

    // Handle search across multiple fields
    if (search && search.trim() !== '') {
      const searchRegex = { $regex: search, $options: 'i' };
      filter.$or = [
        { accountHolderName: searchRegex },
        { bankName: searchRegex },
        { branchName: searchRegex },
        { ifscCode: searchRegex },
        { accountType: searchRegex },
        { userType: searchRegex },
      ];
    }

    // Count total documents for pagination
    const totalBankAccounts = await BankAccount.countDocuments(filter);

    // Sort configuration
    const sortObject = {};
    sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination calculation
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    console.log('filter', filter);

    // Fetch bank accounts with basic query
    const bankAccounts = await BankAccount.find(filter)
      .sort(sortObject)
      .skip(skip)
      .limit(limitNum)
      .lean() // Use lean for better performance
      .exec();

    // Enhance bank accounts with computed fields
    const enhancedBankAccounts = bankAccounts.map((account) => {
      // Calculate success rate
      const totalTransfers = account.usage?.totalTransfers || 0;
      const failedTransfers = account.usage?.failedTransfers || 0;
      const successfulTransfers = totalTransfers - failedTransfers;
      const successRate = totalTransfers > 0 ? ((successfulTransfers / totalTransfers) * 100).toFixed(2) : 100;

      // Determine account status
      let statusBadge = 'inactive';
      if (account.isActive && account.isVerified) {
        statusBadge = 'active';
      } else if (account.isActive && !account.isVerified) {
        statusBadge = 'pending-verification';
      } else if (!account.isActive) {
        statusBadge = 'inactive';
      }

      // Calculate days since last use
      const daysSinceLastUse = account.usage?.lastUsedAt
        ? Math.floor((new Date() - new Date(account.usage.lastUsedAt)) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...account,
        // Remove sensitive data
        encryptedAccountNumber: undefined,
        accountNumber: undefined, // Hide actual account number
        maskedAccountNumber: account.accountNumber ? `XXXX${account.accountNumber.slice(-4)}` : 'XXXX',
        // Add computed fields
        successRate: parseFloat(successRate),
        successfulTransfers,
        statusBadge,
        daysSinceLastUse,
        isRecentlyUsed: daysSinceLastUse !== null && daysSinceLastUse <= 30,
        // Format amounts
        formattedTotalAmount: new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
        }).format(account.usage?.totalAmount || 0),
        // Add verification badge
        verificationBadge: account.verification?.status || 'pending',
        // Bank info summary
        bankInfo: `${account.bankName} - ${account.branchName}`,
        // Last activity summary
        lastActivity: account.usage?.lastUsedAt ? new Date(account.usage.lastUsedAt).toLocaleDateString() : 'Never',
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalBankAccounts / limitNum);
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Get basic statistics (simplified)
    const statisticsPromises = [
      BankAccount.countDocuments({ isActive: true, isDeleted: false }),
      BankAccount.countDocuments({ isVerified: true, isDeleted: false }),
      BankAccount.countDocuments({ isPrimary: true, isDeleted: false }),
      BankAccount.countDocuments({ 'verification.status': 'pending', isDeleted: false }),
      BankAccount.countDocuments({ 'usage.failedTransfers': { $gt: 0 }, isDeleted: false }),
      BankAccount.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: '$userType', count: { $sum: 1 } } }]),
      BankAccount.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$accountType', count: { $sum: 1 } } },
      ]),
      BankAccount.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$verification.status', count: { $sum: 1 } } },
      ]),
    ];

    const [
      activeAccounts,
      verifiedAccounts,
      primaryAccounts,
      pendingVerification,
      accountsWithFailures,
      userTypeStats,
      accountTypeStats,
      verificationStats,
    ] = await Promise.all(statisticsPromises);

    // Prepare response
    const response = {
      success: true,
      data: {
        bankAccounts: enhancedBankAccounts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalBankAccounts,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
          skip,
          showing: `${skip + 1}-${Math.min(skip + limitNum, totalBankAccounts)} of ${totalBankAccounts}`,
        },
        statistics: {
          total: totalBankAccounts,
          active: activeAccounts,
          verified: verifiedAccounts,
          primary: primaryAccounts,
          pendingVerification: pendingVerification,
          withFailures: accountsWithFailures,
          byUserType: userTypeStats,
          byAccountType: accountTypeStats,
          byVerificationStatus: verificationStats,
        },
        filters: {
          applied: {
            userType: userType && userType !== 'all' ? userType : null,
            accountType: accountType && accountType !== 'all' ? accountType : null,
            bankName: bankName && bankName !== 'all' ? bankName : null,
            ifscCode: ifscCode && ifscCode !== 'all' ? ifscCode : null,
            isActive: isActive && isActive !== 'all' ? isActive === 'true' : null,
            isPrimary: isPrimary && isPrimary !== 'all' ? isPrimary === 'true' : null,
            isVerified: isVerified && isVerified !== 'all' ? isVerified === 'true' : null,
            verificationStatus: verificationStatus && verificationStatus !== 'all' ? verificationStatus : null,
            search: search || null,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
            accountHolderName: accountHolderName || null,
            minTransfers: minTransfers || null,
            maxTransfers: maxTransfers || null,
            hasFailedTransfers: hasFailedTransfers || null,
          },
          count: Object.keys(filter).length - 1, // Subtract 1 for isDeleted filter
        },
      },
      message: `Retrieved ${enhancedBankAccounts.length} bank account(s) successfully`,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);

    const errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';

    res.status(500).json({
      success: false,
      message: 'Failed to fetch bank accounts',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
};

export {
  createBankAccount,
  getUserBankAccounts,
  getBankAccountById,
  updateBankAccount,
  setPrimaryBankAccount,
  verifyBankAccount,
  approveBankAccount,
  rejectBankAccount,
  deactivateBankAccount,
  reactivateBankAccount,
  deleteBankAccount,
  getBankAccountAnalytics,
  recordTransferUsage,
  getAllBankAccounts,
};
