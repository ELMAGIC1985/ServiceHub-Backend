import mongoose from 'mongoose';
import Counter from './counter.model.js';

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true, required: true, index: true },
    orderIdSeq: { type: String, unique: true, index: true },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        productName: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
        pricing: {
          basePrice: { type: Number, required: true, min: 0 },
          discountPrice: { type: Number, default: 0, min: 0 },
          couponDiscount: { type: Number, default: 0, min: 0 },
          membershipDiscount: { type: Number, default: 0, min: 0 },
          taxAmount: { type: Number, default: 0, min: 0 },
          finalPrice: { type: Number, default: 0, min: 0 },
          totalAmount: { type: Number, required: true, min: 0 },
          unit: {
            basePrice: { type: Number, required: true, min: 0 },
            discountPrice: { type: Number, default: 0, min: 0 },
            discountPercentage: { type: Number, default: 0, min: 0 },
            discountAmount: { type: Number, default: 0, min: 0 },
            finalPrice: { type: Number, default: 0, min: 0 },
            totalAmount: { type: Number, required: true, min: 0 },
          },
        },
      },
    ],
    deliverySlot: { type: String },
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
    },
    totalAmount: { type: Number, required: true },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    payment: {
      paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },
      paymentMethod: {
        type: String,
        enum: ['cod', 'credit_card', 'debit_card', 'upi', 'net_banking', 'razorpay'],
      },
      transactionId: { type: String },
      paymentDate: { type: Date },
      razorpayOrderId: { type: String },
    },
    timestamps: {
      orderPlacedAt: { type: Date, default: Date.now },
      paymentCompletedAt: { type: Date },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
      cancelledAt: { type: Date },
    },
    userType: {
      type: String,
      enum: ['Vendor', 'User', 'Admin'],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'userType',
    },
    isUserRated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

orderSchema.virtual('userDetails', {
  ref: (doc) => doc.userType,
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

orderSchema.pre('save', async function (next) {
  if (this.orderIdSeq) return next();

  const counter = await Counter.findOneAndUpdate({ name: 'order' }, { $inc: { seq: 1 } }, { new: true, upsert: true });

  const padded = counter.seq.toString().padStart(4, '0');

  this.orderIdSeq = `HKORD${padded}`;

  next();
});

orderSchema.methods.isOwnedBy = function (userId) {
  return this.userId.toString() === userId.toString();
};

orderSchema.methods.isDelivered = function () {
  return this.orderStatus === 'delivered';
};

orderSchema.methods.isCancelled = function () {
  return this.orderStatus === 'cancelled';
};

orderSchema.methods.isPending = function () {
  return this.orderStatus === 'pending';
};

orderSchema.methods.canBeCancelled = function () {
  return ['pending', 'confirmed'].includes(this.orderStatus);
};

orderSchema.methods.containsProduct = function (productId) {
  return this.products.some((p) => p.product.toString() === productId.toString());
};

orderSchema.methods.isPaymentCompleted = function () {
  return this.payment.paymentStatus === 'paid';
};

orderSchema.methods.canProductBeRatedBy = function (userId, productId) {
  if (!this.isOwnedBy(userId)) {
    return {
      valid: false,
      message: 'You are not allowed to rate products from this order',
    };
  }

  if (!this.containsProduct(productId)) {
    return {
      valid: false,
      message: 'Product not found in this order',
    };
  }

  if (!this.isDelivered()) {
    return {
      valid: false,
      message: 'You can only rate products from delivered orders',
    };
  }

  return {
    valid: true,
    reason: ORDER_VALIDATION_REASONS.VALID,
  };
};

orderSchema.statics.findByUserAndProduct = function (userId, userType, productId) {
  return this.findOne({
    userId,
    userType,
    'products.product': productId,
  });
};

orderSchema.statics.findDeliveredByUserAndProduct = function (userId, userType, productId) {
  return this.findOne({
    userId,
    userType,
    'products.product': productId,
    orderStatus: 'delivered',
  });
};

const Order = mongoose.model('Order', orderSchema);

export default Order;
