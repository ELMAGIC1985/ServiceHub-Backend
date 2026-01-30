import mongoose, { Schema } from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config/config.js';

const adminSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowecase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'sub_admin'],
      default: 'sub_admin',
    },
    isBlocked: { type: Boolean, default: false },
    avatar: {
      type: String,
    },
    password: {
      type: String,
    },
    permissions: {
      products: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      vendors: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'BLOCK'],
        default: [],
      },
      kyc: {
        type: [String],
        enum: ['READ', 'APPROVE', 'REJECT'],
        default: [],
      },
      users: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'BLOCK'],
        default: [],
      },
      bookings: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'],
        default: [],
      },
      reports: {
        type: [String],
        enum: ['READ', 'EXPORT'],
        default: [],
      },
      settings: {
        type: [String],
        enum: ['READ', 'UPDATE'],
        default: [],
      },
      coupons: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      banner: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      serviceTemplate: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      addOns: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      categories: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      membership: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      plans: {
        type: [String],
        enum: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
        default: [],
      },
      orders: {
        type: [String],
        enum: ['READ', 'UPDATE', 'DELETE'],
        default: [],
      },
      wallets: {
        type: [String],
        enum: ['READ', 'UPDATE', 'DELETE'],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

adminSchema.methods.generateAccessToken = function () {
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

adminSchema.methods.generateRefreshToken = function () {
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

export const Admin = mongoose.model('Admin', adminSchema);
