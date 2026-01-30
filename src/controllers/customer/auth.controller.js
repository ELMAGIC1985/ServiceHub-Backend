import mongoose from 'mongoose';
import { ApiResponse, asyncHandler, logger } from '../../utils/index.js';
import otpService from '../../services/otp/phoneOtpService.js';
import { formatMembershipData } from './utils/helpers.js';
import { Membership, MembershipPlan, User } from '../../models/index.js';
import { IS_DEV_MODE, testUserPhoneNumber, DEV_OTP } from '../../constants/constants.js';

const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

const authenticateUser = asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  logger.info('🎯 === USER AUTHENTICATION START ===');
  logger.info(`🔧 Mode: ${IS_DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION'}`);

  // Input validation
  const validationErrors = validatePhoneInput({ phoneNumber });
  if (validationErrors.length > 0) {
    return res.status(400).json(new ApiResponse(400, null, validationErrors));
  }

  const normalizedPhoneNumber = phoneNumber.trim().replace(/\D/g, '');
  logger.info('🔧 Auth - Original phone:', phoneNumber);
  logger.info('🔧 Auth - Normalized phone:', normalizedPhoneNumber);

  try {
    const existingUser = await User.findOne({
      phoneNumber: normalizedPhoneNumber,
    });

    if (existingUser) {
      // EXISTING USER - Login Flow
      logger.info('🔧 Existing user found, proceeding with login flow');

      // Handle OTP sending based on mode
      let otpResult;
      if (IS_DEV_MODE) {
        logger.info('🔧 [DEV MODE] Using hardcoded OTP for login:', DEV_OTP);
        // In dev mode, simulate OTP sending without actual SMS
        otpResult = {
          success: true,
          message: 'OTP sent successfully',
          phoneNumber: normalizedPhoneNumber,
          expiresIn: 300,
          messageId: 'dev-login-' + Date.now(),
        };
      } else if (!IS_DEV_MODE && phoneNumber === testUserPhoneNumber) {
        logger.info('🔧 [DEV MODE] Using hardcoded OTP for login:', DEV_OTP);
        // In dev mode, simulate OTP sending without actual SMS
        otpResult = {
          success: true,
          message: 'OTP sent successfully',
          phoneNumber: normalizedPhoneNumber,
          expiresIn: 300,
          messageId: 'dev-login-' + Date.now(),
        };
      } else {
        logger.info('🔧 [PROD MODE] Sending actual login OTP via SMS');
        otpResult = otpService.sendOTP(normalizedPhoneNumber, 'authenticate');
      }

      return res.status(200).json(
        new ApiResponse(
          200,
          {
            action: 'LOGIN',
            nextStep: 'OTP_VERIFICATION',
            redirectUrl: '/verify-otp',
            phoneNumber: normalizedPhoneNumber,
            isExistingUser: true,
            ...(IS_DEV_MODE && { devMessage: `[DEV MODE] Use OTP: ${DEV_OTP}` }),
          },
          IS_DEV_MODE
            ? 'Login OTP ready. Use hardcoded OTP for verification in development mode.'
            : 'Login OTP sent successfully. Please check your phone for the verification code.'
        )
      );
    } else {
      // NEW USER - Registration Flow
      logger.info('🔧 New user, proceeding with registration flow');

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const newUser = await createNewUser({ phoneNumber: normalizedPhoneNumber }, req, session);

        // Handle OTP sending based on mode
        let otpResult;
        if (IS_DEV_MODE) {
          logger.info('🔧 [DEV MODE] Using hardcoded OTP for registration:', DEV_OTP);
          // In dev mode, simulate OTP sending without actual SMS
          otpResult = {
            success: true,
            message: 'OTP sent successfully',
            phoneNumber: normalizedPhoneNumber,
            expiresIn: 300,
            messageId: 'dev-register-' + Date.now(),
          };
        } else if (!IS_DEV_MODE && phoneNumber === testUserPhoneNumber) {
          logger.info('🔧 [DEV MODE] Using hardcoded OTP for registration:', DEV_OTP);
          // In dev mode, simulate OTP sending without actual SMS
          otpResult = {
            success: true,
            message: 'OTP sent successfully',
            phoneNumber: normalizedPhoneNumber,
            expiresIn: 300,
            messageId: 'dev-register-' + Date.now(),
          };
        } else {
          logger.info('🔧 [PROD MODE] Sending actual registration OTP via SMS');
          otpResult = otpService.sendOTP(normalizedPhoneNumber, 'authenticate');
        }

        await session.commitTransaction();

        const userResponse = await User.findById(newUser._id).select('-refreshToken -__v').lean();

        logger.info('🎯 === USER REGISTRATION SUCCESS ===');

        return res.status(201).json(
          new ApiResponse(
            201,
            {
              id: userResponse._id,
              action: 'REGISTER',
              nextStep: 'OTP_VERIFICATION',
              redirectUrl: '/verify-otp',
              phoneNumber: normalizedPhoneNumber,
              isExistingUser: false,
              ...(IS_DEV_MODE && { devMessage: `[DEV MODE] Use OTP: ${DEV_OTP}` }),
            },
            IS_DEV_MODE
              ? 'User registration successful. Use hardcoded OTP for verification in development mode.'
              : 'User registration successful. Please check your phone for the verification code.'
          )
        );
      } catch (transactionError) {
        await session.abortTransaction();
        throw transactionError;
      } finally {
        session.endSession();
      }
    }
  } catch (error) {
    logger.error('❌ User authentication error:', error);
    return handleAuthError(error, res);
  }
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  logger.info('🎯 === USER OTP VERIFICATION START ===');
  logger.info(`🔧 Mode: ${IS_DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION'}`);

  if (!phoneNumber || !otp) {
    return res.status(400).json(new ApiResponse(400, null, 'Phone number and OTP are required'));
  }

  try {
    const normalizedPhoneNumber = phoneNumber.trim().replace(/\D/g, '');
    logger.info('🔧 Verifying OTP for phone:', normalizedPhoneNumber);
    logger.info('🔧 Provided OTP:', otp);

    // Find user
    const user = await User.findOne({ phoneNumber: normalizedPhoneNumber });

    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, 'User not found for this phone number'));
    }

    // Handle OTP verification
    let verificationResult;
    if (IS_DEV_MODE) {
      logger.info('🔧 [DEV MODE] Checking against hardcoded OTP');
      if (otp !== DEV_OTP) {
        return res.status(401).json(new ApiResponse(401, null, `Invalid OTP. Use ${DEV_OTP} for development mode.`));
      }

      verificationResult = {
        success: true,
        message: 'OTP verified successfully (dev mode)',
        phoneNumber: normalizedPhoneNumber,
        purpose: 'verification',
      };

      logger.info('✅ [DEV MODE] Hardcoded OTP verification successful');
    } else if (!IS_DEV_MODE && phoneNumber === testUserPhoneNumber) {
      logger.info('🔧 [DEV MODE] Checking against hardcoded OTP');
      if (otp !== DEV_OTP) {
        return res.status(401).json(new ApiResponse(401, null, `Invalid OTP. Use ${DEV_OTP} for development mode.`));
      }

      verificationResult = {
        success: true,
        message: 'OTP verified successfully (dev mode)',
        phoneNumber: normalizedPhoneNumber,
        purpose: 'verification',
      };

      logger.info('✅ [DEV MODE] Hardcoded OTP verification successful');
    } else {
      logger.info('🔧 [PROD MODE] Verifying OTP via service');
      verificationResult = await otpService.verifyOTP(normalizedPhoneNumber, otp, 'authenticate');

      if (!verificationResult.success) {
        return res.status(401).json(new ApiResponse(401, null, verificationResult.error));
      }

      logger.info('✅ [PROD MODE] Service OTP verification successful');
    }

    // Determine if this is registration or login verification
    const isRegistrationVerification = !user.isMobileVerified;

    // Generate tokens for both registration and login
    const tokenResult = await generateAndSaveTokens(user);

    if (!tokenResult.success) {
      return res
        .status(500)
        .json(new ApiResponse(500, null, 'OTP verification successful but token generation failed. Please try again.'));
    }

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };

    // Fetch latest user with populated data
    const userResponse = await User.findById(user._id)
      .select('-refreshToken -__v')
      .populate('address')
      .populate('wallet')
      .populate('membership')
      .lean();

    let membershipData = null;
    if (userResponse?.membership) {
      const membership = await Membership.findById(userResponse.membership);
      const plan = membership ? await MembershipPlan.findById(membership.planId) : null;
      membershipData = formatMembershipData(membership, plan);
      delete userResponse.membership;
    }

    // 🔹 Generate profile completion status
    const profileStatus = getProfileStatus(userResponse);

    if (isRegistrationVerification) {
      // REGISTRATION VERIFICATION
      logger.info('🔧 Processing user registration verification');
      user.isMobileVerified = true;
      user.isVerified = true;
      await user.save();

      logger.info('✅ User registration verification completed');

      return res
        .status(200)
        .cookie('accessToken', tokenResult.accessToken, cookieOptions)
        .cookie('refreshToken', tokenResult.refreshToken, cookieOptions)
        .json(
          new ApiResponse(
            200,
            {
              user: {
                ...userResponse,
                membership: membershipData,
                profileCompleted: profileStatus?.profileCompleted,
                missingFields: profileStatus?.missingFields,
              },
              accessToken: tokenResult.accessToken,
              tokenType: 'Bearer',
              expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
              action: 'REGISTRATION_COMPLETE',
              nextStep: 'COMPLETE',
              isVerified: true,
              ...(IS_DEV_MODE && { devMode: true }),
            },
            IS_DEV_MODE
              ? 'Registration verification successful (dev mode). User account activated and authenticated.'
              : 'Registration verification successful. User account activated and authenticated.'
          )
        );
    } else {
      // LOGIN VERIFICATION
      logger.info('🔧 Processing user login verification');
      logger.info('✅ User login verification completed');

      return res
        .status(200)
        .cookie('accessToken', tokenResult.accessToken, cookieOptions)
        .cookie('refreshToken', tokenResult.refreshToken, cookieOptions)
        .json(
          new ApiResponse(
            200,
            {
              user: {
                ...userResponse,
                membership: membershipData,
                profileCompleted: profileStatus?.profileCompleted,
                missingFields: profileStatus?.missingFields,
              },
              accessToken: tokenResult.accessToken,
              tokenType: 'Bearer',
              expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
              action: 'LOGIN_COMPLETE',
              ...(IS_DEV_MODE && { devMode: true }),
            },
            IS_DEV_MODE
              ? 'Login successful (dev mode). User authenticated via OTP.'
              : 'Login successful. User authenticated via OTP.'
          )
        );
    }
  } catch (error) {
    logger.error('❌ User OTP verification error:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Error verifying OTP'));
  }
});

