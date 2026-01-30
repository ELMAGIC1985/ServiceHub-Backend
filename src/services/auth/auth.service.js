import { IS_DEV_MODE, DEV_OTP, STATUS, testVendorPhoneNumber } from '../../constants/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { phoneNumberSchema } from '../../validators/auth.validation.js';
import otpService from '../otp/phoneOtpService.js';

class AuthClass {
  async generateAndSaveTokens(user) {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    user.lastSeen = new Date();
    user.isOnline = true;

    await user.save({ validateBeforeSave: false });

    return {
      accessToken,
      refreshToken,
    };
  }

  async sendOTP(phoneNumber, purpose = 'authenticate') {
    if (IS_DEV_MODE) {
      console.log(`🔧 [DEV MODE] Simulating OTP send for ${purpose}`);
      return {
        success: true,
        message: 'OTP sent successfully',
        phoneNumber,
        expiresIn: 300,
        messageId: `dev-${purpose}-${Date.now()}`,
      };
    } else if (!IS_DEV_MODE && phoneNumber === testVendorPhoneNumber) {
      console.log(`🔧 [DEV MODE] Simulating OTP send for ${purpose}`);
      return {
        success: true,
        message: 'OTP sent successfully',
        phoneNumber,
        expiresIn: 300,
        messageId: `dev-${purpose}-${Date.now()}`,
      };
    }

    console.log(`🔧 [PROD MODE] Sending actual OTP via SMS for ${purpose}`);
    return otpService.sendOTP(phoneNumber, purpose);
  }

  async verifyOTP(phoneNumber, otp, purpose = 'authenticate') {
    if (IS_DEV_MODE) {
      console.log('🔧 [DEV MODE] Checking against hardcoded OTP');

      if (otp !== DEV_OTP) {
        throw new ApiError(STATUS.UNAUTHORIZED, `Invalid OTP. Use ${DEV_OTP} for development mode.`);
      }

      console.log('✅ [DEV MODE] Hardcoded OTP verification successful');
      return {
        phoneNumber,
        purpose,
      };
    } else if (!IS_DEV_MODE && phoneNumber === testVendorPhoneNumber) {
      console.log('🔧 [DEV MODE] Checking against hardcoded OTP');

      if (otp !== DEV_OTP) {
        throw new ApiError(STATUS.UNAUTHORIZED, `Invalid OTP. Use ${DEV_OTP} for development mode.`);
      }

      console.log('✅ [DEV MODE] Hardcoded OTP verification successful');
      return {
        phoneNumber,
        purpose,
      };
    }

    console.log('🔧 [PROD MODE] Verifying OTP via service');

    const result = await otpService.verifyOTP(phoneNumber, otp, purpose);

    if (!result.success) {
      throw new ApiError(STATUS.UNAUTHORIZED, result.error || 'Otp verification failed');
    }

    console.log('✅ [PROD MODE] Service OTP verification successful');

    return result;
  }

  validatePhoneInput(phoneNumber) {
    const { error, value } = phoneNumberSchema.validate(phoneNumber);

    if (error) {
      throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Invalid number');
    }

    return value.phoneNumber;
  }

  getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 10 * 24 * 60 * 60 * 1000,
    };
  }

  getModeInfo() {
    return {
      isDevelopment: IS_DEV_MODE,
      mode: IS_DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
      devOtp: IS_DEV_MODE ? DEV_OTP : undefined,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  debugOtpCache(phoneNumber = null) {
    if (!IS_DEV_MODE) {
      throw new ApiError(404, 'Debug endpoint not available in production');
    }

    otpService.debugCache();

    const debugInfo = {
      mode: 'DEVELOPMENT',
      devOtp: DEV_OTP,
      cacheKeys: otpService.otpCache.keys(),
    };

    if (phoneNumber) {
      debugInfo.phoneData = otpService.otpCache.get(normalized);
    }

    return debugInfo;
  }

  getProfileStatus(user, requiredFields) {
    const missingFields = requiredFields
      .filter((field) => {
        const value = user[field.key];

        if (!value) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        if (Array.isArray(value) && value.length === 0) return true;

        return false;
      })
      .map((field) => field.label);

    const completionPercentage = ((requiredFields.length - missingFields.length) / requiredFields.length) * 100;

    return {
      profileCompleted: missingFields.length === 0,
      completionPercentage: Math.round(completionPercentage),
      missingFields,
    };
  }
}

const authService = new AuthClass();

export { authService };
