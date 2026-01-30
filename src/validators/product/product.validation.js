import Joi from 'joi';

export const addProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  shortDescription: Joi.string().allow(''),
  price: Joi.number().required(),
  discountPrice: Joi.number().optional(),
  discountPercentage: Joi.number().optional(),
  category: Joi.string().required(),
  inventoryCount: Joi.number().optional(),
  stock: Joi.number().required(),
  sku: Joi.string().required(),
  isActive: Joi.boolean().optional(),
  isFeatured: Joi.boolean().optional(),
  status: Joi.string().valid('inStock', 'outOfStock', 'discontinued').optional(),
  visibility: Joi.string().valid('public', 'private').optional(),
  manufacturer: Joi.object({
    name: Joi.string().required(),
    brand: Joi.string().required(),
    generalDescription: Joi.string().optional(),
    generalShortDescription: Joi.string().optional(),
  }).required(),
  productImages: Joi.array().items(Joi.string()).optional(),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().required(),
        altText: Joi.string().allow(''),
        isMainImage: Joi.boolean().optional(),
      })
    )
    .optional(),
  keywords: Joi.array().items(Joi.string()).optional(),
});
