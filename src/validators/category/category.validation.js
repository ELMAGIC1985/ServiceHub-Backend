import Joi from 'joi';

export const categorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    'string.empty': 'Category name is required',
    'string.min': 'Category name must have at least 2 characters',
    'string.max': 'Category name cannot exceed 50 characters',
    'any.required': 'Category name is required',
  }),

  description: Joi.string().trim().min(10).max(300).required().messages({
    'string.empty': 'Description is required',
    'string.min': 'Description must be at least 10 characters',
    'string.max': 'Description cannot exceed 300 characters',
    'any.required': 'Description is required',
  }),

  type: Joi.string().valid('service', 'product').required().messages({
    'any.only': "Type must be either 'service' or 'product'",
    'any.required': 'Category type is required',
  }),

  parentCategory: Joi.string()
    .allow(null, '')
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Parent category must be a valid Mongo ObjectId',
    }),

  image: Joi.string().trim().uri().required().messages({
    'string.empty': 'Image URL is required',
    'string.uri': 'Image must be a valid URL',
    'any.required': 'Image URL is required',
  }),

  sortOrder: Joi.number().default(0),

  isFeatured: Joi.boolean().default(false),
}).options({ stripUnknown: true });

export const categoryUpdateSchema = Joi.object({
  name: Joi.string().trim().optional(),
  description: Joi.string().trim().optional(),
  type: Joi.string().valid('service', 'product').optional(),
  parentCategory: Joi.string().optional().allow(null, ''),
  image: Joi.string().optional(),
  isFeatured: Joi.boolean().optional(),
});
