import mongoose from 'mongoose';
import Counter from './counter.model.js';

// Base transaction schema with common fields + KYC enhancements
const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      index: true,
    },
    // Core transaction details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP'],
    },
    transactionType: {
      type: String,
      enum: ['credit', 'debit', 'liability'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed', 'cancelled', 'refunded', 'expired', 'outstanding'],
      default: 'pending',
    },

    // Payment method with expanded options
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'online', 'upi', 'razorpay', 'wallet', 'cod', 'qr_upi'],
      required: true,
    },

    // Transaction category with expanded options including KYC
    transactionFor: {
      type: String,
      enum: [
        'wallet_topup',
        'wallet_withdrawal',
        'product_order',
        'service_booking',
        'subscription',
        'refund',
        'cashback',
        'reward',
        'penalty',
        'fee',
        'tax',
        'shipping',
        'discount',
        'gift_card',
        'donation',
        'kyc_payment',
        'membership_purchase',
        'booking_payment',
        'commission',
        'commission_deduction',
        'commission_credit',
        'commission_payable',
        'appointment_booking',
      ],
      required: true,
    },

    // Enhanced payment details with KYC specific fields
    paymentDetails: {
      paymentStatus: {
        type: String,
        enum: [
          'pending',
          'processing',
          'paid',
          'failed',
          'refunded',
          'collected_cash',
          'collected_qr',
          'settled',
          'deducted',
          'credited',
        ],
        default: 'pending',
      },
      transactionId: {
        type: String,
        index: true,
      },
      paymentDate: { type: Date },

      // Gateway specific details
      gateway: {
        name: {
          type: String,
          enum: ['razorpay', 'bank', 'manual', 'system'],
        },
        transactionId: { type: String },
        orderId: { type: String },
        paymentId: { type: String },
        signature: { type: String },
        gatewayResponse: { type: mongoose.Schema.Types.Mixed },
      },

      // Bank transfer specific details
      bankDetails: {
        accountNumber: { type: String },
        ifscCode: { type: String },
        bankName: { type: String },
        utrNumber: { type: String },
      },

      // UPI specific details
      upiDetails: {
        vpa: { type: String },
        transactionNote: { type: String },
      },

      // Card specific details
      cardDetails: {
        last4Digits: { type: String },
        cardType: { type: String, enum: ['credit', 'debit'] },
        bankName: { type: String },
        network: { type: String, enum: ['visa', 'mastercard', 'rupay', 'amex'] },
      },

      // KYC specific payment verification fields
      isSignatureVerified: {
        type: Boolean,
        default: false,
      },
      signatureVerifiedAt: {
        type: Date,
      },
    },

    // Related entity with flexible referencing
    relatedEntity: {
      entityType: {
        type: String,
        enum: [
          'Order',
          'Booking',
          'Wallet',
          'Subscription',
          'User',
          'Vendor',
          'VendorKYC',
          'Membership',
          'CalculatorLead',
        ],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'relatedEntity.entityType',
      },
      entityData: {
        type: mongoose.Schema.Types.Mixed,
      },
    },

    // User information
    user: {
      userType: {
        type: String,
        enum: ['User', 'Vendor', 'Admin'],
        required: true,
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: function () {
          return this.user.userType !== 'Guest';
        },
        refPath: 'user.userType',
      },
    },

    // KYC specific fields (only populated for KYC payments)
    kycDetails: {
      // Payment validity for KYC
      validFrom: {
        type: Date,
        default: Date.now,
      },
      validUntil: {
        type: Date,
        index: true,
      },
      isExpired: {
        type: Boolean,
        default: false,
        index: true,
      },

      // KYC submission tracking
      isKYCSubmitted: {
        type: Boolean,
        default: false,
        index: true,
      },
      kycSubmittedAt: {
        type: Date,
      },
      kycSubmissionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorKYC',
      },

      // Payment eligibility
      canSubmitKYC: {
        type: Boolean,
        default: false,
      },

      // KYC payment configuration
      kycPaymentAmount: {
        type: Number,
        min: [0, 'KYC payment amount cannot be negative'],
      },
      validityDays: {
        type: Number,
        default: 30,
        min: [1, 'Validity days must be at least 1'],
      },

      // Attempt tracking for KYC payments
      attemptCount: {
        type: Number,
        default: 1,
        min: [1, 'Attempt count must be at least 1'],
      },
      maxAttempts: {
        type: Number,
        default: 3,
        min: [1, 'Max attempts must be at least 1'],
      },
    },

    // Transaction metadata
    metadata: {
      description: { type: String },
      notes: { type: String },
      tags: [{ type: String }],

      businessUnit: { type: String },
      region: { type: String },
      channel: { type: String, enum: ['web', 'mobile_app', 'api', 'admin', 'pos', 'system'] },

      customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
      },
    },

    // Financial details
    financial: {
      grossAmount: { type: Number },
      netAmount: { type: Number },

      fees: {
        gatewayFee: { type: Number, default: 0 },
        processingFee: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
      },

      settlement: {
        status: { type: String, enum: ['pending', 'settled', 'failed'], default: 'pending' },
        settlementDate: { type: Date },
        settlementAmount: { type: Number },
        settlementId: { type: String },
      },
    },

    // Reference and tracking
    references: {
      referenceId: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
      },
      parentTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
      },
      invoiceNumber: { type: String },
      receiptNumber: { type: String },
    },

    // Audit and tracking
    audit: {
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'user.userType',
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'user.userType',
      },
      ipAddress: { type: String },
      userAgent: { type: String },
      source: { type: String },
    },

    // Status tracking
    statusHistory: [
      {
        status: { type: String },
        timestamp: { type: Date, default: Date.now },
        reason: { type: String },
        updatedBy: { type: mongoose.Schema.Types.ObjectId },
      },
    ],

    // Reconciliation
    reconciliation: {
      isReconciled: { type: Boolean, default: false },
      reconciledAt: { type: Date },
      reconciledBy: { type: mongoose.Schema.Types.ObjectId },
      discrepancies: [{ type: String }],
    },

    // Webhook tracking (useful for KYC payments)
    webhook: {
      received: { type: Boolean, default: false },
      receivedAt: { type: Date },
      webhookData: { type: mongoose.Schema.Types.Mixed },
      processed: { type: Boolean, default: false },
      processedAt: { type: Date },
    },

    // Risk and fraud detection
    riskAssessment: {
      riskScore: {
        type: Number,
        min: [0, 'Risk score cannot be negative'],
        max: [100, 'Risk score cannot exceed 100'],
        default: 0,
      },
      isFlagged: {
        type: Boolean,
        default: false,
        index: true,
      },
      flagReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Flag reason cannot exceed 500 characters'],
      },
      reviewRequired: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
  }
);

