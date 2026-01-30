import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const formatAmount = (v) => {
  if (typeof v !== 'number') return v;
  return Number(v.toFixed(1));
};

const WalletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      refPath: 'userType',
    },
    userType: {
      type: String,
      required: true,
      enum: ['Admin', 'Vendor', 'User'],
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Balance cannot be negative'],
      validate: {
        validator: function (v) {
          return Number.isFinite(v) && v >= 0;
        },
        message: 'Balance must be a valid non-negative number',
      },
      get: formatAmount,
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: [0, 'Pending balance cannot be negative'],
      get: formatAmount,
    },
    pendingSince: {
      type: Date,
    },
    frozenBalance: {
      type: Number,
      default: 0,
      min: [0, 'Frozen balance cannot be negative'],
      get: formatAmount,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR'], // Add supported currencies
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'frozen'],
      default: 'active',
      index: true,
    },
    recentTransactions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Transaction',
      },
    ],
    settings: {
      dailyLimit: {
        type: Number,
        default: function () {
          switch (this.userType) {
            case 'admin':
              return 1000000;
            case 'vendor':
              return 100000;
            case 'customer':
              return 10000;
            default:
              return 10000;
          }
        },
      },
      monthlyLimit: {
        type: Number,
        default: function () {
          switch (this.userType) {
            case 'admin':
              return 10000000;
            case 'vendor':
              return 1000000;
            case 'customer':
              return 100000;
            default:
              return 100000;
          }
        },
      },
      autoFreeze: {
        type: Boolean,
        default: false,
      },
    },
    spending: {
      daily: {
        amount: { type: Number, default: 0 },
        date: { type: Date, default: Date.now },
      },
      monthly: {
        amount: { type: Number, default: 0 },
        month: { type: Number, default: new Date().getMonth() },
        year: { type: Number, default: new Date().getFullYear() },
      },
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
  }
);

WalletSchema.set('toJSON', { getters: true });
WalletSchema.set('toObject', { getters: true });

WalletSchema.index({ userId: 1, userType: 1 });
WalletSchema.index({ userType: 1, status: 1 });
WalletSchema.index({ currency: 1, status: 1 });

WalletSchema.virtual('availableBalance').get(function () {
  return this.balance - this.frozenBalance;
});

WalletSchema.methods.canTransact = function (amount) {
  const dailyCheck = this.spending.daily.amount + amount <= this.settings.dailyLimit;
  const monthlyCheck = this.spending.monthly.amount + amount <= this.settings.monthlyLimit;
  const balanceCheck = this.availableBalance >= amount;
  const statusCheck = this.status === 'active';

  return {
    canTransact: dailyCheck && monthlyCheck && balanceCheck && statusCheck,
    reasons: {
      dailyLimit: dailyCheck,
      monthlyLimit: monthlyCheck,
      sufficientBalance: balanceCheck,
      activeStatus: statusCheck,
    },
  };
};

WalletSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (update.$inc) {
    update.$inc.__v = 1;
  } else {
    this.set({ $inc: { __v: 1 } });
  }

  next();
});

const Wallet = mongoose.model('Wallet', WalletSchema);

export default Wallet;
