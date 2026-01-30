import Joi from 'joi';

const baseRatingSchema = {
  itemId: Joi.string().required(),
  itemType: Joi.string().valid('Product', 'Booking', 'Vendor').required(),
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
      })
    )
    .optional()
    .default([]),
};

export const bookingRatingSchema = Joi.object({
  ...baseRatingSchema,
  itemType: Joi.string().valid('Booking').required(),
  sourceId: Joi.string().required(),
  sourceType: Joi.string().valid('Booking').required(),
});

export const productRatingSchema = Joi.object({
  ...baseRatingSchema,
  itemType: Joi.string().valid('Product').required(),
  sourceId: Joi.string().required(),
  sourceType: Joi.string().valid('Order', 'Booking').required(),
  verifiedPurchase: Joi.boolean().default(true),
});

export const vendorRatingSchema = Joi.object({
  ...baseRatingSchema,
  itemType: Joi.string().valid('Vendor').required(),
  // vendorId: Joi.string().required(),
  sourceId: Joi.string().optional().allow(null, ''),
  sourceType: Joi.string().valid('Booking').required(),
});

export const ratingValidationSchema = Joi.object({
  itemId: Joi.string().required(),
  itemType: Joi.string().valid('Product', 'Booking', 'Vendor').required(),
  orderId: Joi.string().optional().allow(null, ''),
  rating: Joi.number().min(1).max(5).required(),
  comment: Joi.string().allow('', null),
  helpfulCount: Joi.number().integer().min(0).optional(),
  notHelpfulCount: Joi.number().integer().min(0).optional(),
  verifiedPurchase: Joi.boolean().optional(),
  sentimentScore: Joi.number().min(-1).max(1).optional(),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
      })
    )
    .optional()
    .default([]),
});
