import mongoose, { Schema } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config/config.js';

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    middleName: { type: String, trim: true },
    phoneNumber: {
      type: String,
      unique: true,
      required: [true, 'Phone Number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    dob: { type: Date },
    address: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
    role: {
      type: String,
      default: 'user',
    },
    avatar: { type: String },
    refreshToken: { type: String },
    isVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    referralCode: { type: String },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referredUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    referralReward: { type: Number, default: 0 },
    addresses: [
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
    bookings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
    membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
    coupons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' }],
    fcmToken: {
      token: { type: String },
      deviceId: { type: String },
      platform: { type: String, enum: ['ios', 'android'] },
      deviceName: { type: String },
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      lastUsed: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
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

userSchema.methods.generateRefreshToken = function () {
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
userSchema.virtual('name').get(function () {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.pre(/^find/, function (next) {
  if (!this.getFilter().includeDeleted) {
    this.where({ isDeleted: false });
  }
  next();
});

export const User = mongoose.model('User', userSchema);
