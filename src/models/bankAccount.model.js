import mongoose from 'mongoose';
import crypto from 'crypto';

const bankAccountSchema = new mongoose.Schema(
  {
    accountHolderName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    accountNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[0-9]{9,18}$/.test(v); // 9-18 digits for Indian bank accounts
        },
        message: 'Account number must be 9-18 digits',
      },
    },

    encryptedAccountNumber: {
      type: String,
      // required: true,
    },

    // IFSC Code
    ifscCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v); // Indian IFSC format
        },
        message: 'Invalid IFSC code format',
      },
    },

    bankName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    branchName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    branchAddress: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    accountType: {
      type: String,
      enum: ['savings', 'current', 'salary', 'overdraft', 'nri'],
      required: true,
      default: 'savings',
    },

    userType: {
      type: String,
      enum: ['User', 'Vendor', 'Admin'],
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userType',
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isDeleted: { type: Boolean, default: false },
    isVerified: {
      type: Boolean,
      default: false,
    },

    verification: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'verified', 'rejected'],
        default: 'pending',
      },
      method: {
        type: String,
        enum: ['penny_drop', 'bank_statement', 'passbook', 'manual'],
      },
      verifiedAt: { type: Date },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
      },
      rejectionReason: { type: String },

      pennyDrop: {
        amount: { type: Number },
        referenceId: { type: String },
        transactionId: { type: String },
        status: { type: String, enum: ['pending', 'success', 'failed'] },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date },
      },

      documents: [
        {
          type: { type: String, enum: ['bank_statement', 'passbook', 'cheque'] },
          fileUrl: { type: String },
          uploadedAt: { type: Date, default: Date.now },
          status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        },
      ],
    },

    usage: {
      totalTransfers: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      lastUsedAt: { type: Date },
      failedTransfers: { type: Number, default: 0 },
      lastFailedAt: { type: Date },
    },

    limits: {
      dailyLimit: { type: Number, default: 50000 },
      monthlyLimit: { type: Number, default: 1000000 },
      minimumTransfer: { type: Number, default: 1 },
      maximumTransfer: { type: Number, default: 200000 },
    },

    metadata: {
      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'userType',
      },
      source: { type: String, enum: ['web', 'mobile', 'admin'], default: 'web' },
      notes: { type: String },
      tags: [{ type: String }],
    },

    auditLog: [
      {
        action: { type: String }, // 'created', 'updated', 'verified', 'deactivated'
        performedBy: { type: mongoose.Schema.Types.ObjectId },
        performedAt: { type: Date, default: Date.now },
        changes: { type: mongoose.Schema.Types.Mixed },
        ipAddress: { type: String },
        reason: { type: String },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: '__v',
  }
);

bankAccountSchema.index({ user: 1, userType: 1 });
bankAccountSchema.index({ ifscCode: 1 });
bankAccountSchema.index({ isActive: 1, isPrimary: 1 });
bankAccountSchema.index({ 'verification.status': 1 });
bankAccountSchema.index({ encryptedAccountNumber: 1 }, { unique: true });

bankAccountSchema.index(
  { user: 1, userType: 1, isPrimary: 1 },
  {
    unique: true,
    partialFilterExpression: { isPrimary: true },
  }
);

bankAccountSchema.virtual('maskedAccountNumber').get(function () {
  if (!this.accountNumber) return '';
  const num = this.accountNumber;
  return `XXXX${num.slice(-4)}`;
});

bankAccountSchema.virtual('userDetails', {
  ref: function (doc) {
    return doc.userType;
  },
  localField: 'user',
  foreignField: '_id',
  justOne: true,
});

const ENCRYPTION_KEY = process.env.BANK_ENCRYPTION_KEY || 'rE94ys1oUcezKgExPfYBCdefghijklmn';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getValidKey(key) {
  try {
    const safeKey = key
      .replace(/[()<>%^]/g, '')
      .padEnd(32, '0')
      .slice(0, 32);
    console.log('Using encryption key length:', safeKey.length);
    return Buffer.from(safeKey, 'utf8');
  } catch (error) {
    console.error('Key validation error:', error);
    return Buffer.from('MySecretBankingKey1234567890123456', 'utf8').slice(0, 32);
  }
}

function encrypt(text) {
  try {
    console.log('Encrypting text:', text ? 'Text provided' : 'No text');

    if (!text || typeof text !== 'string') {
      throw new Error('Text to encrypt must be a non-empty string');
    }

    const key = getValidKey(ENCRYPTION_KEY);
    const iv = crypto.randomBytes(IV_LENGTH);

    console.log('Key length:', key.length);
    console.log('IV length:', iv.length);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const result = iv.toString('hex') + ':' + encrypted;
    console.log('Encryption successful, result length:', result.length);

    return result;
  } catch (error) {
    console.error('Detailed encryption error:', {
      message: error.message,
      stack: error.stack,
      algorithm: ALGORITHM,
      keyLength: ENCRYPTION_KEY.length,
      textType: typeof text,
      textLength: text ? text.length : 0,
    });
    throw new Error(`Failed to encrypt data: ${error.message}`);
  }
}

