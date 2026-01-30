import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const WithdrawalRequestSchema = new Schema(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    wallet: {
      type: Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, 'Withdrawal amount must be greater than 0'],
      validate: {
        validator: function (v) {
          return Number.isFinite(v) && v > 0;
        },
        message: 'Amount must be a valid positive number',
      },
    },
    currency: {
      type: String,
      required: true,
      enum: ['INR', 'USD', 'EUR'],
      uppercase: true,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },
    bank: {
      type: Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: true,
    },
    // Request metadata
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Admin actions
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    reviewedAt: {
      type: Date,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    approvedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    // Processing details
    processedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    // Transaction reference after successful withdrawal
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    // Payment gateway reference
    paymentGatewayReference: {
      type: String,
      trim: true,
    },
    // Additional notes
    vendorNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Fees and charges
    processingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    netAmount: {
      type: Number, // Amount after deducting fees
    },
    // Retry attempts for failed withdrawals
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRetryAt: {
      type: Date,
    },
    // Priority for processing
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
  },
  {
    timestamps: true,
  }
);

WithdrawalRequestSchema.index({ vendorId: 1, status: 1 });
WithdrawalRequestSchema.index({ status: 1, requestedAt: 1 });
WithdrawalRequestSchema.index({ walletId: 1, status: 1 });
WithdrawalRequestSchema.index({ createdAt: -1 });

WithdrawalRequestSchema.pre('save', function (next) {
  if (this.isModified('amount') || this.isModified('processingFee')) {
    this.netAmount = this.amount - this.processingFee;
  }
  next();
});

WithdrawalRequestSchema.methods.approve = async function (adminId) {
  if (this.status !== 'pending') {
    throw new Error('Only pending requests can be approved');
  }

  this.status = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();

  return this.save();
};

WithdrawalRequestSchema.methods.reject = async function (adminId, reason) {
  if (this.status !== 'pending') {
    throw new Error('Only pending requests can be rejected');
  }

  this.status = 'rejected';
  this.reviewedBy = adminId;
  this.reviewedAt = new Date();
  this.rejectionReason = reason;

  return this.save();
};

WithdrawalRequestSchema.methods.markAsProcessing = async function () {
  if (this.status !== 'approved') {
    throw new Error('Only approved requests can be processed');
  }

  this.status = 'processing';
  this.processedAt = new Date();

  return this.save();
};

WithdrawalRequestSchema.methods.markAsCompleted = async function (transactionId, paymentReference) {
  if (this.status !== 'processing') {
    throw new Error('Only processing requests can be marked as completed');
  }

  this.status = 'completed';
  this.completedAt = new Date();
  this.transactionId = transactionId;
  if (paymentReference) {
    this.paymentGatewayReference = paymentReference;
  }

  return this.save();
};

WithdrawalRequestSchema.methods.markAsFailed = async function (reason) {
  this.status = 'failed';
  this.rejectionReason = reason;
  this.retryCount += 1;
  this.lastRetryAt = new Date();

  return this.save();
};

WithdrawalRequestSchema.methods.cancel = async function () {
  if (!['pending', 'approved'].includes(this.status)) {
    throw new Error('Only pending or approved requests can be cancelled');
  }

  this.status = 'cancelled';

  return this.save();
};

WithdrawalRequestSchema.statics.getPendingRequests = function (options = {}) {
  return this.find({ status: 'pending', ...options })
    .populate('vendor', 'name email')
    .populate('wallet')
    .sort({ priority: -1, requestedAt: 1 });
};

WithdrawalRequestSchema.statics.getVendorHistory = function (vendorId, limit = 20) {
  return this.find({ vendorId }).sort({ createdAt: -1 }).limit(limit).select('-bankDetails.accountNumber');
};

WithdrawalRequestSchema.statics.getTotalPendingAmount = function (vendorId) {
  return this.aggregate([
    {
      $match: {
        vendorId: new mongoose.Types.ObjectId(vendorId),
        status: { $in: ['pending', 'approved', 'processing'] },
      },
    },
    {
      $group: {
        _id: '$vendorId',
        totalPendingAmount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
};

const WithdrawalRequest = mongoose.model('WithdrawalRequest', WithdrawalRequestSchema);

export default WithdrawalRequest;
