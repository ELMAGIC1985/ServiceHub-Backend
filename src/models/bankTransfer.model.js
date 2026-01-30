import mongoose from 'mongoose';

const bankTransferSchema = new mongoose.Schema(
  {
    // Transfer details
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      default: 'INR',
    },

    // Source transaction
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },

    // Recipient details
    recipientAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: true,
    },

    // Transfer status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },

    // Transfer details
    transferMethod: {
      type: String,
      enum: ['neft', 'rtgs', 'imps', 'manual'],
      default: 'neft',
    },

    // Bank reference details
    bankReference: {
      utrNumber: { type: String }, // Unique Transaction Reference
      processingDate: { type: Date },
      completedDate: { type: Date },
      bankCharges: { type: Number, default: 0 },
    },

    // Admin handling
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    processedAt: { type: Date },

    // Additional details
    purpose: { type: String, default: 'Vendor Payment' },
    notes: { type: String },

    // Retry mechanism
    retryCount: { type: Number, default: 0 },
    lastRetryAt: { type: Date },
    maxRetries: { type: Number, default: 3 },

    // Audit
    statusHistory: [
      {
        status: { type: String },
        timestamp: { type: Date, default: Date.now },
        updatedBy: { type: mongoose.Schema.Types.ObjectId },
        notes: { type: String },
      },
    ],
  },
  { timestamps: true }
);

// Indexes for bank transfers
bankTransferSchema.index({ status: 1, createdAt: -1 });
bankTransferSchema.index({ transactionId: 1 });
bankTransferSchema.index({ recipientAccount: 1 });

export const BankTransfer = mongoose.model('BankTransfer', bankTransferSchema);
