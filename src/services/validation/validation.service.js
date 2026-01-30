import Joi from 'joi'

const addressJoiSchema = Joi.object({
    line1: Joi.string().trim().required().label('Address Line 1'),
    line2: Joi.string().trim().optional().label('Address Line 2'),
    city: Joi.string().trim().required().label('City'),
    state: Joi.string().trim().required().label('State'),
    country: Joi.string().trim().required().label('Country'),
    postalCode: Joi.string().trim().required().label('Postal Code')
})

const kycSchema = Joi.object({
    firstName: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'First Name must be a string' }),
    lastName: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'Last Name is required' }),
    middleName: Joi.string().trim().optional(),
    purpose: Joi.string().trim().optional(),
    phoneNumber: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'Phone Number is required' }),
    email: Joi.string()
        .email()
        .trim()
        .required()
        .messages({
            'string.empty': 'Email is required',
            'string.email': 'Email must be a valid email'
        }),
    dob: Joi.date()
        .required()
        .messages({ 'date.base': 'Date of Birth is required' }),
    address: addressJoiSchema
        .required()
        .messages({ 'object.base': 'Address is required' }),
    addressType: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'Address Type is required' }),
    selfieImage: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'Selfie Image is required' }),
    documentType: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'Document Type is required' }),
    documentImage: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'Document Image is required' }),
    serviceCategory: Joi.array()
        .items(Joi.string().trim())
        .required()
        .messages({ 'array.base': 'Service Category is required' }),
    vendorId: Joi.string()
        .trim()
        .required()
        .messages({ 'string.empty': 'Vendor is required' })
})

export { kycSchema }
