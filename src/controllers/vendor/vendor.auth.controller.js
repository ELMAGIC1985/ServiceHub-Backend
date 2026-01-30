import { ApiResponse, ApiError, asyncHandler, logger } from '../../utils/index.js';
import { VendorKYC, Transaction, Address, Vendor } from '../../models/index.js';
import config from '../../config/config.js';
import { addressService } from '../../services/address/address.command.service.js';
import { updateVendorProfileSchema } from '../../validators/vendor/vendor.validation.js';
import mongoose from 'mongoose';
import simpleImageService from '../../services/image/SimpleImageService.js';
import { vendorAuthService, authService } from '../../services/auth/index.js';
import { STATUS } from '../../constants/constants.js';

const authenticateVendor = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  try {
    const result = await vendorAuthService.authenticate(phoneNumber);

    return res.status(result.statusCode).json(new ApiResponse(result.statusCode, result.data, result.message));
  } catch (error) {
    console.error('❌ Vendor authentication error:', error);
    throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
  }
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  try {
    const result = await vendorAuthService.verifyOTP(phoneNumber, otp);

    const cookieOptions = authService.getCookieOptions();

    return res
      .status(result.statusCode)
      .cookie('accessToken', result.cookies.accessToken, cookieOptions)
      .cookie('refreshToken', result.cookies.refreshToken, cookieOptions)
      .json(new ApiResponse(result.statusCode, result.data, result.message));
  } catch (error) {
    logger.error('❌ OTP verification error:', error);
    throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
  }
});

const updateVendorProfile = async (req, res) => {
  try {
    const vendorId = req.user._id;
    let updateData = { ...req.body };

    const restrictedFields = [
      'role',
      'isBlocked',
      'isVerified',
      'isKYCVerified',
      'isEmailVerified',
      'isMobileVerified',
      'kycStatus',
      'isKYCPaymentVerified',
      'kycAmount',
      'wallet',
      'membership',
      'services',
    ];
    restrictedFields.forEach((field) => delete updateData[field]);

    // ✅ Validate input using Joi or similar
    const { error, value } = updateVendorProfileSchema.validate(updateData, { abortEarly: false });
    if (error) {
      return res
        .status(400)
        .json(new ApiResponse(400, { errors: error.details.map((err) => err.message) }, 'Validation error'));
    }
    updateData = value;

    // ✅ Email uniqueness check
    if (updateData.email) {
      const existingVendor = await Vendor.findOne({
        email: updateData.email,
        _id: { $ne: vendorId },
      });
      if (existingVendor) {
        return res.status(400).json(new ApiResponse(400, null, 'Email already exists'));
      }
    }

    // ✅ Phone number uniqueness check
    if (updateData.phoneNumber) {
      const existingVendor = await Vendor.findOne({
        phoneNumber: updateData.phoneNumber,
        _id: { $ne: vendorId },
      });
      if (existingVendor) {
        return res.status(400).json(new ApiResponse(400, null, 'Phone number already exists'));
      }
    }

    // ✅ Process profile image uploads (avatar, documentImage, selfieImage)
    let imageUrl = null;
    if (req.file) {
      const urls = await simpleImageService.processAndUploadSingleImage(req.file, 'avatar');
      imageUrl = urls[0];
    }

    if (imageUrl) {
      updateData.selfieImage = imageUrl?.url;
    }

    // ✅ Update vendor profile
    const updatedVendor = await Vendor.findByIdAndUpdate(
      vendorId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!updatedVendor) {
      return res.status(404).json(new ApiResponse(404, null, 'Vendor not found'));
    }

    return res.status(200).json(new ApiResponse(200, { vendor: updatedVendor }, 'Vendor profile updated successfully'));
  } catch (error) {
    console.error('Update vendor profile error:', error);

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json(new ApiResponse(400, null, error.message));
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json(new ApiResponse(400, null, `${field} already exists`));
    }

    return res.status(500).json(new ApiResponse(500, null, 'Internal server error'));
  }
};

