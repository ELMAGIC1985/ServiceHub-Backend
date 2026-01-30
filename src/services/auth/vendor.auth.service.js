import { Vendor } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { loaderService } from '../common/loader.query.service.js';
import { authService } from './auth.service.js';
import { STATUS, STEPS, USER_ROLES, VERIFICATION_STATUSES } from '../../constants/constants.js';
import mongoose from 'mongoose';

class VendorAuthClass {
  async createVendor(phoneNumber, session) {
    const vendor = new Vendor({
      phoneNumber,
      role: USER_ROLES.VENDOR,
      isVerified: false,
      isEmailVerified: false,
      isMobileVerified: false,
      isKYCVerified: false,
      isAvailable: true,
      isBlocked: false,
      currentCoordinates: {
        type: 'Point',
        coordinates: [0, 0],
      },
      isOnline: false,
      lastSeen: new Date(),
    });

    return await vendor.save({ session });
  }

  async authenticate(phoneNumber) {
    console.log('🎯 === VENDOR AUTHENTICATION START ===');
    console.log(`🔧 Mode: ${authService.getModeInfo().mode}`);

    const normalizedPhoneNumber = authService.validatePhoneInput({ phoneNumber });

    const existingVendor = await loaderService.loadVendorByPhoneNumber(normalizedPhoneNumber);

    if (existingVendor) {
      return await this.handleExistingVendorAuth(normalizedPhoneNumber);
    } else {
      return await this.handleNewVendorAuth(normalizedPhoneNumber);
    }
  }

  async handleExistingVendorAuth(phoneNumber) {
    await authService.sendOTP(phoneNumber, 'authenticate');

    console.log('✅ Login OTP sent for existing vendor');

    return {
      statusCode: STATUS.OK,
      data: {
        action: 'LOGIN',
        nextStep: 'OTP_VERIFICATION',
        redirectUrl: '/verify-otp',
        phoneNumber,
        isExistingVendor: true,
        ...(authService.getModeInfo().isDevelopment && {
          devMessage: `[DEV MODE] Use OTP: ${authService.getModeInfo().devOtp}`,
        }),
      },
      message: authService.getModeInfo().isDevelopment
        ? 'Login OTP ready. Use hardcoded OTP for verification in development mode.'
        : 'Login OTP sent successfully. Please check your phone for the verification code.',
    };
  }

  async handleNewVendorAuth(phoneNumber) {
    const session = await mongoose.startSession();
    session.startTransaction();

    let newVendor;

    try {
      newVendor = await this.createVendor(phoneNumber, session);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
    }

    session.endSession();

    await authService.sendOTP(phoneNumber, 'authenticate');

    const vendorResponse = await Vendor.findById(newVendor._id).select('-password -refreshToken -__v').lean();

    console.log('🎯 === VENDOR REGISTRATION SUCCESS ===');

    return {
      statusCode: STATUS.CREATED,
      data: {
        id: vendorResponse._id,
        action: 'REGISTER',
        nextStep: 'OTP_VERIFICATION',
        redirectUrl: '/verify-otp',
        phoneNumber,
        isExistingVendor: false,
        ...(authService.getModeInfo().isDevelopment && {
          devMessage: `[DEV MODE] Use OTP: ${authService.getModeInfo().devOtp}`,
        }),
      },
      message: authService.getModeInfo().isDevelopment
        ? 'Vendor registration successful. Use hardcoded OTP for verification in development mode.'
        : 'Vendor registration successful. Please check your phone for the verification code.',
    };
  }

  async verifyOTP(phoneNumber, otp) {
    console.log('🎯 === OTP VERIFICATION START ===');
    console.log(`🔧 Mode: ${authService.getModeInfo().mode}`);

    const normalizedPhoneNumber = authService.validatePhoneInput({ phoneNumber });
    console.log('🔧 Verifying OTP for phone:', normalizedPhoneNumber);
    console.log('🔧 Provided OTP:', otp);

    const vendor = await loaderService.loadVendorByPhoneNumber(normalizedPhoneNumber);

    const verificationResult = await authService.verifyOTP(normalizedPhoneNumber, otp, 'authenticate');

    const isRegistrationVerification = !vendor.isMobileVerified;

    if (isRegistrationVerification) {
      return await this.handleRegistrationVerification(vendor);
    } else {
      return await this.handleLoginVerification(vendor);
    }
  }

  async handleRegistrationVerification(vendor) {
    console.log('🔧 Processing registration verification');

    vendor.isMobileVerified = true;
    vendor.isVerified = true;
    await vendor.save();

    console.log('✅ Registration verification completed');

    const vendorResponse = await Vendor.findById(vendor._id).select('-password -refreshToken -__v').lean();

    const tokenResult = await authService.generateAndSaveTokens(vendor);

    if (!tokenResult) {
      throw new ApiError(500, 'Login verification successful but token generation failed. Please try again.');
    }

    return {
      statusCode: 200,
      data: {
        vendor: vendorResponse,
        accessToken: tokenResult.accessToken,
        tokenType: 'Bearer',
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        action: 'REGISTRATION_COMPLETE',
        nextStep: vendor.kycStatus === VERIFICATION_STATUSES.INCOMPLETE ? STEPS.COMPLETE_KYC : 'COMPLETE',
        isVerified: true,
        ...(authService.getModeInfo().isDevelopment && { devMode: true }),
      },
      message: authService.getModeInfo().isDevelopment
        ? 'Registration verification successful (dev mode). Vendor account activated.'
        : 'Registration verification successful. Vendor account activated.',
      cookies: {
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
      },
    };
  }

  async handleLoginVerification(vendor) {
    console.log('🔧 Processing login verification');

    const tokenResult = await authService.generateAndSaveTokens(vendor);
    if (!tokenResult) {
      throw new ApiError(500, 'Login verification successful but token generation failed. Please try again.');
    }

    const vendorResponse = await Vendor.findById(vendor._id)
      .select('-password -refreshToken -__v')
      .populate('address')
      .populate('wallet')
      // .lean();

    console.log('✅ Login verification completed');

    return {
      statusCode: 200,
      data: {
        vendor: vendorResponse,
        accessToken: tokenResult.accessToken,
        tokenType: 'Bearer',
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
        action: 'LOGIN_COMPLETE',
        ...(authService.getModeInfo().isDevelopment && { devMode: true }),
      },
      message: authService.getModeInfo().isDevelopment
        ? 'Login successful (dev mode). Vendor authenticated via OTP.'
        : 'Login successful. Vendor authenticated via OTP.',
      cookies: {
        accessToken: tokenResult.accessToken,
        refreshToken: tokenResult.refreshToken,
      },
    };
  }
}

const vendorAuthService = new VendorAuthClass();

export { vendorAuthService };
