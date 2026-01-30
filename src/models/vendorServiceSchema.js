import mongoose from 'mongoose';

const VendorServiceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      require: [true, 'Category is required'],
    },

    childCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      require: [true, 'Child Category is required'],
    },

    serviceTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceTemplate',
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor is required'],
      index: true,
    },

    availability: {
      isAvailable: {
        type: Boolean,
        default: true,
        index: true,
      },
      workingHours: {
        monday: {
          start: { type: String, default: '09:00 AM' },
          end: { type: String, default: '09:00 PM' },
          isAvailable: { type: Boolean, default: true },
        },
        tuesday: {
          start: { type: String, default: '09:00 AM' },
          end: { type: String, default: '09:00 PM' },
          isAvailable: { type: Boolean, default: true },
        },
        wednesday: {
          start: { type: String, default: '09:00 AM' },
          end: { type: String, default: '09:00 PM' },
          isAvailable: { type: Boolean, default: true },
        },
        thursday: {
          start: { type: String, default: '09:00 AM' },
          end: { type: String, default: '09:00 PM' },
          isAvailable: { type: Boolean, default: true },
        },
        friday: {
          start: { type: String, default: '09:00 AM' },
          end: { type: String, default: '09:00 PM' },
          isAvailable: { type: Boolean, default: true },
        },
        saturday: {
          start: { type: String, default: '09:00 AM' },
          end: { type: String, default: '09:00 PM' },
          isAvailable: { type: Boolean, default: true },
        },
        sunday: {
          start: { type: String, default: '09:00 AM' },
          end: { type: String, default: '09:00 PM' },
          isAvailable: { type: Boolean, default: false },
        },
      },
      holidays: [{ date: Date, reason: String }],
    },

    customIncluded: [{ type: String, trim: true }],
    customExcluded: [{ type: String, trim: true }],

    vendorSupportedBrands: [
      {
        type: String,
        trim: true,
      },
    ],

    customFaqs: [
      {
        question: { type: String, required: true, trim: true },
        answer: { type: String, required: true, trim: true },
        order: { type: Number, default: 0 },
      },
    ],

    ratings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Rating' }],

    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected', 'suspended'],
        message: 'Status must be one of: pending, approved, rejected, suspended',
      },
      default: 'pending',
      index: true,
    },

    approval: {
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
      },
      approvedAt: { type: Date },
      rejectionReason: { type: String, trim: true },
      adminNotes: { type: String, trim: true },
      isApproved: {
        type: Boolean,
        default: false,
      },
    },

    bookingStats: {
      totalBookings: { type: Number, default: 0 },
      completedBookings: { type: Number, default: 0 },
      cancelledBookings: { type: Number, default: 0 },
      averageResponseTime: { type: Number, default: 0 },
    },

    coupons: [
      {
        code: { type: String, required: true, uppercase: true, trim: true },
        discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        maxDiscount: { type: Number },
        minOrderValue: { type: Number, default: 0 },
        validFrom: { type: Date, required: true },
        validTill: { type: Date, required: true },
        usageLimit: { type: Number, default: 1 },
        usedCount: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    priority: {
      type: Number,
      default: 0,
      index: true,
    },

    vendorNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Vendor notes cannot exceed 500 characters'],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

VendorServiceSchema.index({ vendor: 1 }, { unique: true });
VendorServiceSchema.index({ vendor: 1, status: 1 });
VendorServiceSchema.index({ status: 1, isActive: 1 });
VendorServiceSchema.index({ priority: -1, createdAt: -1 });

export const VendorService = mongoose.model('VendorService', VendorServiceSchema);
