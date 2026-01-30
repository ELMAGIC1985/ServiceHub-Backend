import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema(
  {
    // Reference to the service template this service is based on
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceTemplate',
      required: true,
      index: true,
    },

    // Vendor who provides this service
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },

    // Category structure (redundant but useful for quick queries)
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    childCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },

    // Service title and description (can override template defaults)
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Service title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },

    // Vendor-specific images
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        alt: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // Location information
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    serviceArea: {
      type: {
        type: String,
        enum: ['Point', 'Polygon'],
        default: 'Point',
      },
      coordinates: {
        type: [[[Number]]], // Array of arrays of arrays for Polygon support
      },
    },
    radius: {
      type: Number,
      default: 5, // in kilometers
      min: [0, 'Radius cannot be negative'],
    },

    // Pricing information
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      min: [0, 'Discount price cannot be negative'],
      validate: {
        validator: function (value) {
          return value < this.price;
        },
        message: 'Discount price must be less than regular price',
      },
    },
    priceType: {
      type: String,
      enum: ['fixed', 'hourly', 'per_item', 'custom'],
      default: 'fixed',
    },
    currency: {
      type: String,
      default: 'INR',
    },
    coupons: [
      {
        couponCode: {
          type: String,
          required: true,
          uppercase: true,
          trim: true,
        },
        discountPercentage: {
          type: Number,
          required: true,
          min: [1, 'Discount must be at least 1%'],
          max: [100, 'Discount cannot exceed 100%'],
        },
        expiryDate: {
          type: Date,
          required: true,
          validate: {
            validator: function (value) {
              return value > Date.now();
            },
            message: 'Coupon must have a future expiry date',
          },
        },
        minOrderValue: Number,
        maxDiscountAmount: Number,
        isActive: { type: Boolean, default: true },
      },
    ],

    // Service features (can override template defaults)
    features: [
      {
        name: { type: String, trim: true },
        description: { type: String, trim: true },
        icon: { type: String, trim: true },
      },
    ],

    // What's included/excluded (can override template defaults)
    whatIncluded: [{ type: String, trim: true }],
    whatExcluded: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],

    // Supported brands (can override template defaults)
    brands: [
      {
        name: { type: String, trim: true },
        logo: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
      },
    ],

    // Service duration
    estimatedDuration: {
      value: { type: Number }, // in minutes
      unit: {
        type: String,
        enum: ['minutes', 'hours', 'days'],
        default: 'minutes',
      },
    },

    // Availability
    availability: {
      type: Boolean,
      default: true,
      index: true,
    },
    availabilitySchedule: {
      days: [
        {
          day: {
            type: String,
            enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          },
          slots: [
            {
              start: { type: String }, // e.g., "09:00"
              end: { type: String }, // e.g., "17:00"
            },
          ],
        },
      ],
      exceptions: [
        {
          date: Date,
          reason: String,
          isAvailable: Boolean,
        },
      ],
    },

    // Ratings and reviews
    totalRatings: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Rating',
      },
    ],

    // FAQs (can override template defaults)
    faqs: [
      {
        question: { type: String, trim: true },
        answer: { type: String, trim: true },
        order: { type: Number, default: 0 },
      },
    ],

    // Approval status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },
    statusHistory: [
      {
        status: String,
        changedAt: Date,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: String,
      },
    ],
    note: String,

    // Service metrics
    viewCount: { type: Number, default: 0 },
    bookingCount: { type: Number, default: 0 },

    // SEO Fields (can override template defaults)
    seo: {
      metaTitle: { type: String, maxlength: 60 },
      metaDescription: { type: String, maxlength: 160 },
      keywords: [{ type: String, trim: true }],
    },

    // Audit Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add 2dsphere index for geospatial queries
ServiceSchema.index({ location: '2dsphere' });

// Add text index for search
ServiceSchema.index({
  title: 'text',
  description: 'text',
  shortDescription: 'text',
  'features.name': 'text',
  'features.description': 'text',
});

// Virtual for service URL slug
ServiceSchema.virtual('slug').get(function () {
  return `${this.title.toLowerCase().replace(/\s+/g, '-')}-${this._id.toString().slice(-6)}`;
});

// Pre-save hook to ensure location is set from address
ServiceSchema.pre('save', async function (next) {
  if (this.isModified('address') && this.address) {
    const addressDoc = await mongoose.model('Address').findById(this.address);
    if (addressDoc && addressDoc.location) {
      this.location = addressDoc.location;
    }
  }
  next();
});

export const Service = mongoose.model('Service', ServiceSchema);
