import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true, required: true },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: { type: Number, required: true },
    minPurchase: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    appliesTo: {
      type: String,
      enum: ['Product', 'ServiceTemplate'],
      required: true,
    },
    applicableItems: [{ type: mongoose.Schema.Types.ObjectId, refPath: 'appliesTo' }],
    appliesTo: {
      type: String,
      enum: ['Product', 'ServiceTemplate'],
    },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    userSpecific: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    vendorSpecific: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }],
  },
  { timestamps: true }
);

export const Coupon = mongoose.model('Coupon', couponSchema);
