import mongoose from 'mongoose';
import { BOOKING_STATUSES } from '../constants/constants.js';
import Counter from './counter.model.js';

const round2 = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

const BookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    serviceTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceTemplate',
      // required: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },

    date: { type: Date, required: true },
    timeSlot: { type: String },

    // Location information
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
    },

    // Booking status with detailed tracking
    status: {
      type: String,
      enum: [
        'pending',
        'searching',
        'vendor_assigned',
        'accepted',
        'confirmed',
        'on_route',
        'arrived',
        'in_progress',
        'completed',
        'cancelled_by_user',
        'cancelled_by_vendor',
        'cancelled_by_system',
        'cancelled_by_admin',
        'rejected',
        'failed',
        'expired',
      ],
      default: 'pending',
      index: true,
    },

    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'changedByModel',
        },
        changedByModel: {
          type: String,
          enum: ['User', 'Vendor', 'Admin', 'System'],
          required: true,
        },
        reason: { type: String },
        notes: { type: String },
      },
    ],

    // Payment information
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded', 'failed', 'pending', 'partial_refund'],
      default: 'pending',
      index: true,
    },

    otpDeatils: {
      otp: { type: String },
      isVerified: { type: Boolean, default: false },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
      verifiedAt: { type: Date },
    },

    // Pricing breakdown
    pricing: {
      basePrice: { type: Number, required: true, min: 0, set: round2, get: round2 },
      discountAmount: { type: Number, default: 0, min: 0, set: round2, get: round2 },
      couponDiscount: { type: Number, default: 0, min: 0, set: round2, get: round2 },
      membershipDiscount: { type: Number, default: 0, min: 0, set: round2, get: round2 },
      taxAmount: { type: Number, default: 0, min: 0, set: round2, get: round2 },
      finalPrice: { type: Number, default: 0, min: 0, set: round2, get: round2 },
      platformFee: { type: Number, default: 0, min: 0, set: round2, get: round2 },
      addOnsTotal: { type: Number, default: 0, min: 0, set: round2, get: round2 },
      totalAmount: { type: Number, required: true, min: 0, set: round2, get: round2 },
      quantity: { type: Number, default: 1 },
    },

    // Applied coupon information
    appliedCoupon: {
      couponCode: { type: String, uppercase: true, trim: true },
      discountAmount: { type: Number, min: 0 },
      discountPercentage: { type: Number, min: 0, max: 100 },
    },

    additionalItems: [
      {
        description: { type: String, required: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, default: 1, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        addedAt: { type: Date, default: Date.now },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'additionalItems.addedByModel',
        },
        addedByModel: {
          type: String,
          enum: ['User', 'Vendor'],
        },
      },
    ],

    vendorSearch: {
      searchRadius: { type: Number },
      maxRadius: { type: Number },
      searchAttempts: { type: Number },
      lastSearchAt: { type: Date },
      eligibleVendors: [
        {
          vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
          distance: { type: Number },
          notifiedAt: { type: Date },
          response: {
            type: String,
            enum: ['pending', 'accepted', 'rejected', 'timeout'],
            default: 'pending',
          },
          responseAt: { type: Date },
        },
      ],
      assignedVendor: {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
        assignedAt: { type: Date },
        acceptedAt: { type: Date },
        distance: { type: Number },
      },
    },

    notifications: {
      userNotifications: [
        {
          type: {
            type: String,
            enum: [
              'booking_created',
              'vendor_assigned',
              'vendor_accepted',
              'vendor_on_route',
              'vendor_arrived',
              'service_started',
              'service_completed',
              'booking_cancelled',
              'addon_added',
              'addon_updated',
              'addon_removed',
            ],
          },
          sentAt: { type: Date, default: Date.now },
          status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' },
          message: { type: String },
        },
      ],
      vendorNotifications: [
        {
          vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
          type: {
            type: String,
            enum: ['new_booking_request', 'booking_cancelled', 'reminder'],
          },
          sentAt: { type: Date, default: Date.now },
          status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' },
          message: { type: String },
        },
      ],
    },

    timing: {
      requestTimeout: { type: Number, default: 300 },
      vendorResponseTimeout: { type: Number, default: 60 },
      searchTimeout: { type: Date },
      estimatedStartTime: { type: Date },
      estimatedEndTime: { type: Date },
      actualStartTime: { type: Date },
      actualEndTime: { type: Date },
      totalDuration: { type: Number }, // in minutes
    },

    specialRequirements: { type: String, trim: true, maxlength: 500 },
    userNotes: { type: String, trim: true, maxlength: 500 },
    vendorNotes: { type: String, trim: true, maxlength: 500 },
    adminNotes: { type: String, trim: true, maxlength: 500 },

    // NEW: Add-ons added during service
    addOns: [
      {
        addOn: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'AddOn',
          required: true,
        },
        name: { type: String, required: true }, // Store name for historical reference
        quantity: { type: Number, default: 1, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        addedAt: { type: Date, default: Date.now },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Vendor',
          required: true,
        },
        notes: { type: String, trim: true, maxlength: 500 },
      },
    ],

    additionalItems: [
      {
        description: { type: String, required: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        quantity: { type: Number, default: 1, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        addedAt: { type: Date, default: Date.now },
        addedBy: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'additionalItems.addedByModel',
        },
        addedByModel: {
          type: String,
          enum: ['User', 'Vendor'],
        },
      },
    ],

    // Rating and feedback
    rating: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rating',
    },

    isVendorRated: { type: Boolean, default: false },
    isServiceTemplateRated: { type: Boolean, default: false },

    // Cancellation information
    cancellation: {
      cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'cancellation.cancelledByModel',
      },
      cancelledByModel: {
        type: String,
        enum: ['User', 'Vendor', 'System', 'Admin'],
      },
      cancelledAt: { type: Date },
      reason: { type: String, trim: true },
      refundAmount: { type: Number, min: 0 },
      refundStatus: {
        type: String,
        enum: ['pending', 'processed', 'failed', 'not_applicable'],
      },
    },

    // System metadata
    metadata: {
      platform: { type: String, enum: ['web', 'mobile_app', 'api'], default: 'mobile_app' },
      appVersion: { type: String },
      deviceInfo: { type: String },
      ipAddress: { type: String },
      userAgent: { type: String },
    },

    // Auto-calculated total price
    totalPrice: {
      type: Number,
      default: function () {
        return this.price;
      },
    },

    // comission
    comission: {
      totalComissionRate: {
        type: Number,
        min: [0, 'Commission rate cannot be negative'],
        max: [100, 'Commission rate cannot exceed 100'],
        default: 0,
      },
      bookingComissionRate: {
        type: Number,
        min: [0, 'Commission rate cannot be negative'],
        max: [100, 'Commission rate cannot exceed 100'],
        default: 0,
      },
      billingComissionRate: {
        type: Number,
        min: [0, 'Commission rate cannot be negative'],
        max: [100, 'Commission rate cannot exceed 100'],
        default: 0,
      },
      bookingComissionAmount: {
        type: Number,
        min: [0, 'Commission amount cannot be negative'],
        default: 0,
        set: round2,
        get: round2,
      },
      billingComissionAmount: {
        type: Number,
        min: [0, 'Commission amount cannot be negative'],
        default: 0,
        set: round2,
        get: round2,
      },
      addOnsComissionRate: {
        type: Number,
        min: [0, 'Commission rate cannot be negative'],
        max: [100, 'Commission rate cannot exceed 100'],
        default: 0,
      },
      addOnsComissionAmount: {
        type: Number,
        min: [0, 'Commission amount cannot be negative'],
        default: 0,
        set: round2,
        get: round2,
      },
      deductedAt: {
        type: Date,
      },
      vendorTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
      },
      adminTransactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
      },
      status: {
        type: String,
        enum: ['completed', 'pending', 'processing'],
        default: 'pending',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

BookingSchema.set('toJSON', { getters: true });
BookingSchema.set('toObject', { getters: true });

// Indexes for better performance
BookingSchema.index({ user: 1, status: 1 });
BookingSchema.index({ service: 1, status: 1 });
BookingSchema.index({ 'address.location': '2dsphere' });
BookingSchema.index({ date: 1, status: 1 });
BookingSchema.index({ createdAt: -1 });
BookingSchema.index({ 'vendorSearch.assignedVendor.vendorId': 1 });
BookingSchema.index({ date: 1, status: 1 });
BookingSchema.index({ date: 1, timeSlot: 1, status: 1 });
BookingSchema.index(
  {
    date: 1,
    timeSlot: 1,
    'vendorSearch.assignedVendor.vendorId': 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      'vendorSearch.assignedVendor.vendorId': { $exists: true },
      status: {
        $in: ['vendor_assigned', 'accepted', 'confirmed', 'on_route', 'arrived', 'in_progress'],
      },
    },
  }
);

