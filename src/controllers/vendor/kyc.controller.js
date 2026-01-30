import mongoose from 'mongoose';
import VendorKYC, { KYC_STATUSES, REJECTION_REASONS } from '../../models/vendor.kyc.modal.js';
import Vendor from '../../models/vendor.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import Transaction from '../../models/transaction.model.js';
import kycService from '../../services/vendor/kyc/kyc.service.js';

const submitKYC = asyncHandler(async (req, res, next) => {
  const vendorId = req.user._id;
  const kycData = req.body;
  const metadata = {
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const result = await kycService.submitKycApplication(vendorId, kycData, metadata);
  res.status(200).json(result);
});

const getKYCStatus = asyncHandler(async (req, res) => {
  const vendorId = req.user._id;
  const kycApplication = await VendorKYC.findOne({ vendor: vendorId }).populate(
    'verifiedBy',
    'firstName lastName email'
  );

  if (!kycApplication) {
    return res.status(404).json({
      success: false,
      message: 'KYC application not found',
    });
  }

  res.status(200).json({
    success: true,
    data: {
      kyc: kycApplication,
      completionPercentage: kycApplication.completionPercentage,
    },
  });
});

const getAllKYCs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    status, // KYC status filter
    isKYCVerified, // Verification status filter
    riskLevel, // Risk level filter
    dateFrom, // Date range filter
    dateTo, // Date range filter
    search,
    paymentStatus,
  } = req.query;

  // Build query
  let query = {};

  // Status filter
  if (status) {
    query.kycStatus = status;
  }

  // Verification status filter
  if (isKYCVerified !== undefined) {
    query.isKYCVerified = isKYCVerified;
  }

  // Payment verification status filter
  if (paymentStatus !== undefined) {
    query.isKYCPaymentVerified = paymentStatus;
  }

  // Risk level filter
  if (riskLevel) {
    query.riskLevel = riskLevel;
  }

  // Date range filter (for submission date)
  if (dateFrom || dateTo) {
    query.submittedAt = {};
    if (dateFrom) {
      query.submittedAt.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      query.submittedAt.$lte = new Date(dateTo);
    }
  }

  // Search filter
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search, $options: 'i' } },
    ];
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute queries
  const [kycApplications, totalCount] = await Promise.all([
    VendorKYC.find(query)
      .populate('vendor', 'firstName lastName email phoneNumber isBlocked')
      .populate('verifiedBy', 'firstName lastName')
      .populate('address')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    VendorKYC.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      kycApplications,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    },
  });
});

const getPendingKYCs = asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;

  const pendingKYCs = await VendorKYC.getPendingKYCs(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      pendingKYCs,
      count: pendingKYCs.length,
    },
  });
});

const getKYCStats = asyncHandler(async (req, res) => {
  const [statusStats, monthlyStats] = await Promise.all([
    VendorKYC.getKYCStats(),
    VendorKYC.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          approved: {
            $sum: {
              $cond: [{ $eq: ['$kycStatus', KYC_STATUSES.APPROVED] }, 1, 0],
            },
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ['$kycStatus', KYC_STATUSES.REJECTED] }, 1, 0],
            },
          },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 },
    ]),
  ]);

  res.status(200).json({
    success: true,
    data: {
      statusStats,
      monthlyStats,
    },
  });
});

