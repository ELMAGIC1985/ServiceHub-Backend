import { Setting } from '../../models/index.js';
import { asyncHandler, ApiError, ApiResponse } from '../../utils/index.js';

export const getSettings = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({});
  }

  res.status(200).json(new ApiResponse(200, settings, 'Settings retrieved successfully'));
});

export const updateSettings = asyncHandler(async (req, res) => {
  const {
    // KYC & Verification
    kycPrice,

    // Commission Structure
    commissionPerServiceBooking,
    commissionPerBilling,
    platformFee,

    // Booking Settings
    bookingCancellationTime,

    // Cancellation Charges
    customerCancellationCharge,
    vendorCancellationPenalty,

    // Payment Settings
    paymentMethods,
    minimumWalletBalance,
    vendorPayoutCycle,
    minimumPayoutAmount,

    // Rating & Review Settings
    minimumRatingRequired,
    reviewMandatory,
    autoSuspendBelowRating,

    // Customer Settings
    referralBonus,
    firstBookingDiscount,
    loyaltyPointsPerBooking,

    // Service Settings
    serviceTaxRate,

    // Notification Settings
    notifications,

    // Support & Helpdesk
    supportEmail,
    supportPhone,
    chatSupportEnabled,

    // Maintenance
    maintenanceModeVendor,
    maintenanceModeUser,
    maintenanceMessage,

    // Currency & Localization
    defaultCurrency,
    defaultLanguage,

    // Analytics & Reporting
    analyticsEnabled,
    membershipDiscountRate,

    // product setting
    productTaxRate,
  } = req.body;

  // Get existing settings
  let settings = await Setting.findOne();

  // If no settings exist, create new
  if (!settings) {
    settings = new Setting();
  }

  // Update fields if provided
  if (kycPrice !== undefined) settings.kycPrice = kycPrice;
  if (commissionPerServiceBooking !== undefined) settings.commissionPerServiceBooking = commissionPerServiceBooking;
  if (commissionPerBilling !== undefined) settings.commissionPerBilling = commissionPerBilling;
  if (platformFee !== undefined) settings.platformFee = platformFee;
  if (bookingCancellationTime !== undefined) settings.bookingCancellationTime = bookingCancellationTime;

  // Update nested objects
  if (customerCancellationCharge) {
    settings.customerCancellationCharge = {
      ...settings.customerCancellationCharge,
      ...customerCancellationCharge,
    };
  }

  if (vendorCancellationPenalty) {
    settings.vendorCancellationPenalty = {
      ...settings.vendorCancellationPenalty,
      ...vendorCancellationPenalty,
    };
  }

  if (paymentMethods) {
    settings.paymentMethods = {
      ...settings.paymentMethods,
      ...paymentMethods,
    };
  }

  if (minimumWalletBalance !== undefined) settings.minimumWalletBalance = minimumWalletBalance;
  if (vendorPayoutCycle !== undefined) settings.vendorPayoutCycle = vendorPayoutCycle;
  if (minimumPayoutAmount !== undefined) settings.minimumPayoutAmount = minimumPayoutAmount;

  if (minimumRatingRequired !== undefined) settings.minimumRatingRequired = minimumRatingRequired;
  if (reviewMandatory !== undefined) settings.reviewMandatory = reviewMandatory;
  if (autoSuspendBelowRating !== undefined) settings.autoSuspendBelowRating = autoSuspendBelowRating;
  if (membershipDiscountRate !== undefined) settings.membershipDiscountRate = membershipDiscountRate;

  if (referralBonus) {
    settings.referralBonus = {
      ...settings.referralBonus,
      ...referralBonus,
    };
  }

  if (firstBookingDiscount !== undefined) settings.firstBookingDiscount = firstBookingDiscount;
  if (loyaltyPointsPerBooking !== undefined) settings.loyaltyPointsPerBooking = loyaltyPointsPerBooking;

  if (serviceTaxRate !== undefined) settings.serviceTaxRate = serviceTaxRate;

  if (notifications) {
    settings.notifications = {
      ...settings.notifications,
      ...notifications,
    };
  }

  if (supportEmail !== undefined) settings.supportEmail = supportEmail;
  if (supportPhone !== undefined) settings.supportPhone = supportPhone;
  if (chatSupportEnabled !== undefined) settings.chatSupportEnabled = chatSupportEnabled;

  if (maintenanceModeUser !== undefined) settings.maintenanceModeUser = maintenanceModeUser;
  if (maintenanceModeVendor !== undefined) settings.maintenanceModeVendor = maintenanceModeVendor;
  if (maintenanceMessage !== undefined) settings.maintenanceMessage = maintenanceMessage;

  if (defaultCurrency !== undefined) settings.defaultCurrency = defaultCurrency;
  if (defaultLanguage !== undefined) settings.defaultLanguage = defaultLanguage;

  if (analyticsEnabled !== undefined) settings.analyticsEnabled = analyticsEnabled;

  if (productTaxRate !== undefined) settings.productTaxRate = productTaxRate;

  // Save updated settings
  await settings.save();

  res.status(200).json(new ApiResponse(200, settings, 'Settings updated successfully'));
});

export const resetSettings = asyncHandler(async (req, res) => {
  await Setting.deleteMany({});
  const settings = await Setting.create({});
  res.status(200).json(new ApiResponse(200, settings, 'Settings reset to default successfully'));
});

export const getSettingByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;

  const settings = await Setting.findOne();

  if (!settings) {
    throw new ApiError(404, 'Settings not found');
  }

  if (!(key in settings.toObject())) {
    throw new ApiError(400, `Setting key '${key}' not found`);
  }

  const value = settings[key];

  res.status(200).json(new ApiResponse(200, { key, value }, 'Setting retrieved successfully'));
});

export const updateSettingByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    throw new ApiError(400, 'Value is required');
  }

  let settings = await Setting.findOne();

  if (!settings) {
    settings = await Setting.create({});
  }

  // Check if key exists in settings
  if (!(key in settings.toObject())) {
    throw new ApiError(400, `Setting key '${key}' not found`);
  }

  // Update the specific key
  settings[key] = value;
  await settings.save();

  res.status(200).json(new ApiResponse(200, { key, value: settings[key] }, 'Setting updated successfully'));
});

export const toggleMaintenanceMode = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();

  if (!settings) {
    settings = await Setting.create({});
  }

  settings.maintenanceModeUser = !settings.maintenanceModeUser;
  settings.maintenanceModeVendor = !settings.maintenanceModeVendor;
  await settings.save();

  res.status(200).json(
    new ApiResponse(200, {
      maintenanceModeUser: settings.maintenanceModeUser,
      maintenanceModeVendor: settings.maintenanceModeVendor,
    })
  );
});

export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.findOne();

  if (!settings) {
    throw new ApiError(404, 'Settings not found');
  }

  const publicSettings = {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    defaultCurrency: settings.defaultCurrency,
    defaultLanguage: settings.defaultLanguage,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    chatSupportEnabled: settings.chatSupportEnabled,
    bookingCancellationTime: settings.bookingCancellationTime,
    serviceTaxRate: settings.serviceTaxRate,
    paymentMethods: settings.paymentMethods,
  };

  res.status(200).json(new ApiResponse(200, publicSettings, 'Public settings retrieved successfully'));
});