const selfIdentification = asyncHandler(async (req, res, next) => {
  const { user } = req;
  const vendorId = user._id;
  const { password: _, refreshToken: __, ...vendorData } = user.toObject();

  // Calculate profile completeness percentage
  const calculateProfileCompleteness = (vendor) => {
    let score = 0;
    const maxScore = 100;

    // Basic Information (40 points total)
    if (vendor.firstName) score += 10;
    if (vendor.lastName) score += 10;
    if (vendor.email) score += 10;
    if (vendor.phoneNumber) score += 10;

    // Personal Details (20 points total)
    if (vendor.dob) score += 10;
    if (vendor.avatar) score += 10;

    // Documents (30 points total)
    if (vendor.documentImage) score += 15;
    if (vendor.selfieImage) score += 15;

    // Services (10 points total)
    if (vendor.serviceCategories && vendor.serviceCategories.length > 0) score += 10;

    return {
      score: score,
      percentage: Math.round((score / maxScore) * 100),
      isComplete: score === maxScore,
    };
  };

  try {
    // Check KYC payment eligibility
    const validPayment = await Transaction.findValidKYCPaymentForVendor(vendorId);
    const existingKYC = await VendorKYC.findOne({ vendor: vendorId });
    const kycAmount = parseFloat(config.KYC_PAYMENT_AMOUNT || 500);

    const kycPaymentEligibility = {
      needsPayment: !validPayment,
      canSubmitKYC: validPayment ? validPayment.canSubmitKYCNow : false,
      hasExistingKYC: !!existingKYC,
      kycStatus: existingKYC?.kycStatus || 'not_started',
      paymentAmount: kycAmount,
      currentPayment: validPayment
        ? {
            transactionId: validPayment._id,
            amount: validPayment.amount,
            validUntil: validPayment.kycDetails.validUntil,
            remainingDays: validPayment.remainingValidityDays,
            isKYCSubmitted: validPayment.kycDetails.isKYCSubmitted,
          }
        : null,
    };

    // Calculate verification status
    const verificationStatus = {
      email: vendorData.isEmailVerified || false,
      mobile: vendorData.isMobileVerified || false,
      kyc: vendorData.isKYCVerified || false,
      overall: vendorData.isVerified || false,
      completeness: [
        vendorData.isEmailVerified,
        vendorData.isMobileVerified,
        vendorData.isKYCVerified,
        !!(vendorData.documentImage && vendorData.selfieImage),
      ].filter(Boolean).length,
    };

    // Get profile completeness
    const profileCompleteness = calculateProfileCompleteness(vendorData);

    // Enhanced next steps with KYC payment considerations
    const generateNextSteps = () => {
      const steps = [];

      // Basic profile completion steps
      if (!vendorData.firstName || !vendorData.lastName) {
        steps.push('Complete your basic information (first name, last name)');
      }
      if (!vendorData.phoneNumber || !vendorData.email) {
        steps.push('Add your contact information');
      }
      if (!vendorData.avatar) {
        steps.push('Upload a profile picture');
      }
      if (!vendorData.serviceCategories || vendorData.serviceCategories.length === 0) {
        steps.push('Select your service categories');
      }
      if (!vendorData.isEmailVerified) {
        steps.push('Verify your email address');
      }
      if (!vendorData.isMobileVerified) {
        steps.push('Verify your phone number');
      }

      // KYC-related steps based on payment eligibility
      if (kycPaymentEligibility.needsPayment && !kycPaymentEligibility.hasExistingKYC) {
        steps.push(`Make KYC payment of ${kycAmount} to start verification process`);
      } else if (kycPaymentEligibility.canSubmitKYC && !kycPaymentEligibility.hasExistingKYC) {
        if (!vendorData.documentImage || !vendorData.selfieImage) {
          steps.push('Upload required KYC documents (ID document and selfie)');
        } else {
          steps.push('Submit your KYC application for verification');
        }
      } else if (kycPaymentEligibility.hasExistingKYC && kycPaymentEligibility.kycStatus === 'pending') {
        steps.push('Your KYC verification is under review');
      } else if (kycPaymentEligibility.hasExistingKYC && kycPaymentEligibility.kycStatus === 'rejected') {
        steps.push('Resubmit your KYC documents after addressing rejection reasons');
      }

      return steps;
    };

    // Add computed fields
    const enhancedVendorData = {
      ...vendorData,

      kycRejectionReason: existingKYC?.reasonEnum,

      // Computed fields
      fullName: `${vendorData.firstName || ''} ${vendorData.lastName || ''}`.trim(),
      age: vendorData.dob ? Math.floor((new Date() - new Date(vendorData.dob)) / (365.25 * 24 * 60 * 60 * 1000)) : null,

      // Verification status
      verificationStatus,

      // Profile completeness
      profileCompleteness,

      // KYC payment eligibility
      kycPaymentEligibility,

      // Missing fields for profile completion
      missingFields: (() => {
        const missing = [];
        if (!vendorData.firstName) missing.push('firstName');
        if (!vendorData.lastName) missing.push('lastName');
        if (!vendorData.email) missing.push('email');
        if (!vendorData.phoneNumber) missing.push('phoneNumber');
        if (!vendorData.dob) missing.push('dateOfBirth');
        if (!vendorData.avatar) missing.push('avatar');
        if (!vendorData.documentImage) missing.push('documentImage');
        if (!vendorData.selfieImage) missing.push('selfieImage');
        if (!vendorData.serviceCategories || vendorData.serviceCategories.length === 0) {
          missing.push('serviceCategories');
        }
        return missing;
      })(),

      // Enhanced profile completion suggestions with KYC considerations
      nextSteps: generateNextSteps(),
    };

    // Generate dynamic message based on profile and KYC status
    const generateMessage = () => {
      let message = `User identified successfully. Profile ${profileCompleteness.percentage}% complete.`;

      if (kycPaymentEligibility.needsPayment) {
        message += ` KYC payment required to proceed with verification.`;
      } else if (kycPaymentEligibility.canSubmitKYC && !kycPaymentEligibility.hasExistingKYC) {
        message += ` Ready to submit KYC documents.`;
      } else if (kycPaymentEligibility.kycStatus === 'pending') {
        message += ` KYC verification in progress.`;
      } else if (kycPaymentEligibility.kycStatus === 'approved') {
        message += ` KYC verification completed.`;
      }

      return message;
    };

    return res.status(200).json(new ApiResponse(200, enhancedVendorData, generateMessage()));
  } catch (error) {
    console.error('Self identification with KYC eligibility error:', error);
    return next(new ApiError('Failed to get vendor profile information', 500));
  }
});

