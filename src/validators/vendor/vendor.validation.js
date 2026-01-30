import Joi from 'joi';

export const updateVendorProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50),
  lastName: Joi.string().trim().min(2).max(50),
  middleName: Joi.string().trim().max(50).allow('', null),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  email: Joi.string().email().trim().lowercase(),
  dob: Joi.string(),
  purpose: Joi.string().trim().max(500),
  serviceRadius: Joi.number().min(1).max(100),
  documentType: Joi.string().valid('passport', 'driving_license', 'national_id', 'voter_id', 'aadhaar'),
}).unknown(false);

export const vendorManagementSchema = Joi.object({
  vendorId: Joi.string().required(),
  isOnline: Joi.boolean().optional(),
  isBlocked: Joi.boolean().optional(),
  isDeleted: Joi.boolean().optional(),
});