transactionSchema.index({ 'user.userId': 1, status: 1 });
transactionSchema.index({ transactionFor: 1, status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'relatedEntity.entityId': 1, 'relatedEntity.entityType': 1 });

// Virtual fields
transactionSchema.virtual('userDetails', {
  ref: function (doc) {
    return doc.user.userType;
  },
  localField: 'user.userId',
  foreignField: '_id',
  justOne: true,
});

transactionSchema.virtual('relatedEntityDetails', {
  ref: function (doc) {
    return doc.relatedEntity.entityType;
  },
  localField: 'relatedEntity.entityId',
  foreignField: '_id',
  justOne: true,
});

transactionSchema.pre('save', async function (next) {
  if (this.transactionId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: 'booking' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = counter.seq.toString().padStart(6, '0');

  this.transactionId = `HKTR${padded}`;

  next();
});
// KYC specific virtuals
transactionSchema.virtual('isKYCPayment').get(function () {
  return this.transactionFor === 'kyc_payment';
});

transactionSchema.virtual('isValidKYCPayment').get(function () {
  if (!this.isKYCPayment) return false;

  return (
    this.status === 'success' &&
    this.paymentDetails.paymentStatus === 'paid' &&
    this.paymentDetails.isSignatureVerified &&
    !this.kycDetails.isExpired &&
    this.kycDetails.validUntil > new Date()
  );
});

transactionSchema.virtual('canSubmitKYCNow').get(function () {
  return this.isValidKYCPayment && !this.kycDetails.isKYCSubmitted;
});

transactionSchema.virtual('remainingValidityDays').get(function () {
  if (!this.isKYCPayment || this.kycDetails.isExpired || !this.kycDetails.validUntil) {
    return 0;
  }

  const diffTime = this.kycDetails.validUntil.getTime() - new Date().getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

transactionSchema.pre('save', function (next) {
  if (!this.references.referenceId) {
    this.references.referenceId = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Set net amount if not provided
  if (!this.financial.netAmount) {
    const fees = this.financial.fees;
    this.financial.netAmount =
      this.amount - (fees.gatewayFee + fees.processingFee + fees.platformFee + fees.tax) + fees.discount;
  }

  // KYC specific pre-save logic
  if (this.transactionFor === 'kyc_payment') {
    // Set validity period if not set
    if (!this.kycDetails.validUntil && this.kycDetails.validityDays) {
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + this.kycDetails.validityDays);
      this.kycDetails.validUntil = validUntil;
    }

    // Check if payment has expired
    if (this.kycDetails.validUntil && this.kycDetails.validUntil <= new Date() && !this.kycDetails.isExpired) {
      this.kycDetails.isExpired = true;
      if (this.status === 'pending') {
        this.status = 'expired';
      }
    }

    // Update KYC eligibility
    this.kycDetails.canSubmitKYC = this.canSubmitKYCNow;

    // Update payment verification status
    if (this.isModified('paymentDetails.gateway.signature') && this.paymentDetails.gateway.signature) {
      this.paymentDetails.isSignatureVerified = true;
      this.paymentDetails.signatureVerifiedAt = new Date();
    }
  }

  // Add status to history
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      reason: this.metadata.notes || 'Status updated',
    });
  }

  next();
});

