import Joi from 'joi';

export const kycApplicationSchema = Joi.object({
  firstName: Joi.string().trim().required().messages({
    'string.empty': 'First name is required',
    'any.required': 'First name is mandatory',
  }),

  lastName: Joi.string().trim().required().messages({
    'string.empty': 'Last name is required',
    'any.required': 'Last name is mandatory',
  }),

  middleName: Joi.string().trim().allow(null, '').optional(),

  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Enter a valid email address',
    'any.required': 'Email is required',
  }),

  dob: Joi.date().required().messages({
    'date.base': 'Enter a valid date of birth',
    'any.required': 'Date of birth is required',
  }),

  // occupation: Joi.string().trim().allow(null, '').optional(),

  phoneNumber: Joi.string().required().messages({
    'string.empty': 'Phone number is required',
    'any.required': 'Phone number is mandatory',
  }),

  serviceRadius: Joi.number().positive().required().messages({
    'number.base': 'Service radius must be a number',
    'number.positive': 'Service radius must be positive',
    'any.required': 'Service radius is required',
  }),

  address: Joi.object({
    line1: Joi.string().trim().required().messages({
      'string.empty': 'Address line 1 is required',
      'any.required': 'Address line 1 is mandatory',
    }),
    line2: Joi.string().trim().allow('', null).optional(),
    street: Joi.string().trim().allow('', null).optional(),
    city: Joi.string().trim().required().messages({
      'string.empty': 'City is required',
      'any.required': 'City is mandatory',
    }),
    state: Joi.string().trim().required().messages({
      'string.empty': 'State is required',
      'any.required': 'State is mandatory',
    }),
    country: Joi.string().trim().required().messages({
      'string.empty': 'Country is required',
      'any.required': 'Country is mandatory',
    }),
    postalCode: Joi.string().trim().required().messages({
      'string.empty': 'Postal code is required',
      'any.required': 'Postal code is mandatory',
    }),
    addressType: Joi.string().valid('home', 'work', 'office', 'other').optional(),
    landmark: Joi.string().trim().allow('', null).optional(),
    location: Joi.object({
      type: Joi.string().valid('Point').required().messages({
        'any.only': 'Location type must be Point',
        'any.required': 'Location type is required',
      }),
      coordinates: Joi.array().items(Joi.number().required()).length(2).required().messages({
        'array.base': 'Coordinates must be an array of numbers',
        'array.length': 'Coordinates must have exactly two elements [longitude, latitude]',
        'any.required': 'Coordinates are required',
      }),
    })
      .required()
      .messages({
        'any.required': 'Location is required',
      }),
  })
    .required()
    .messages({
      'any.required': 'Address is required',
    }),

  primaryDocument: Joi.object({
    type: Joi.string().required().messages({
      'string.empty': 'Primary document type is required',
    }),
    number: Joi.string().required().messages({
      'string.empty': 'Primary document number is required',
    }),
    frontImage: Joi.string().uri().required().messages({
      'string.uri': 'Primary front image must be a valid URL',
      'any.required': 'Primary front image is required',
    }),
    backImage: Joi.string().uri().optional().messages({
      'string.uri': 'Primary back image must be a valid URL',
    }),
  })
    .required()
    .messages({
      'any.required': 'Primary document is required',
    }),

  secondaryDocument: Joi.object({
    type: Joi.string().required().messages({
      'string.empty': 'Secondary document type is required',
    }),
    number: Joi.string().required().messages({
      'string.empty': 'Secondary document number is required',
    }),
    frontImage: Joi.string().uri().required().messages({
      'string.uri': 'Secondary front image must be a valid URL',
      'any.required': 'Secondary front image is required',
    }),
    backImage: Joi.string().uri().optional().messages({
      'string.uri': 'Secondary back image must be a valid URL',
    }),
  }).optional(),

  selfieImage: Joi.string().uri().required().messages({
    'string.uri': 'Selfie image must be a valid URL',
    'any.required': 'Selfie image is required',
  }),
});

export const kycStatusUpdateSchema = Joi.object({});
