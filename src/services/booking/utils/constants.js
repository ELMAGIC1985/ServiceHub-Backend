export const BOOKING_TIMING_CONSTANTS = {
  BOOKING_REQUEST_TIMEOUT: 150, // Time a booking request stays open before timing out
  VENDOR_RESPONSE_TIMEOUT: 150, // Time allowed for vendor to accept request
  SEARCH_TIMEOUT_BUFFER: 150, // Extra buffer time added to search window

  get REQUEST_TIMEOUT_MS() {
    return this.BOOKING_REQUEST_TIMEOUT * 1000;
  },
  get VENDOR_RESPONSE_TIMEOUT_MS() {
    return this.VENDOR_RESPONSE_TIMEOUT * 1000;
  },
};
