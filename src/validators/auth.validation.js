import Joi from 'joi';

export const phoneNumberSchema = Joi.object({
  phoneNumber: Joi.string()
    .trim()
    .pattern(/^(\+91|91)?[6-9][0-9]{9}$/)
    .required()
    .messages({
      'string.empty': 'Phone number is required',
      'string.pattern.base': 'Invalid Indian phone number format',
    }),
});
