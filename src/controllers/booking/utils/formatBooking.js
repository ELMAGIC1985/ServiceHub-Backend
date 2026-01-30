export const formatBooking = (booking) => {
  if (!booking) return null;

  // Extract and clean address
  let address = null;
  if (booking.address) {
    // Get the actual document data, avoiding Mongoose internals
    const addressData = booking.address._doc || booking.address;

    address = {
      _id: addressData._id,
      city: addressData.city,
      state: addressData.state,
      country: addressData.country,
      landmark: addressData.landmark,
      completeAddress: addressData.completeAddress,
    };

    // Extract coordinates from GeoJSON format if available
    if (addressData.location?.coordinates) {
      address.latitude = addressData.location.coordinates[1]; // latitude is second
      address.longitude = addressData.location.coordinates[0]; // longitude is first
    }
  }

  return {
    _id: booking._id,
    pricing: booking.pricing || 0,
    address: address,
    specialRequirements: booking.specialRequirements || '',
    userNotes: booking.userNotes || '',
    date: booking.date,
    timeSlot: booking.timeSlot,
    status: booking.status,
    service: booking.serviceTemplate,
    vendor: booking?.vendorSearch?.assignedVendor?.vendorId,
    user: booking?.user,
    bookingId: booking?.bookingId,
    comission: booking?.comission,
    paymentStatus: booking?.paymentStatus,
  };
};

export function getNotificationType(status) {
  const types = {
    vendor_assigned: 'vendor_assigned',
    accepted: 'vendor_accepted',
    on_route: 'vendor_on_route',
    arrived: 'vendor_arrived',
    in_progress: 'service_started',
    completed: 'service_completed',
    cancelled_by_user: 'booking_cancelled',
    cancelled_by_vendor: 'booking_cancelled',
    cancelled_by_system: 'booking_cancelled',
  };
  return types[status] || 'booking_created';
}

export function getNotificationMessage(status) {
  const messages = {
    vendor_assigned: 'A vendor has been assigned to your booking',
    accepted: 'Your booking has been accepted by the vendor',
    confirmed: 'Your booking is confirmed',
    on_route: 'The vendor is on the way',
    arrived: 'The vendor has arrived',
    in_progress: 'Service is now in progress',
    completed: 'Service completed successfully',
    cancelled_by_user: 'Booking cancelled by you',
    cancelled_by_vendor: 'Booking cancelled by vendor',
    cancelled_by_system: 'Booking cancelled by system',
    rejected: 'Vendor rejected the booking',
    failed: 'Service failed',
    expired: 'Booking expired',
  };
  return messages[status] || `Booking status updated to ${status}`;
}

export const formatAddress = (address) => {
  if (address) {
    const addressData = address;
    address = {
      _id: addressData._id,
      city: addressData.city,
      state: addressData.state,
      country: addressData.country,
      landmark: addressData.landmark,
      completeAddress: addressData.completeAddress,
    };

    if (addressData.location?.coordinates) {
      address.latitude = addressData.location.coordinates[1]; // latitude is second
      address.longitude = addressData.location.coordinates[0]; // longitude is first
    }
    return address;
  }
};
