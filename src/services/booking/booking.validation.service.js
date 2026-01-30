import { STATUS } from '../../constants/constants.js';
import { createBookingSchema } from '../../validators/booking.validation.js';

class BookingValidationService {
  async validateBookingRequest(bookingData) {}
  validateBookingData(bookingData) {
    const { error, value } = createBookingSchema.validate(bookingData);
    if (error) throw new ApiError(STATUS.BAD_REQUEST, 'Validation failed');
    return value;
  }
}

const bookingValidationService = new BookingValidationService();

export { bookingValidationService };
