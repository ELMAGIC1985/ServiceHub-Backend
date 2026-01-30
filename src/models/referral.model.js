import mongoose, { Schema } from 'mongoose';

const referralSchema = new Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reward: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const Referral = mongoose.model('Referral', referralSchema);
