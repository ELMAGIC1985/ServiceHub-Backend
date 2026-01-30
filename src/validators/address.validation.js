import Joi from 'joi';

export const addressValidationSchema = Joi.object({
  line1: Joi.string().trim().required().messages({
    'any.required': 'Line1 is required',
  }),

  line2: Joi.string().trim().allow('').optional(),
  street: Joi.string().trim().allow('').optional(),

  city: Joi.string().trim().required().messages({
    'any.required': 'City is required',
  }),

  state: Joi.string().trim().required().messages({
    'any.required': 'State is required',
  }),

  country: Joi.string().trim().required().messages({
    'any.required': 'Country is required',
  }),

  postalCode: Joi.string().trim().required().messages({
    'any.required': 'Postal code is required',
  }),

  landmark: Joi.string().allow('').optional(),

  addressType: Joi.string().valid('home', 'work', 'office', 'other').default('other').messages({
    'any.only': 'Invalid address type. Must be one of: home, work, office, other',
  }),

  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: Joi.array()
      .items(
        Joi.number().messages({
          'number.base': 'Location coordinates must be valid numbers [longitude, latitude]',
        })
      )
      .length(2)
      .custom(([lng, lat], helpers) => {
        if (lng < -180 || lng > 180) {
          return helpers.error('any.invalid', { message: 'Longitude must be between -180 and 180' });
        }
        if (lat < -90 || lat > 90) {
          return helpers.error('any.invalid', { message: 'Latitude must be between -90 and 90' });
        }
        return [lng, lat];
      })
      .optional(),
  }).optional(),
});
