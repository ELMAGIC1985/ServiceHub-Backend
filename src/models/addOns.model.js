import mongoose from 'mongoose';

const AddOnSchema = new mongoose.Schema(
  {
    serviceTemplates: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceTemplate',
      },
    ],

    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],

    name: {
      type: String,
      required: [true, 'Add-on name is required'],
      trim: true,
      maxlength: [150, 'Add-on name cannot exceed 150 characters'],
      index: true,
    },

    slug: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },

    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
        alt: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false },
      },
    ],

    pricing: {
      price: {
        type: Number,
        required: [true, 'Add-on price is required'],
        min: [0, 'Price cannot be negative'],
      },
      currency: {
        type: String,
        default: 'INR',
      },
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
        index: true,
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: [true, 'Created by admin is required'],
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AddOnSchema.index({ serviceTemplates: 1, isActive: 1 });
AddOnSchema.index({ name: 'text', description: 'text', tags: 'text' });

AddOnSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  next();
});

export const AddOn = mongoose.model('AddOn', AddOnSchema);
