import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    // KYC & Verification
    kycPrice: {
      type: Number,
      required: true,
      default: 500,
    },
    // Commission Structure
    commissionPerServiceBooking: {
      type: Number,
      required: true,
      default: 0,
    },
    commissionPerBilling: {
      type: Number,
      required: true,
      default: 0,
    },
    platformFee: {
      type: Number,
      default: 0,
    },

    membershipDiscountRate: {
      type: Number,
      default: 10,
    },

    // Booking Settings
    bookingCancellationTime: {
      type: Number,
      default: 24,
      description: 'Free cancellation allowed before X hours',
    },

    // Cancellation Charges
    customerCancellationCharge: {
      withinFreeWindow: {
        type: Number,
        default: 0,
      },
      lessThan24Hours: {
        type: Number,
        default: 0,
      },
      lessThan2Hours: {
        type: Number,
        default: 0,
      },
    },

    vendorCancellationPenalty: {
      firstCancellation: {
        type: Number,
        default: 0,
      },
      secondCancellation: {
        type: Number,
        default: 0,
      },
      thirdCancellation: {
        type: Number,
        default: 0,
      },
    },

    // Payment Settings
    paymentMethods: {
      cash: {
        type: Boolean,
        default: true,
      },
      online: {
        type: Boolean,
        default: true,
      },
      wallet: {
        type: Boolean,
        default: true,
      },
    },

    minimumWalletBalance: {
      type: Number,
      default: 0,
    },
    vendorPayoutCycle: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly',
    },
    minimumPayoutAmount: {
      type: Number,
      default: 0,
    },

    // Rating & Review Settings
    minimumRatingRequired: {
      type: Number,
      default: 3.5,
      min: 0,
      max: 5,
    },
    reviewMandatory: {
      type: Boolean,
      default: true,
    },
    autoSuspendBelowRating: {
      type: Number,
      default: 3.0,
    },

    // Customer Settings
    referralBonus: {
      referrer: {
        type: Number,
        default: 0,
      },
      referee: {
        type: Number,
        default: 0,
      },
    },
    firstBookingDiscount: {
      type: Number,
      default: 0,
    },
    loyaltyPointsPerBooking: {
      type: Number,
      default: 0,
    },

    // Service Settings
    serviceTaxRate: {
      type: Number,
      default: 0,
    },

    // Notification Settings
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      whatsapp: {
        type: Boolean,
        default: false,
      },
    },

    // Support & Helpdesk
    supportEmail: {
      type: String,
      default: 'support@yourcompany.com',
    },
    supportPhone: {
      type: String,
      default: '+91-1800-XXX-XXXX',
    },
    chatSupportEnabled: {
      type: Boolean,
      default: true,
    },

    maintenanceModeUser: {
      type: Boolean,
      default: false,
    },
    maintenanceModeVendor: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      default: 'We are currently under maintenance. Please check back soon.',
    },

    // Currency & Localization
    defaultCurrency: {
      type: String,
      default: 'INR',
    },
    defaultLanguage: {
      type: String,
      default: 'en',
    },

    // Analytics & Reporting
    analyticsEnabled: {
      type: Boolean,
      default: true,
    },

    productTaxRate: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Method to get active settings (since there should only be one settings document)
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const Setting = mongoose.model('Settings', settingsSchema);
