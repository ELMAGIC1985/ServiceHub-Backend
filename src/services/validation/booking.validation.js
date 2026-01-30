import Joi from 'joi';

const addressSchema = Joi.object({
  line1: Joi.string().required(),
  line2: Joi.string().allow('').optional(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  pincode: Joi.string()
    .pattern(/^\d{6}$/)
    .required(), // Validates a 6-digit PIN code
  addressType: Joi.string().valid('home', 'work', 'other').required(),
  googleMapUrl: Joi.string().uri().required(), // Ensures it's a valid URL
  location: Joi.object({
    type: Joi.string().valid('Point').required(), // Ensures type is "Point"
    coordinates: Joi.array()
      .items(Joi.number().min(-90).max(90), Joi.number().min(-180).max(180)) // Latitude, Longitude validation
      .length(2)
      .required(),
  }).required(),
});

const bookingValidateSchema = Joi.object({
  serviceDescription: Joi.array().items(Joi.string()).optional(), // Array of strings
  userId: Joi.string().hex().length(24).required(), // MongoDB ObjectId
  childrenCategoryId: Joi.string().hex().length(24).required(), // MongoDB ObjectId
  vendorId: Joi.string().hex().length(24).optional(), // MongoDB ObjectId
  product: Joi.string().hex().length(24).optional(), // MongoDB ObjectId
  date: Joi.date().required(),
  timeSlot: Joi.string().required(),
  address: addressSchema.required(), // Validates the full address object
  status: Joi.string().valid('pending', 'confirmed', 'completed', 'canceled').default('pending'),
  paymentStatus: Joi.string().valid('unpaid', 'paid', 'refunded', 'failed', 'pending').default('pending'),
});

export { bookingValidateSchema };
