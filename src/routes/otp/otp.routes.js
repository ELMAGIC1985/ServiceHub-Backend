import express from 'express';
import { body, validationResult } from 'express-validator';
import { createOTPRateLimit, createVerifyRateLimit, OTPService } from '../../services/otp/phoneOtpService.js';

const router = express.Router();
const otpService = new OTPService();

const sendOTPRateLimit = createOTPRateLimit();
const verifyOTPRateLimit = createVerifyRateLimit();

const validateSendOTP = [
  body('phoneNumber')
    .isLength({ min: 10, max: 15 })
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian mobile number'),
  body('purpose')
    .optional()
    .isIn(['verification', 'login', 'password_reset', 'registration'])
    .withMessage('Invalid purpose. Allowed values: verification, login, password_reset, registration'),
];

const validateVerifyOTP = [
  body('phoneNumber')
    .isLength({ min: 10, max: 15 })
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit Indian mobile number'),
  body('otp').isLength({ min: 4, max: 8 }).isNumeric().withMessage('OTP must be a 4-8 digit number'),
  body('purpose')
    .optional()
    .isIn(['verification', 'login', 'password_reset', 'registration'])
    .withMessage('Invalid purpose'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

router.post('/send', validateSendOTP, async (req, res) => {
  try {
    const { phoneNumber, purpose = 'verification' } = req.body;

    console.log(`OTP send request - Phone: ${phoneNumber}, Purpose: ${purpose}, IP: ${req.ip}`);

    const result = await otpService.sendOTP(phoneNumber, purpose);

    // Log successful OTP send (without OTP value for security)
    console.log(`OTP sent successfully to ${result.phoneNumber}, MessageID: ${result.messageId}`);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        phoneNumber: result.phoneNumber,
        expiresIn: result.expiresIn,
        messageId: result.messageId,
        purpose,
      },
    });
  } catch (error) {
    console.error('Send OTP error:', error.message, 'IP:', req.ip);

    // Return appropriate error status codes
    let statusCode = 500;
    if (error.message.includes('Rate limit') || error.message.includes('wait')) {
      statusCode = 429;
    } else if (error.message.includes('Invalid phone number')) {
      statusCode = 400;
    } else if (error.message.includes('SMS service')) {
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
      errorCode: getErrorCode(error.message),
    });
  }
});

router.post('/verify', validateVerifyOTP, handleValidationErrors, async (req, res) => {
  try {
    const { phoneNumber, otp, purpose = 'verification' } = req.body;

    console.log(`OTP verify request - Phone: ${phoneNumber}, Purpose: ${purpose}, IP: ${req.ip}`);

    const result = await otpService.verifyOTP(phoneNumber, otp, purpose);

    if (result.success) {
      console.log(`OTP verified successfully for ${result.phoneNumber}`);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          phoneNumber: result.phoneNumber,
          purpose: result.purpose,
          verifiedAt: new Date().toISOString(),
        },
      });
    } else {
      console.log(`OTP verification failed for ${phoneNumber}: ${result.error}`);

      res.status(400).json({
        success: false,
        error: result.error,
        errorCode: result.errorCode,
        remainingAttempts: result.remainingAttempts,
      });
    }
  } catch (error) {
    console.error('Verify OTP error:', error.message, 'IP:', req.ip);

    res.status(500).json({
      success: false,
      error: 'Internal server error during OTP verification',
      errorCode: 'INTERNAL_ERROR',
    });
  }
});

function getErrorCode(errorMessage) {
  const errorMap = {
    'Rate limit exceeded': 'RATE_LIMIT_EXCEEDED',
    'Please wait': 'COOLDOWN_ACTIVE',
    'Daily limit exceeded': 'DAILY_LIMIT_EXCEEDED',
    'Invalid phone number': 'INVALID_PHONE_NUMBER',
    'SMS service timeout': 'SMS_SERVICE_TIMEOUT',
    'SMS service error': 'SMS_SERVICE_ERROR',
    'Failed to send SMS': 'SMS_SEND_FAILED',
  };

  for (const [key, code] of Object.entries(errorMap)) {
    if (errorMessage.includes(key)) {
      return code;
    }
  }

  return 'UNKNOWN_ERROR';
}

export default router;
