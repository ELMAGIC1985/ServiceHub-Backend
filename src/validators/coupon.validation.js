import Joi from 'joi';

export const couponUpdateSchema = Joi.object({
  code: Joi.string().min(3).max(50).optional(),
  discountType: Joi.string().valid('percentage', 'fixed').optional(),
  discountValue: Joi.number().min(0.01).optional(),
  minPurchase: Joi.number().min(0).optional(),
  maxDiscount: Joi.number().min(0).optional(),
  expiryDate: Joi.date().iso().optional(),
  usageLimit: Joi.number().integer().min(1).optional(),
  appliesTo: Joi.string().valid('Product', 'ServiceTemplate').optional(),
});
