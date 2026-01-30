import mongoose from 'mongoose';

const RoomCountSchema = new mongoose.Schema(
  {
    livingRoom: { type: Number, default: 0 },
    kitchen: { type: Number, default: 0 },
    bedroom: { type: Number, default: 0 },
    bathroom: { type: Number, default: 0 },
    dining: { type: Number, default: 0 },
  },
  { _id: false }
);

const KitchenSchema = new mongoose.Schema(
  {
    layout: {
      type: String,
      enum: ['L_SHAPE', 'U_SHAPE', 'STRAIGHT', 'PARALLEL'],
    },
    measurements: {
      a: { type: Number }, // in ft
      b: { type: Number }, // in ft
      c: { type: Number }, // in ft
    },
    package: {
      type: String,
      enum: ['ESSENTIALS', 'PREMIUM', 'LUXURY'],
    },
  },
  { _id: false }
);

const CalculatorLeadSchema = new mongoose.Schema(
  {
    bhkType: {
      type: Number,
      enum: [1, 2, 3, 4, 5],
    },

    bhkSize: {
      type: String,
      enum: ['SMALL', 'MEDIUM', 'LARGE'],
    },

    bhkSquareFootage: {
      type: Number,
    },

    rooms: RoomCountSchema,

    kitchen: KitchenSchema,

    homePackage: {
      type: String,
      enum: ['ESSENTIALS', 'PREMIUM', 'LUXURY'],
    },

    user: {
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String, required: true },
      whatsappOptIn: { type: Boolean, default: false },
      city: { type: String },
    },

    source: {
      type: String,
      default: 'CALCULATOR',
    },

    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'QUALIFIED', 'CLOSED'],
      default: 'NEW',
    },

    payment: {
      amount: {
        type: Number,
        default: 0,
      },

      paymentMethod: {
        type: String,
        enum: ['razorpay', 'cash'],
      },

      paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending',
      },

      razorpayOrderId: String,

      paidAt: Date,
    },
  },
  { timestamps: true }
);

export const CalculatorLead = mongoose.model('CalculatorLead', CalculatorLeadSchema);