const getProfileStatus = (user) => {
  const requiredFields = [
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phoneNumber', label: 'Phone Number' },
  ];

  const missingFields = requiredFields
    .filter((field) => {
      const value = user[field.key];

      if (!value) return true;

      if (typeof value === 'string' && value.trim() === '') return true;

      // 3. If it's an array and EMPTY → missing
      if (Array.isArray(value) && value.length === 0) return true;

      return false; // Field is filled correctly
    })
    .map((field) => field.label);

  const completionPercentage = ((requiredFields.length - missingFields.length) / requiredFields.length) * 100;

  return {
    profileCompleted: missingFields.length === 0,
    completionPercentage: Math.round(completionPercentage),
    missingFields,
  };
};

// ============ DEVELOPMENT MODE UTILITIES ============
// Additional endpoint for development debugging (only works in dev mode)
const debugOtpCache = asyncHandler(async (req, res) => {
  if (!IS_DEV_MODE) {
    return res.status(404).json(new ApiResponse(404, null, 'Endpoint not available in production'));
  }

  const { phoneNumber } = req.query;

  try {
    // Debug cache contents
    otpService.debugCache();

    const debugInfo = {
      mode: 'DEVELOPMENT',
      devOtp: DEV_OTP,
      cacheKeys: otpService.otpCache.keys(),
      ...(phoneNumber && {
        phoneData: otpService.otpCache.get(phoneNumber.trim().replace(/\D/g, '')),
      }),
    };

    return res.status(200).json(new ApiResponse(200, debugInfo, 'Debug information retrieved'));
  } catch (error) {
    logger.error('❌ Debug error:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Error retrieving debug information'));
  }
});

