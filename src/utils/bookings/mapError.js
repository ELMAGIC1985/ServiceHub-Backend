export const mapError = (error) => {
  const errors = {
    // 🧾 Booking Errors
    BOOKING_NOT_FOUND: { status: 404, message: 'Booking not found' },
    BOOKING_NOT_AVAILABLE: { status: 400, message: 'Booking is not available for acceptance' },
    BOOKING_NOT_ELIGIBLE: { status: 400, message: 'Booking is not eligible for this operation' },
    BOOKING_EXPIRED: { status: 400, message: 'Booking has expired' },
    BOOKING_ALREADY_ASSIGNED: { status: 400, message: 'Booking has already been assigned to a vendor' },

    // 👷 Vendor Errors
    VENDOR_NOT_FOUND: { status: 404, message: 'Vendor not found' },
    VENDOR_NOT_ELIGIBLE: { status: 400, message: 'Vendor is not in the eligible list' },
    VENDOR_ALREADY_RESPONDED: { status: 400, message: 'Vendor has already responded to this booking' },
    VENDOR_NOT_AVAILABLE: { status: 400, message: 'Vendor is not available for this time slot' },
    UNAUTHORIZED_VENDOR: { status: 403, message: 'You are not authorized to accept this booking' },

    // 💰 Wallet & Payment Errors
    INSUFFICIENT_BALANCE: { status: 400, message: 'Insufficient wallet balance to accept booking' },
    VENDOR_WALLET_NOT_FOUND: { status: 404, message: 'Vendor wallet not found' },
    ADMIN_WALLET_NOT_FOUND: { status: 404, message: 'Admin wallet not found' },
    CUSTOMER_WALLET_NOT_FOUND: { status: 404, message: 'Customer wallet not found' },
    WALLET_TRANSACTION_FAILED: { status: 500, message: 'Wallet transaction could not be processed' },

    // 💸 Commission / Pricing
    COMMISSION_NOT_DEFINED: { status: 400, message: 'Commission rate not defined for this service' },
    COMMISSION_CALCULATION_FAILED: { status: 500, message: 'Failed to calculate commission' },

    // ✅ Validation & Flow Errors
    VALIDATION_ERROR: { status: 400, message: 'Vendor eligibility validation failed' },
    INVALID_BOOKING_STATUS: { status: 400, message: 'Booking is not in a valid state for this operation' },
    DUPLICATE_OPERATION: { status: 400, message: 'Duplicate or repeated request detected' },

    // ⚙️ General / Internal
    UNKNOWN_ERROR: { status: 500, message: 'Unknown error occurred' },
    INTERNAL_SERVER_ERROR: { status: 500, message: 'Internal Server Error' },
  };

  let key = 'UNKNOWN_ERROR';

  if (error?.code === 11000) {
    return { status: 400, message: 'A booking already exists for this date and time slot' };
  }

  if (typeof error === 'string') {
    key = error.replace('Error: ', '').trim();
  } else if (error instanceof Error) {
    key = error.message.replace('Error: ', '').trim();
  } else if (typeof error === 'object' && error?.message) {
    key = error.message.replace('Error: ', '').trim();
  }

  return errors[key] || errors.UNKNOWN_ERROR;
};