const approveKYC = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { kycId } = req.params;
      const { action, reason, comments, expiryDays = 365, riskLevel, requiresMonitoring = false } = req.body;

      const adminId = req.user._id;
      const requestIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(kycId)) {
        throw new ApiError(400, 'Invalid KYC ID format');
      }

      if (!['approve', 'reject'].includes(action)) {
        throw new ApiError(400, 'Action must be either "approve" or "reject"');
      }

      if (action === 'reject' && !reason) {
        throw new ApiError(400, 'Rejection reason is required');
      }

      // Find KYC record with vendor details
      const kycRecord = await VendorKYC.findById(kycId)
        .populate('vendor', 'firstName lastName email phoneNumber isKYCVerified kycStatus')
        .session(session);

      if (!kycRecord) {
        throw new ApiError(404, 'KYC record not found');
      }

      // Check if KYC can be approved/rejected
      const allowedStatuses = [KYC_STATUSES.PENDING, KYC_STATUSES.UNDER_REVIEW];
      if (!allowedStatuses.includes(kycRecord.kycStatus)) {
        throw new ApiError(400, `Cannot ${action} KYC with status: ${kycRecord.kycStatus}`);
      }

      // Verify that required documents are present for approval
      if (action === 'approve') {
        if (!kycRecord.primaryDocument) {
          throw new ApiError(400, 'Primary document is required for KYC approval');
        }
        if (!kycRecord.selfieImage) {
          throw new ApiError(400, 'Selfie image is required for KYC approval');
        }
        if (!kycRecord.isKYCPaymentVerified) {
          throw new ApiError(400, 'KYC payment must be verified before approval');
        }
      }

      if (action === 'approve') {
        // Approve KYC
        kycRecord.kycStatus = KYC_STATUSES.APPROVED;
        kycRecord.isKYCVerified = true;
        kycRecord.verifiedAt = new Date();
        kycRecord.verifiedBy = adminId;
        kycRecord.reason = undefined;
        kycRecord.primaryDocument.isVerified = true;
        kycRecord.secondaryDocument.isVerified = true;

        // Set expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        kycRecord.expiresAt = expiryDate;

        // Set risk level if provided
        if (riskLevel && ['low', 'medium', 'high'].includes(riskLevel)) {
          kycRecord.riskLevel = riskLevel;
          kycRecord.riskScore = riskLevel === 'low' ? 20 : riskLevel === 'medium' ? 50 : 80;
        }

        // Update vendor KYC status
        await Vendor.findByIdAndUpdate(
          kycRecord.vendor._id,
          {
            isKYCVerified: true,
            kycStatus: 'approved',
            isVerified: true,
          },
          { session }
        );

        // Mark KYC payment transaction as KYC submitted if exists
        const kycPaymentTransaction = await Transaction.findValidKYCPaymentForVendor(kycRecord.vendor._id);
        if (kycPaymentTransaction) {
          await Transaction.findByIdAndUpdate(
            kycPaymentTransaction._id,
            {
              'kycDetails.isKYCSubmitted': true,
              'kycDetails.kycSubmittedAt': new Date(),
              'kycDetails.kycSubmissionId': kycRecord._id,
            },
            { session }
          );
        }
      } else {
        kycRecord.kycStatus = KYC_STATUSES.REJECTED;
        kycRecord.isKYCVerified = false;
        kycRecord.reason = reason;
        kycRecord.verifiedAt = undefined;
        kycRecord.verifiedBy = adminId;
        kycRecord.expiresAt = undefined;
        await Vendor.findByIdAndUpdate(
          kycRecord.vendor._id,
          {
            isKYCVerified: false,
            kycStatus: 'rejected',
          },
          { session }
        );
      }

      kycRecord.reviewComments = comments || kycRecord.reviewComments;
      kycRecord.lastModifiedBy = adminId;
      kycRecord.ipAddress = requestIP;
      kycRecord.userAgent = userAgent;

      // Set monitoring flag
      if (requiresMonitoring) {
        kycRecord.isManualReviewRequired = true;
      }

      // Add to verification history
      const historyEntry = {
        status: kycRecord.kycStatus,
        reason: action === 'approve' ? 'KYC approved' : reason,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        comments: comments,
      };
      kycRecord.verificationHistory.push(historyEntry);

      // Save KYC record
      await kycRecord.save({ session });

      // Get updated vendor information
      const updatedVendor = await Vendor.findById(kycRecord.vendor._id)
        .select('firstName lastName email phoneNumber isKYCVerified kycStatus isVerified')
        .session(session);

      const message =
        action === 'approve'
          ? `KYC approved successfully for vendor ${updatedVendor.firstName} ${updatedVendor.lastName}`
          : `KYC rejected for vendor ${updatedVendor.firstName} ${updatedVendor.lastName}`;

      res.status(200).json({
        success: true,
        data: null,
        message,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error('Error approving/rejecting KYC:', error);

    // If it's already an ApiError, pass it through
    if (error instanceof ApiError) {
      return next(error);
    }

    // Otherwise, create a generic ApiError
    return next(new ApiError(500, 'Failed to process KYC approval/rejection', error.message));
  } finally {
    await session.endSession();
  }
};