BookingSchema.pre('save', async function (next) {
  if (this.bookingId) return next();

  const counter = await Counter.findOneAndUpdate(
    { name: 'booking' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const padded = counter.seq.toString().padStart(4, '0');

  this.bookingId = `HKBK${padded}`;

  next();
});

BookingSchema.virtual('durationFormatted').get(function () {
  if (!this.timing.totalDuration) return null;

  const hours = Math.floor(this.timing.totalDuration / 60);
  const minutes = this.timing.totalDuration % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

BookingSchema.pre('save', function (next) {
  if (!this.otpDeatils || !this.otpDeatils.otp) {
    const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
    this.otpDeatils = {
      otp,
      isVerified: false,
    };
  }
  next();
});

BookingSchema.pre('save', function (next) {
  if (this.isNew && ['pending', 'searching'].includes(this.status)) {
    const timeoutSeconds = this.timing.requestTimeout || 150;
    this.expiresAt = new Date(Date.now() + timeoutSeconds * 1000);
  }

  // Clear expiresAt when booking moves past searching phase
  if (this.isModified('status') && !['pending', 'searching'].includes(this.status)) {
    this.expiresAt = undefined;
  }

  let total = this.price || 0;

  if (this.additionalItems && this.additionalItems.length > 0) {
    const additionalTotal = this.additionalItems.reduce((sum, item) => {
      return sum + (item.totalPrice || 0);
    }, 0);
    total += additionalTotal;
  }

  this.totalPrice = total;

  // Set search timeout if not set
  if (this.isNew && !this.timing.searchTimeout) {
    this.timing.searchTimeout = new Date(Date.now() + this.timing.requestTimeout * 1000);
  }

  next();
});

// Method to add status history
BookingSchema.methods.addStatusHistory = function (status, changedBy, changedByModel, reason = '', notes = '') {
  this.statusHistory.push({
    status,
    timestamp: new Date(),
    changedBy,
    changedByModel,
    reason,
    notes,
  });

  this.status = status;
  return this;
};

// Method to check if booking is expired
BookingSchema.methods.isExpired = function () {
  return this.timing.searchTimeout && new Date() > this.timing.searchTimeout;
};

// Method to get eligible vendors count
BookingSchema.methods.getEligibleVendorsCount = function () {
  return this.vendorSearch.eligibleVendors.length;
};

// Method to get pending vendor responses
BookingSchema.methods.getPendingVendorResponses = function () {
  return this.vendorSearch.eligibleVendors.filter((vendor) => vendor.response === 'pending').length;
};

BookingSchema.methods.verifyOtp = async function (enteredOtp, vendorId) {
  // Check match
  if (this.otpDeatils.otp !== enteredOtp) {
    return { success: false, message: 'Invalid OTP.' };
  }

  // If valid
  this.otpDeatils.isVerified = true;
  this.otpDeatils.verifiedBy = vendorId;
  this.otpDeatils.verifiedAt = new Date();
  await this.save();

  return { success: true, message: 'OTP verified successfully.' };
};

BookingSchema.methods.isOwnedBy = function (userId) {
  return this.user.toString() === userId.toString();
};

BookingSchema.methods.isCompleted = function () {
  return this.status === BOOKING_STATUSES.COMPLETED;
};

BookingSchema.methods.hasRating = function () {
  return !!this.rating;
};

BookingSchema.methods.canBeRatedBy = function (userId) {
  if (!this.isOwnedBy(userId)) {
    return {
      valid: false,
      message: 'You are not allowed to rate this booking',
    };
  }

  if (!this.isCompleted()) {
    return {
      valid: false,
      message: 'You can only rate completed bookings',
    };
  }

  return {
    valid: true,
    message: '',
  };
};

BookingSchema.methods.canBeVendorRate = function () {
  return !this.isVendorRated
    ? {
        valid: true,
        message: '',
      }
    : { valid: false, message: 'Vendor already rated for this booking' };
};

BookingSchema.methods.expire = async function (reason = 'Request timeout exceeded') {
  this.status = 'expired';
  this.statusHistory.push({
    status: 'expired',
    timestamp: new Date(),
    changedBy: null,
    changedByModel: 'System',
    reason,
    notes: 'Auto-expired by system',
  });
  this.expiresAt = undefined; // Clear expiration
  return await this.save();
};

export const Booking = mongoose.model('Booking', BookingSchema);
