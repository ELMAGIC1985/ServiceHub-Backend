import mongoose, { Schema } from 'mongoose';
import slugify from 'slugify';

const membershipPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    durationInDays: {
      type: Number,
      required: true,
    },
    benefits: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  { timestamps: true }
);

membershipPlanSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

membershipPlanSchema.index({ slug: 1 }, { unique: true });

export const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);
