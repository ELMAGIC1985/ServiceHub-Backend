import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import config from '../config/config.js';

const VERIFICATION_STATUSES = {
  INCOMPLETE: 'incomplete',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

const USER_ROLES = {
  VENDOR: 'vendor',
  ADMIN: 'admin',
};

const vendorSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
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
      required: [true, 'Phone Number is required'],
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
    },
    purpose: {
      type: String,
      trim: true,
      maxlength: [500, 'Purpose cannot exceed 500 characters'],
    },
    password: { type: String },
    role: {
      type: String,
      default: 'vendor',
    },
    // Verification Status
    isVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isMobileVerified: {
      type: Boolean,
      default: false,
    },
    kyc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorKYC',
    },
    isKYCVerified: {
      type: Boolean,
      default: false,
    },
    kycStatus: {
      type: String,
      default: VERIFICATION_STATUSES.INCOMPLETE,
      enum: {
        values: Object.values(VERIFICATION_STATUSES),
        message: 'Invalid KYC status',
      },
    },

    // KYC and Payment Information
    isKYCPaymentVerified: {
      type: Boolean,
      default: false,
    },
    kycAmount: {
      type: Number,
      default: 0,
      min: [0, 'KYC amount cannot be negative'],
    },

    serviceRadius: {
      type: Number,
      default: 5,
    },

    isAvailable: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },

    documentType: {
      type: String,
      trim: true,
      enum: {
        values: ['passport', 'driving_license', 'national_id', 'voter_id', 'aadhaar'],
        message: 'Invalid document type',
      },
    },
    documentImage: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Document image must be a valid URL',
      },
    },
    selfieImage: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Selfie image must be a valid URL',
      },
    },
    avatar: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Selfie image must be a valid URL',
      },
    },

    referralCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      uppercase: true,
      validate: {
        validator: function (v) {
          return !v || /^[A-Z0-9]{6,10}$/.test(v);
        },
        message: 'Invalid referral code format',
      },
    },
    referralReward: {
      type: Number,
      default: 0,
      min: [0, 'Referral reward cannot be negative'],
    },

    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    referredUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
      },
    ],
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
    refreshToken: {
      type: String,
    },
    services: [
      {
        service: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'VendorService',
        },
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
        childCategory: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Category',
        },
        isActive: { type: Boolean, default: true },
        isBlocked: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
      },
    ],
    fcmToken: {
      token: { type: String },
      deviceId: { type: String },
      platform: { type: String, enum: ['ios', 'android'] },
      deviceName: { type: String },
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      lastUsed: { type: Date, default: Date.now },
    },
    productDeliverAddress: [
      {
        address: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Address',
          required: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],

    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.deletedAt;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

vendorSchema.index({ email: 1, phoneNumber: 1 });
vendorSchema.index({ currentCoordinates: '2dsphere' });

vendorSchema.virtual('name').get(function () {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});

vendorSchema.set('toJSON', { virtuals: true });
vendorSchema.set('toObject', { virtuals: true });

vendorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

vendorSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

vendorSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: this.role,
    },
    config.ACCESS_TOKEN.SECRET,
    {
      expiresIn: config.ACCESS_TOKEN.EXPIRY,
    }
  );
};

vendorSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      role: this.role,
    },
    config.REFRESH_TOKEN.SECRET,
    {
      expiresIn: config.REFRESH_TOKEN.EXPIRY,
    }
  );
};

export { VERIFICATION_STATUSES, USER_ROLES };

const Vendor = mongoose.model('Vendor', vendorSchema);

export default Vendor;