// Enhanced static methods including KYC specific ones
transactionSchema.statics.findByUser = function (userId, userType, options = {}) {
  return this.find({
    'user.userId': userId,
    'user.userType': userType,
    ...options,
  });
};

transactionSchema.statics.findByStatus = function (status, options = {}) {
  return this.find({ status, ...options });
};

transactionSchema.statics.findByTransactionFor = function (transactionFor, options = {}) {
  return this.find({ transactionFor, ...options });
};

transactionSchema.statics.findByDateRange = function (startDate, endDate, options = {}) {
  return this.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
    ...options,
  });
};

// KYC specific static methods
transactionSchema.statics.findValidKYCPaymentForVendor = function (vendorId) {
  return this.findOne({
    'user.userId': vendorId,
    'user.userType': 'Vendor',
    transactionFor: 'kyc_payment',
    status: 'success',
    'paymentDetails.paymentStatus': 'paid',
    'paymentDetails.isSignatureVerified': true,
    'kycDetails.isExpired': false,
    'kycDetails.validUntil': { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

transactionSchema.statics.findKYCPaymentHistory = function (vendorId, options = {}) {
  return this.find({
    'user.userId': vendorId,
    'user.userType': 'Vendor',
    transactionFor: 'kyc_payment',
    ...options,
  }).sort({ createdAt: -1 });
};

transactionSchema.statics.getKYCPaymentStats = function () {
  return this.aggregate([
    { $match: { transactionFor: 'kyc_payment' } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
      },
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        totalAmount: 1,
        _id: 0,
      },
    },
  ]);
};

transactionSchema.statics.getExpiredKYCPayments = function () {
  return this.find({
    transactionFor: 'kyc_payment',
    'kycDetails.validUntil': { $lte: new Date() },
    'kycDetails.isExpired': false,
    status: { $in: ['pending', 'success'] },
  });
};

// Enhanced instance methods including KYC specific ones
transactionSchema.methods.markAsSuccess = function (paymentDetails = {}) {
  this.status = 'success';
  this.paymentDetails.paymentStatus = 'paid';
  this.paymentDetails.paymentDate = new Date();

  Object.assign(this.paymentDetails, paymentDetails);

  return this.save();
};

transactionSchema.methods.markAsFailed = function (reason) {
  this.status = 'failed';
  this.paymentDetails.paymentStatus = 'failed';
  this.metadata.notes = reason;

  return this.save();
};

transactionSchema.methods.addRefund = function (refundAmount, reason) {
  const refundTransaction = new this.constructor({
    amount: refundAmount,
    currency: this.currency,
    transactionType: 'credit',
    status: 'success',
    paymentMethod: this.paymentMethod,
    transactionFor: 'refund',
    user: this.user,
    relatedEntity: {
      entityType: 'Transaction',
      entityId: this._id,
    },
    references: {
      parentTransactionId: this._id,
    },
    metadata: {
      description: `Refund for transaction ${this.references.referenceId}`,
      notes: reason,
    },
  });

  return refundTransaction.save();
};

// KYC specific instance methods
transactionSchema.methods.markKYCPaymentCompleted = function (razorpayPaymentId, signature, paymentMethod) {
  if (this.transactionFor !== 'kyc_payment') {
    throw new Error('This method can only be called on KYC payment transactions');
  }

  this.status = 'success';
  this.paymentDetails.paymentStatus = 'paid';
  this.paymentDetails.paymentDate = new Date();
  this.paymentDetails.gateway.paymentId = razorpayPaymentId;
  this.paymentDetails.gateway.signature = signature;
  this.paymentDetails.isSignatureVerified = true;
  this.paymentDetails.signatureVerifiedAt = new Date();
  this.paymentMethod = paymentMethod;

  return this.save();
};

transactionSchema.methods.markKYCSubmitted = function (kycId) {
  if (this.transactionFor !== 'kyc_payment') {
    throw new Error('This method can only be called on KYC payment transactions');
  }

  this.kycDetails.isKYCSubmitted = true;
  this.kycDetails.kycSubmittedAt = new Date();
  this.kycDetails.kycSubmissionId = kycId;
  this.kycDetails.canSubmitKYC = false;

  return this.save();
};

transactionSchema.methods.expireKYCPayment = function () {
  if (this.transactionFor !== 'kyc_payment') {
    throw new Error('This method can only be called on KYC payment transactions');
  }

  this.kycDetails.isExpired = true;
  this.kycDetails.canSubmitKYC = false;
  if (this.status === 'pending') {
    this.status = 'expired';
  }

  return this.save();
};

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
