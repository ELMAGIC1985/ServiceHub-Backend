import mongoose, { Schema } from 'mongoose';

const membershipSchema = new Schema(
  {
    memberType: {
      type: String,
      required: true,
      enum: ['User', 'Vendor'],
    },
    memberId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'memberTypeRef',
    },
    memberTypeRef: {
      type: String,
      required: true,
      enum: ['User', 'Vendor'],
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'MembershipPlan',
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
      default: 'ACTIVE',
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    membershipUsage: {
      type: Number,
      default: 0,
    },
    paymentDetails: {
      paymentMethod: {
        type: String,
        enum: ['CARD', 'WALLET', 'UPI', 'CASH', 'FREE'],
        default: 'FREE',
      },
      transactionId: {
        type: String,
        trim: true,
      },
      amountPaid: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

membershipSchema.pre('validate', async function (next) {
  if (this.isNew) {
    const plan = await mongoose.model('MembershipPlan').findById(this.planId);
    if (plan) {
      this.endDate = new Date(this.startDate.getTime() + plan.durationInDays * 24 * 60 * 60 * 1000);
    }
  }
  next();
});

membershipSchema.virtual('plan', {
  ref: 'MembershipPlan',
  localField: 'planId',
  foreignField: '_id',
  justOne: true,
});

membershipSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'plan',
    select: 'name price durationInDays benefits',
  });
  next();
});

export const Membership = mongoose.model('Membership', membershipSchema);