function decrypt(encryptedText) {
  try {
    console.log('Decrypting text:', encryptedText ? 'Text provided' : 'No text');

    if (!encryptedText || typeof encryptedText !== 'string') {
      throw new Error('Encrypted text must be a non-empty string');
    }

    const textParts = encryptedText.split(':');
    if (textParts.length !== 2) {
      throw new Error(`Invalid encrypted text format. Expected 2 parts, got ${textParts.length}`);
    }

    const key = getValidKey(ENCRYPTION_KEY);
    const iv = Buffer.from(textParts[0], 'hex');
    const encryptedData = textParts[1];

    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length. Expected ${IV_LENGTH}, got ${iv.length}`);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    console.log('Decryption successful');
    return decrypted;
  } catch (error) {
    console.error('Detailed decryption error:', {
      message: error.message,
      stack: error.stack,
      encryptedTextLength: encryptedText ? encryptedText.length : 0,
      parts: encryptedText ? encryptedText.split(':').length : 0,
    });
    throw new Error(`Failed to decrypt data: ${error.message}`);
  }
}

bankAccountSchema.pre('save', async function (next) {
  // Encrypt account number
  if (this.isModified('accountNumber')) {
    this.encryptedAccountNumber = encrypt(this.accountNumber);
  }

  // Ensure only one primary account per user
  if (this.isPrimary && this.isModified('isPrimary')) {
    await this.constructor.updateMany(
      {
        user: this.user,
        userType: this.userType,
        _id: { $ne: this._id },
      },
      { $set: { isPrimary: false } }
    );
  }

  // Add audit log entry
  if (this.isNew) {
    this.auditLog.push({
      action: 'created',
      performedBy: this.metadata.addedBy,
      changes: { status: 'Account created' },
    });
  } else if (this.isModified()) {
    const changes = {};
    this.modifiedPaths().forEach((path) => {
      if (path !== 'auditLog') {
        changes[path] = this[path];
      }
    });

    console.log('Audit log changes:', this);
    if (!this.auditLog) {
      this.auditLog = [];
    }

    this.auditLog.push({
      action: 'updated',
      performedBy: this.metadata.addedBy,
      changes: changes,
    });
  }

  next();
});

bankAccountSchema.statics.findByUser = function (user, userType) {
  return this.find({ user, userType, isActive: true });
};

bankAccountSchema.statics.findPrimaryAccount = function (user, userType) {
  return this.findOne({ user, userType, isPrimary: true, isActive: true });
};

bankAccountSchema.statics.findVerifiedAccounts = function (user, userType) {
  return this.find({
    user,
    userType,
    isActive: true,
    'verification.status': 'verified',
  });
};

bankAccountSchema.methods.verify = function (verificationMethod, adminId) {
  this.verification.status = 'verified';
  this.verification.method = verificationMethod;
  this.verification.verifiedAt = new Date();
  this.verification.verifiedBy = adminId;
  this.isVerified = true;

  this.auditLog.push({
    action: 'verified',
    performedBy: adminId,
    changes: { verification: 'Account verified' },
  });

  return this.save();
};

bankAccountSchema.methods.reject = function (reason, adminId) {
  this.verification.status = 'rejected';
  this.verification.rejectionReason = reason;
  this.isVerified = false;

  this.auditLog.push({
    action: 'rejected',
    performedBy: adminId,
    changes: { verification: `Account rejected: ${reason}` },
  });

  return this.save();
};

bankAccountSchema.methods.setPrimary = function () {
  this.isPrimary = true;
  return this.save();
};

bankAccountSchema.methods.deactivate = function (reason, adminId) {
  this.isActive = false;
  this.isPrimary = false;

  this.auditLog.push({
    action: 'deactivated',
    performedBy: adminId,
    changes: { status: `Account deactivated: ${reason}` },
  });

  return this.save();
};

bankAccountSchema.methods.recordTransfer = function (amount, success = true) {
  this.usage.totalTransfers += 1;
  this.usage.lastUsedAt = new Date();

  if (success) {
    this.usage.totalAmount += amount;
  } else {
    this.usage.failedTransfers += 1;
    this.usage.lastFailedAt = new Date();
  }

  return this.save();
};

bankAccountSchema.methods.getDecryptedAccountNumber = function () {
  if (!this.encryptedAccountNumber) return null;
  try {
    return decrypt(this.encryptedAccountNumber);
  } catch (error) {
    console.error('Error decrypting account number:', error);
    return null;
  }
};

export const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
