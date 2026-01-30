import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName: Joi.string().trim().min(2).max(50),
  middleName: Joi.string().trim().allow('', null),

  email: Joi.string().email().optional().allow('',null).messages({
    'string.email': 'Invalid email format',
  }),

  // phoneNumber: Joi.string()
  //   .pattern(/^\+?[\d\s\-\(\)]{10,}$/)
  //   .messages({ 'string.pattern.base': 'Invalid phone number format' }),

  dob: Joi.date().less('now').messages({
    'date.less': 'Date of birth cannot be in the future',
  }),

  avatar: Joi.string().uri().allow('', null).messages({
    'string.uri': 'Avatar must be a valid URL',
  }),

  fcmToken: Joi.object({
    token: Joi.string().required(),
    deviceId: Joi.string().required(),
    platform: Joi.string().valid('ios', 'android').optional(),
    deviceName: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
  }).optional(),
});

export const restrictedFields = [
  'refreshToken',
  'isVerified',
  'isEmailVerified',
  'isMobileVerified',
  'referralCode',
  'referredBy',
  'referredUsers',
  'referralReward',
  'googleId',
  'facebookId',
  'socketId',
  'bookings',
  'wallet',
  'membership',
  'coupons',
  'role',
];