const rejectKYC = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, comments } = req.body;
  const adminId = req.user.id;

  if (!reason) {
    throw new ApiError('Rejection reason is required', 400);
  }

  const kycApplication = await VendorKYC.findById(id).populate('vendor');

  if (!kycApplication) {
    throw new ApiError('KYC application not found', 404);
  }

  if (kycApplication.kycStatus === KYC_STATUSES.APPROVED) {
    throw new ApiError('Cannot reject an approved KYC application', 400);
  }

  // Reject KYC using instance method
  await kycApplication.reject(adminId, reason, comments);

  // Update vendor status
  const vendor = kycApplication.vendor;
  vendor.kycStatus = KYC_STATUSES.REJECTED;
  vendor.isKYCVerified = false;

  await vendor.save();

  // TODO: Send notification to vendor
  // await sendKYCRejectionNotification(vendor.email, vendor.firstName, reason);

  res.status(200).json({
    success: true,
    message: 'KYC application rejected',
    data: {
      kycId: kycApplication._id,
      status: kycApplication.kycStatus,
      reason: kycApplication.reason,
    },
  });
});

const markForReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const kycApplication = await VendorKYC.findById(id);

  if (!kycApplication) {
    throw new ApiError('KYC application not found', 404);
  }

  // Mark for review using instance method
  await kycApplication.markForReview(reason);

  res.status(200).json({
    success: true,
    message: 'KYC application marked for manual review',
    data: {
      kycId: kycApplication._id,
      status: kycApplication.kycStatus,
      reason: kycApplication.reason,
    },
  });
});

const getKYCById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const kycApplication = await VendorKYC.findById(id)
    .populate('vendor', 'firstName lastName email phoneNumber createdAt')
    .populate('address')
    .populate('verifiedBy', 'firstName lastName email')
    .populate('lastModifiedBy', 'firstName lastName email');

  if (!kycApplication) {
    throw new ApiError('KYC application not found', 404);
  }

  res.status(200).json({
    success: true,
    data: {
      kyc: kycApplication,
    },
  });
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isKYCPaymentVerified, paymentTransactionId, kycAmount } = req.body;

  const kycApplication = await VendorKYC.findById(id);

  if (!kycApplication) {
    throw new ApiError('KYC application not found', 404);
  }

  // Update payment information
  kycApplication.isKYCPaymentVerified = isKYCPaymentVerified;
  kycApplication.paymentTransactionId = paymentTransactionId;
  kycApplication.kycAmount = kycAmount;

  if (isKYCPaymentVerified) {
    kycApplication.paymentVerifiedAt = new Date();
  }

  await kycApplication.save();

  // Update vendor payment status
  const vendor = await Vendor.findById(kycApplication.vendor);
  if (vendor) {
    vendor.isKYCPaymentVerified = isKYCPaymentVerified;
    vendor.kycAmount = kycAmount;
    await vendor.save();
  }

  res.status(200).json({
    success: true,
    message: 'Payment status updated successfully',
    data: {
      kycId: kycApplication._id,
      isKYCPaymentVerified: kycApplication.isKYCPaymentVerified,
      paymentVerifiedAt: kycApplication.paymentVerifiedAt,
    },
  });
});

