import mongoose from 'mongoose';

const ServiceTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Service title is required'],
      trim: true,
      maxlength: [200, 'Service title cannot exceed 200 characters'],
      index: true,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      required: [true, 'Service description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
    },

    // Category Structure
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Service category is required'],
      index: true,
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
      required: [true, 'Service sub-category is required'],
    },

    childCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },

    // Service Images
    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        alt: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    features: [
      {
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        icon: { type: String, trim: true },
      },
    ],

    // vendors
    vendors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
      },
    ],

    // What's typically included in this service
    defaultIncluded: [{ type: String, trim: true }],

    // What's typically excluded
    defaultExcluded: [{ type: String, trim: true }],

    // Common requirements for this service
    requirements: [{ type: String, trim: true }],

    isMultiOrder: {
      type: Boolean,
      default: false,
    },

    isMembershipDiscount: {
      type: Boolean,
      default: false,
    },

    // Supported brands for this service type
    supportedBrands: [
      {
        name: { type: String, required: true, trim: true },
        logo: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
      },
    ],

    // Pricing guidelines (base price set by admin)
    pricingGuidelines: {
      basePrice: {
        type: Number,
        required: true,
        min: [0, 'Base price cannot be negative'],
      },
      maxPrice: {
        type: Number,
        min: [0, 'Max price cannot be negative'],
      },
      currency: {
        type: String,
        default: 'INR',
      },
      priceType: {
        type: String,
        enum: ['fixed', 'hourly', 'per_item', 'custom'],
        default: 'fixed',
      },
    },

    // Estimated duration for this service
    estimatedDuration: {
      min: { type: Number }, // in minutes
      max: { type: Number },
      unit: {
        type: String,
        enum: ['minutes', 'hours', 'days'],
        default: 'minutes',
      },
    },

    // Common FAQs for this service
    commonFaqs: [
      {
        question: { type: String, trim: true },
        answer: { type: String, trim: true },
        order: { type: Number, default: 0 },
      },
    ],

    // Service Tags
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        index: true,
      },
    ],

    // SEO Fields
    seo: {
      metaTitle: { type: String, maxlength: 60 },
      metaDescription: { type: String, maxlength: 160 },
      keywords: [{ type: String, trim: true }],
    },

    isActive: {
      type: Boolean,
      default: true,
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

    serviceAddOns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AddOn',
        index: true,
      },
    ],

    commissionRate: {
      type: Number,
      default: 0,
    },

    totalRatings: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },

    // Audit Fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // required: true,
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

ServiceTemplateSchema.index({ category: 1, subCategory: 1, childCategory: 1 });
ServiceTemplateSchema.index({ tags: 1 });
ServiceTemplateSchema.index({ isActive: 1, isDeleted: 1 });
ServiceTemplateSchema.index({ title: 'text', description: 'text', tags: 'text' });

ServiceTemplateSchema.pre('save', function (next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  next();
});

export const ServiceTemplate = mongoose.model('ServiceTemplate', ServiceTemplateSchema);
