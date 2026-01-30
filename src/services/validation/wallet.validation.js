import Joi from 'joi'

const walletValidationSchema = Joi.object({
    userId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required(),
    role: Joi.string().valid('vendor', 'customer').required()
})

const updateBalanceSchema = Joi.object({
    userId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid userId format',
            'any.required': 'UserId is required'
        }),
    amount: Joi.number().positive().required().messages({
        'number.positive': 'Amount must be greater than 0',
        'any.required': 'Amount is required'
    }),
    type: Joi.string().valid('increment', 'decrement').required().messages({
        'any.only': "Transaction type must be 'increment' or 'decrement'",
        'any.required': 'Transaction type is required'
    })
})

export { walletValidationSchema, updateBalanceSchema }
