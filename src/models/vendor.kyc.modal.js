import mongoose from 'mongoose';
import { ADDRESS_TYPES, DOCUMENT_TYPES, KYC_STATUSES } from '../constants/constants.js';

const documentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: Object.values(DOCUMENT_TYPES),
        message: 'Invalid document type',
      },
    },
    number: {
      type: String,
      required: [true, 'Document number is required'],
      trim: true,
      uppercase: true,
      minlength: [5, 'Document number must be at least 5 characters'],
      maxlength: [20, 'Document number cannot exceed 20 characters'],
    },
    frontImage: {
      type: String,
      required: [true, 'Document front image is required'],
      trim: true,
    },
    backImage: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
    },
  },
  { _id: false }
);

// Verification history for audit trail
const verificationHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: Object.values(KYC_STATUSES),
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
    comments: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comments cannot exceed 1000 characters'],
    },
  },
  { _id: false }
);

const REJECTION_REASONS = {
  OTHER: 'other',
  DOCUMENT_NOT_VERIFIED: 'document_not_verified',
  INCOMPLETE: 'incomplete',
  FRAUDULENT: 'fraudulent',
};

// Main KYC schema
const vendorKYCSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor reference is required'],
      index: true,
    },

    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },

    middleName: {
      type: String,
      trim: true,
      maxlength: [50, 'Middle name cannot exceed 50 characters'],
    },

    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: 'Invalid phone number format',
      },
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format',
      },
    },

    dob: {
      type: String,
      required: [true, 'Date of birth is required'],
      trim: true,
    },

    purpose: {
      type: String,
      trim: true,
      maxlength: [500, 'Purpose cannot exceed 500 characters'],
    },

    occupation: {
      type: String,
      trim: true,
      maxlength: [100, 'Occupation cannot exceed 100 characters'],
    },

    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
    },

    primaryDocument: {
      type: documentSchema,
      required: [true, 'Primary identification document is required'],
    },
    secondaryDocument: {
      type: documentSchema,
    },

    selfieImage: {
      type: String,
      required: [true, 'Selfie image is required for verification'],
      trim: true,
    },

    kycStatus: {
      type: String,
      default: KYC_STATUSES.PENDING,
      enum: {
        values: Object.values(KYC_STATUSES),
        message: 'Invalid KYC status',
      },
      index: true,
    },
    isKYCVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Verification Details
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    expiresAt: {
      type: Date,
      validate: {
        validator: function (v) {
          return !v || v > new Date();
        },
        message: 'KYC expiry date must be in the future',
      },
    },

    serviceRadius: {
      type: Number,
      required: [true, 'Service radius is required'],
      min: [1, 'Service radius should be greater than 1km'],
      max: [100, 'Service radius should not be greater than 100km'],
    },

    // Rejection/Review Information
    reasonEnum: {
      type: String,
      enum: Object.values(REJECTION_REASONS),
    },

    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    reviewComments: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review comments cannot exceed 1000 characters'],
    },

    // Payment Verification
    isKYCPaymentVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    kycAmount: {
      type: Number,
      default: 0,
      min: [0, 'KYC amount cannot be negative'],
      max: [10000, 'KYC amount cannot exceed 10000'],
    },
    paymentTransactionId: {
      type: String,
      trim: true,
    },
    paymentVerifiedAt: {
      type: Date,
    },

    // Verification History
    verificationHistory: [verificationHistorySchema],

    // Risk Assessment
    riskScore: {
      type: Number,
      min: [0, 'Risk score cannot be negative'],
      max: [100, 'Risk score cannot exceed 100'],
      default: 0,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },

    // Additional Flags
    isManualReviewRequired: {
      type: Boolean,
      default: false,
    },
    isFraudulent: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Metadata
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User agent cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
vendorKYCSchema.index({ vendor: 1, kycStatus: 1 });
vendorKYCSchema.index({ isKYCVerified: 1, createdAt: -1 });
vendorKYCSchema.index({ kycStatus: 1, createdAt: -1 });
vendorKYCSchema.index({ isKYCPaymentVerified: 1 });
vendorKYCSchema.index({ isFraudulent: 1 });

// Virtual for full name
vendorKYCSchema.virtual('fullName').get(function () {
  const names = [this.firstName, this.middleName, this.lastName].filter(Boolean);
  return names.join(' ');
});

// Virtual for KYC completion percentage
vendorKYCSchema.virtual('completionPercentage').get(function () {
  let completed = 0;
  const total = 10;

  if (this.firstName && this.lastName) completed++;
  if (this.email) completed++;
  if (this.phoneNumber) completed++;
  if (this.dob) completed++;
  if (this.addresses && this.addresses.length > 0) completed++;
  if (this.primaryDocument) completed++;
  if (this.selfieImage) completed++;
  if (this.isKYCPaymentVerified) completed++;
  if (this.kycStatus === KYC_STATUSES.APPROVED) completed++;

  return Math.round((completed / total) * 100);
});

// Pre-save middleware
vendorKYCSchema.pre('save', function (next) {
  // Auto-update verification timestamp
  if (this.isModified('kycStatus') && this.kycStatus === KYC_STATUSES.APPROVED) {
    this.verifiedAt = new Date();
    this.isKYCVerified = true;
  }

  // Add to verification history
  if (this.isModified('kycStatus')) {
    this.verificationHistory.push({
      status: this.kycStatus,
      reason: this.reason,
      reviewedAt: new Date(),
    });
  }

  // Update completion status
  // if (this.completionPercentage === 100 && this.kycStatus === KYC_STATUSES.INCOMPLETE) {
  //   this.kycStatus = KYC_STATUSES.PENDING;
  // }

  next();
});

// Instance methods
vendorKYCSchema.methods.approve = function (adminId, comments) {
  this.kycStatus = KYC_STATUSES.APPROVED;
  this.isKYCVerified = true;
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  this.reviewComments = comments;
  this.reason = undefined; // Clear any previous rejection reason

  return this.save();
};

vendorKYCSchema.methods.reject = function (adminId, reason, comments) {
  this.kycStatus = KYC_STATUSES.REJECTED;
  this.isKYCVerified = false;
  this.reason = reason;
  this.reviewComments = comments;
  this.verifiedBy = adminId;
  this.verifiedAt = undefined;
  this.reasonEnum = REJECTION_REASONS.DOCUMENT_NOT_VERIFIED;

  console.log('🔧 [PROD MODE] Rejecting KYC', REJECTION_REASONS.DOCUMENT_NOT_VERIFIED, this);

  return this.save();
};

vendorKYCSchema.methods.markForReview = function (reason) {
  this.kycStatus = KYC_STATUSES.UNDER_REVIEW;
  this.isManualReviewRequired = true;
  this.reason = reason;

  return this.save();
};

// Static methods
vendorKYCSchema.statics.getPendingKYCs = function (limit = 50) {
  return this.find({
    kycStatus: { $in: [KYC_STATUSES.PENDING, KYC_STATUSES.UNDER_REVIEW] },
  })
    .populate('vendor', 'firstName lastName email phoneNumber')
    .sort({ createdAt: 1 })
    .limit(limit);
};

vendorKYCSchema.statics.getKYCStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$kycStatus',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        _id: 0,
      },
    },
  ]);
};

// Export constants along with schema
export { KYC_STATUSES, DOCUMENT_TYPES, ADDRESS_TYPES, REJECTION_REASONS };

const VendorKYC = mongoose.model('VendorKYC', vendorKYCSchema);

export default VendorKYC;
