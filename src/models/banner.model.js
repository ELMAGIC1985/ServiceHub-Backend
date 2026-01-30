import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    subtitle: {
      type: String,
      trim: true,
      maxLength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxLength: 500,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageAlt: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['main_banner', 'promotional', 'announcement', 'category'],
      default: 'main_banner',
    },
    position: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },
    clickAction: {
      type: {
        type: String,
        enum: ['none', 'external_link', 'internal_navigation', 'product', 'category'],
        default: 'none',
      },
      value: {
        type: String,
        default: '',
      },
    },
    targetAudience: {
      userTypes: [
        {
          type: String,
          enum: ['all', 'new_user', 'premium', 'regular'],
        },
      ],
      locations: [String],
      ageRange: {
        min: Number,
        max: Number,
      },
    },
    analytics: {
      views: {
        type: Number,
        default: 0,
      },
      clicks: {
        type: Number,
        default: 0,
      },
      impressions: {
        type: Number,
        default: 0,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

bannerSchema.index({ type: 1, isActive: 1, position: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });
bannerSchema.index({ createdAt: -1 });

bannerSchema.virtual('isCurrentlyActive').get(function () {
  const now = new Date();
  const isWithinDateRange = this.startDate <= now && (!this.endDate || this.endDate >= now);
  return this.isActive && isWithinDateRange;
});

bannerSchema.set('toJSON', { virtuals: true });

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;
