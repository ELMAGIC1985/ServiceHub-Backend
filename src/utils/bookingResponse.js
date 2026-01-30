export const createBookingSuccessResponse = (data) => {
  return {
    success: true,
    message: 'Booking created successfully',
    data: {
      bookingId: data.bookingId,
      status: 'pending',
      eligibleVendorsCount: data.eligibleVendorsCount,
      estimatedSearchTime: data.estimatedSearchTime,
      pricing: data.pricing,
      nextSteps: data.nextSteps || [
        'Searching for available vendors in your area',
        'You will be notified when a vendor accepts your request',
        'Estimated response time: 2-5 minutes',
      ],
    },
    timestamp: new Date().toISOString(),
  };
};

export const createErrorResponse = (message, errorCode, details = null) => {
  const response = {
    success: false,
    message,
    error: errorCode,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.details = details;
  }

  return response;
};

export const createValidationErrorResponse = (errors) => {
  return {
    success: false,
    message: 'Validation failed',
    error: 'VALIDATION_ERROR',
    details: {
      errors: errors.map((error) => ({
        field: error.field,
        message: error.message,
      })),
    },
    timestamp: new Date().toISOString(),
  };
};

export const createVendorAcceptanceResponse = (data) => {
  return {
    success: true,
    message: 'Booking accepted successfully',
    data: {
      bookingId: data.booking._id,
      bookingStatus: data.booking.status,
      customerInfo: {
        name: data.booking.user.name,
        phone: data.booking.user.phoneNumber,
        address: data.booking.address.formattedAddress,
        location: data.booking.address.location.coordinates,
      },
      serviceDetails: {
        title: data.booking.service.title,
        date: data.booking.date,
        timeSlot: data.booking.timeSlot,
        price: data.booking.price,
      },
      estimatedArrival: data.estimatedArrival,
      nextSteps: data.nextSteps || [
        'Contact customer if needed',
        'Start heading to the location',
        'Update status when you arrive',
      ],
    },
    timestamp: new Date().toISOString(),
  };
};

export const createPaginatedResponse = (data, pagination) => {
  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
      hasPrev: pagination.page > 1,
    },
    timestamp: new Date().toISOString(),
  };
};

export const createNoContentResponse = (message = 'No data found') => {
  return {
    success: true,
    message,
    data: [],
    timestamp: new Date().toISOString(),
  };
};
