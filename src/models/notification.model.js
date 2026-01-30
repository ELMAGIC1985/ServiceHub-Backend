import mongoose, { Schema } from 'mongoose';

const nptificationSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      default: 'all',
      enum: ['user', 'vendor', 'all', 'admin'],
    },
    isSend: {
      type: Boolean,
      default: false,
    },
    image: {
      type: String,
    },
    link: {
      type: String,
    },
    vendors: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Vendor',
      },
    ],
    users: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isDelete: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'booking',
        'product_order',
        'wallet',
        'payment',
        'membership',
        'general',
        'membership_purchase',
        'membership_activation',
        'wallet_topup',
        'wallet_topup_success',
        'booking_payment',
        'booking_payment_success',
        'booking_payment_received',
        'commission',
      ],
      default: 'general',
    },
  },
  {
    timestamps: true,
  }
);

export const Notification = mongoose.model('Notification', nptificationSchema);
