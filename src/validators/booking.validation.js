import Joi from 'joi';

const timeSlotSchema = Joi.string()
  .required()
  .pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)\s-\s(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i)
  .messages({
    'string.empty': 'Time slot is required',
    'string.pattern.base': 'Invalid time slot format. Use "hh:mm AM/PM - hh:mm AM/PM" (e.g., "10:00 AM - 12:00 PM")',
  })
  .custom((value, helpers) => {
    const [startTime, endTime] = value.split(' - ');

    const convertToMinutes = (time) => {
      const [timePart, modifier] = time.split(' ');
      let [hours, minutes] = timePart.split(':').map(Number);

      if (modifier.toLowerCase() === 'pm' && hours !== 12) hours += 12;
      if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

      return hours * 60 + minutes;
    };

    const start = convertToMinutes(startTime);
    const end = convertToMinutes(endTime);

    if (start >= end) {
      return helpers.error('time.invalidRange');
    }

    return value;
  })
  .messages({
    'time.invalidRange': 'Start time must be earlier than end time',
  });

export const createBookingSchema = Joi.object({
  serviceId: Joi.string().trim().required().messages({
    'string.empty': 'Service ID is required',
  }),
  userId: Joi.string().trim().required().messages({
    'string.empty': 'User ID is required',
  }),
  date: Joi.date()
    .iso()
    .custom((value, helpers) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 00:00 today

      if (value < today) {
        return helpers.error('date.min');
      }
      return value;
    })
    .required()
    .messages({
      'date.base': 'Invalid date format',
      'date.min': 'Date must be today or a future date',
      'any.required': 'Date is required',
    }),

  timeSlot: timeSlotSchema,

  address: Joi.string().trim().required().messages({
    'string.empty': 'Address is required',
  }),

  quantity: Joi.number().integer().min(1).max(100).optional(),

  specialRequirements: Joi.string().trim().allow('').optional(),
  userNotes: Joi.string().trim().allow('').optional(),
  appliedCoupon: Joi.string().trim().allow('').optional(),
}).options({ stripUnknown: true });