// ============ HELPER FUNCTIONS ============

// Helper function to create new user
const createNewUser = async (normalizedData, req, session) => {
  const user = new User({
    phoneNumber: normalizedData.phoneNumber,
    role: USER_ROLES.USER,
    isVerified: false,
    isEmailVerified: false,
    isMobileVerified: false,
  });

  return await user.save({ session });
};

// Helper function to generate and save tokens
const generateAndSaveTokens = async (user) => {
  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Update refresh token in database
    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false }); // Skip validation since we're only updating tokens

    return {
      success: true,
      accessToken,
      refreshToken,
    };
  } catch (error) {
    logger.error('Error generating and saving tokens:', error);
    return { success: false, error: error.message };
  }
};

// Helper function for input validation
const validatePhoneInput = (data) => {
  const errors = [];
  const { phoneNumber } = data;

  // Required field validation
  if (!phoneNumber || !phoneNumber.trim()) {
    errors.push({ field: 'phoneNumber', message: 'Phone number is required' });
  }

  // Format validation
  if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    errors.push({
      field: 'phoneNumber',
      message: 'Please provide a valid Indian mobile number (10 digits starting with 6-9)',
    });
  }

  return errors;
};

// Validation utility function for Indian mobile numbers
const isValidPhoneNumber = (phoneNumber) => {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  const indianMobileRegex = /^[6-9]\d{9}$/;
  return indianMobileRegex.test(cleanNumber);
};

const handleAuthError = (error, res) => {
  if (error.name === 'ValidationError') {
    const validationErrors = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));

    return res
      .status(400)
      .json(new ApiResponse(400, null, 'Authentication failed due to validation errors', validationErrors));
  }

  // Handle MongoDB duplicate key errors
  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern)[0];
    const fieldName =
      duplicateField === 'email' ? 'email address' : duplicateField === 'phoneNumber' ? 'phone number' : duplicateField;

    return res.status(409).json(new ApiResponse(409, null, `An account with this ${fieldName} already exists`));
  }

  // Handle network/timeout errors
  if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return res.status(503).json(new ApiResponse(503, null, 'Service temporarily unavailable. Please try again later.'));
  }

  // Generic server error
  return res
    .status(500)
    .json(
      new ApiResponse(
        500,
        null,
        'Authentication failed due to a server error. Please try again or contact support if the problem persists.'
      )
    );
};

// ============ MODE CONFIGURATION INFO ============
const getModeInfo = () => ({
  isDevelopment: IS_DEV_MODE,
  mode: IS_DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION',
  devOtp: IS_DEV_MODE ? DEV_OTP : undefined,
  environment: process.env.NODE_ENV || 'development',
});

export {
  authenticateUser,
  verifyOtp,
  debugOtpCache, // Only available in dev mode
  getModeInfo,
  IS_DEV_MODE,
};