const updatedAddress = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { address } = req.body;

  const existingAddress = await Address.findById(id);

  if (!existingAddress) {
    return next(new ApiError(400, 'Address not found'));
  }

  const updatedAddress = await addressService.updateAddress(id, address);

  if (!updatedAddress.success) {
    return next(new ApiError(400, 'Unable to update found'));
  }

  return res.status(200).json(new ApiResponse(200, updatedAddress.data.id, 'Address updated succesfully'));
});

const deleteVendor = async (req, res) => {
  const { id } = req.params;

  try {
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    // Already deleted
    if (vendor.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Vendor is already deleted',
      });
    }

    // Perform soft delete
    vendor.isDeleted = true;
    vendor.isAvailable = false;
    vendor.isOnline = false;

    // Optional: invalidate refresh token
    vendor.refreshToken = null;

    await vendor.save();

    return res.status(200).json({
      success: true,
      message: 'Vendor deleted successfully (soft delete)',
      data: {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        isDeleted: vendor.isDeleted,
      },
    });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete vendor',
      error: error.message,
    });
  }
};

const deleteVendorProfile = async (req, res) => {
  const id = req.user._id;

  try {
    const vendor = await Vendor.findById(id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found',
      });
    }

    // Already deleted
    if (vendor.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Vendor is already deleted',
      });
    }

    // Perform soft delete
    vendor.isDeleted = true;
    vendor.isAvailable = false;
    vendor.isOnline = false;

    // Optional: invalidate refresh token
    vendor.refreshToken = null;

    await vendor.save();

    return res.status(200).json({
      success: true,
      message: 'Vendor deleted successfully (soft delete)',
      data: {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phoneNumber: vendor.phoneNumber,
        isDeleted: vendor.isDeleted,
      },
    });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete vendor',
      error: error.message,
    });
  }
};

export {
  authenticateVendor,
  verifyOtp,
  selfIdentification,
  updatedAddress,
  updateVendorProfile,
  deleteVendor,
  deleteVendorProfile,
};