const deleteKYC = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const kycApplication = await VendorKYC.findById(id);

  if (!kycApplication) {
    throw new ApiError('KYC application not found', 404);
  }

  if (kycApplication.kycStatus === KYC_STATUSES.APPROVED) {
    throw new ApiError('Cannot delete an approved KYC application', 400);
  }

  // Delete associated images from cloudinary
  const imagesToDelete = [];
  if (kycApplication.selfieImage) imagesToDelete.push(kycApplication.selfieImage);
  if (kycApplication.primaryDocument?.frontImage) imagesToDelete.push(kycApplication.primaryDocument.frontImage);
  if (kycApplication.primaryDocument?.backImage) imagesToDelete.push(kycApplication.primaryDocument.backImage);
  if (kycApplication.secondaryDocument?.frontImage) imagesToDelete.push(kycApplication.secondaryDocument.frontImage);
  if (kycApplication.secondaryDocument?.backImage) imagesToDelete.push(kycApplication.secondaryDocument.backImage);

  // Delete images from cloudinary
  await Promise.all(imagesToDelete.map((url) => deleteFromCloudinary(url)));

  // Delete KYC application
  await VendorKYC.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'KYC application deleted successfully',
  });
});

const updateKYCStatus = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const { kycId } = req.params;
      const {
        status, // Direct status instead of action
        reason,
        comments,
        expiryDays = 365,
        riskLevel,
        requiresMonitoring = false,
      } = req.body;

      const adminId = req.user._id;
      const requestIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(kycId)) {
        throw new ApiError(400, 'Invalid KYC ID format');
      }

      // Validate status - allow any valid KYC status
      const validStatuses = Object.values(KYC_STATUSES);
      if (!status || !validStatuses.includes(status)) {
        throw new ApiError(400, `Status must be one of: ${validStatuses.join(', ')}`);
      }

      // Require reason for rejection or other negative statuses
      const negativeStatuses = [KYC_STATUSES.REJECTED, KYC_STATUSES.SUSPENDED, KYC_STATUSES.EXPIRED];
      if (negativeStatuses.includes(status) && !reason) {
        throw new ApiError(400, 'Reason is required for this status');
      }

      // Find KYC record with vendor details
      const kycRecord = await VendorKYC.findById(kycId)
        .populate('vendor', 'firstName lastName email phoneNumber isKYCVerified kycStatus')
        .session(session);

      if (!kycRecord) {
        throw new ApiError(404, 'KYC record not found');
      }

      // Check if status change is valid (optional business logic)
      if (kycRecord.kycStatus === status) {
        throw new ApiError(400, `KYC is already in ${status} status`);
      }

      // Verify that required documents are present for approval
      if (status === KYC_STATUSES.APPROVED) {
        if (!kycRecord.primaryDocument) {
          throw new ApiError(400, 'Primary document is required for KYC approval');
        }
        if (!kycRecord.selfieImage) {
          throw new ApiError(400, 'Selfie image is required for KYC approval');
        }
        if (!kycRecord.isKYCPaymentVerified) {
          throw new ApiError(400, 'KYC payment must be verified before approval');
        }
      }

      // Update KYC record based on status
      kycRecord.kycStatus = status;
      kycRecord.lastModifiedBy = adminId;
      kycRecord.ipAddress = requestIP;
      kycRecord.userAgent = userAgent;
      kycRecord.reviewComments = comments || kycRecord.reviewComments;

      // Status-specific updates
      switch (status) {
        case KYC_STATUSES.APPROVED:
          kycRecord.isKYCVerified = true;
          kycRecord.verifiedAt = new Date();
          kycRecord.verifiedBy = adminId;
          kycRecord.reason = undefined;

          if (kycRecord.primaryDocument) {
            kycRecord.primaryDocument.isVerified = true;
          }
          if (kycRecord.secondaryDocument) {
            kycRecord.secondaryDocument.isVerified = true;
          }

          // Set expiry date
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
          kycRecord.expiresAt = expiryDate;

          // Set risk level if provided
          if (riskLevel && ['low', 'medium', 'high'].includes(riskLevel)) {
            kycRecord.riskLevel = riskLevel;
            kycRecord.riskScore = riskLevel === 'low' ? 20 : riskLevel === 'medium' ? 50 : 80;
          }

          const vendor = await Vendor.findById(kycRecord.vendor._id);

          vendor.isKYCVerified = true;
          vendor.kycStatus = 'approved';
          vendor.isVerified = true;

          await vendor.save({ session });

          // Mark KYC payment transaction as KYC submitted if exists
          const kycPaymentTransaction = await Transaction.findValidKYCPaymentForVendor(kycRecord.vendor._id);
          if (kycPaymentTransaction) {
            await Transaction.findByIdAndUpdate(
              kycPaymentTransaction._id,
              {
                'kycDetails.isKYCSubmitted': true,
                'kycDetails.kycSubmittedAt': new Date(),
                'kycDetails.kycSubmissionId': kycRecord._id,
              },
              { session }
            );
          }
          break;

        case KYC_STATUSES.REJECTED:
        case KYC_STATUSES.SUSPENDED:
          kycRecord.isKYCVerified = false;
          kycRecord.reason = reason;
          kycRecord.verifiedAt = undefined;
          kycRecord.verifiedBy = adminId;
          kycRecord.expiresAt = undefined;
          kycRecord.reasonEnum = REJECTION_REASONS.DOCUMENT_NOT_VERIFIED;

          await Vendor.findByIdAndUpdate(
            kycRecord.vendor._id,
            {
              isKYCVerified: false,
              kycStatus: status === KYC_STATUSES.REJECTED ? 'rejected' : 'suspended',
            },
            { session }
          );
          break;

        case KYC_STATUSES.PENDING:
        case KYC_STATUSES.UNDER_REVIEW:
          kycRecord.isKYCVerified = false;
          kycRecord.verifiedAt = undefined;
          kycRecord.reason = reason;

          await Vendor.findByIdAndUpdate(
            kycRecord.vendor._id,
            {
              isKYCVerified: false,
              kycStatus: status.toLowerCase().replace('_', '-'),
            },
            { session }
          );
          break;

        case KYC_STATUSES.EXPIRED:
          kycRecord.isKYCVerified = false;
          kycRecord.reason = reason || 'KYC has expired';
          kycRecord.expiresAt = kycRecord.expiresAt || new Date(); // Set to current date if not set

          await Vendor.findByIdAndUpdate(
            kycRecord.vendor._id,
            {
              isKYCVerified: false,
              kycStatus: 'expired',
            },
            { session }
          );
          break;

        default:
          // For any other statuses, just update basic fields
          kycRecord.reason = reason;
          break;
      }

      // Set monitoring flag
      if (requiresMonitoring) {
        kycRecord.isManualReviewRequired = true;
      }

      // Add to verification history
      const historyEntry = {
        status: status,
        reason: reason || `Status changed to ${status}`,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        comments: comments,
      };
      kycRecord.verificationHistory.push(historyEntry);

      // Save KYC record
      await kycRecord.save({ session });

      // Get updated vendor information
      const updatedVendor = await Vendor.findById(kycRecord.vendor._id)
        .select('firstName lastName email phoneNumber isKYCVerified kycStatus isVerified')
        .session(session);

      const message = `KYC status updated to ${status} for vendor ${updatedVendor.firstName} ${updatedVendor.lastName}`;

      res.status(200).json({
        success: true,
        data: {
          kycId: kycRecord._id,
          oldStatus: kycRecord.kycStatus,
          newStatus: status,
          vendor: updatedVendor,
        },
        message,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (error) {
    console.error('Error updating KYC status:', error);

    // If it's already an ApiError, pass it through
    if (error instanceof ApiError) {
      return next(error);
    }

    // Otherwise, create a generic ApiError
    return next(new ApiError(500, 'Failed to update KYC status', error.message));
  } finally {
    await session.endSession();
  }
};

export {
  submitKYC,
  getKYCStatus,
  getAllKYCs,
  getPendingKYCs,
  getKYCStats,
  approveKYC,
  rejectKYC,
  markForReview,
  getKYCById,
  updatePaymentStatus,
  deleteKYC,
  updateKYCStatus,
};
