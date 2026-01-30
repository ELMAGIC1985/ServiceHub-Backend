import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    itemType: {
      type: String,
      enum: ['Product', 'Booking', 'Vendor', 'ServiceTemplate'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userType',
    },
    userType: {
      type: String,
      required: true,
      enum: ['User', 'Vendor'],
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, refPath: 'sourceType' },
    sourceType: {
      type: String,
      enum: ['Order', 'Booking'],
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: String,
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    verifiedPurchase: { type: Boolean, default: false },
    sentimentScore: { type: Number, min: -1, max: 1 },
    userIP: { type: String },
    userDevice: { type: String },
    images: [{ url: String }],
  },
  { timestamps: true }
);

export const Rating = mongoose.model('Rating', ratingSchema);
