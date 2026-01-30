import { STATUS } from '../../constants/constants.js';
import { ApiError } from '../../utils/index.js';

export const VendorEligibilityService = {
  async validateBooking({ booking, vendor, session }) {
    if (!['pending', 'searching'].includes(booking.status))
      throw new ApiError(STATUS.NOT_FOUND, 'Booking not available');

    const vendorInList = booking.vendorSearch.eligibleVendors.find(
      (v) => v.vendorId.toString() === vendor?._id.toString()
    );

    if (!vendorInList) throw new ApiError(STATUS.NOT_FOUND, 'Vendor not eligible');

    if (vendorInList.response !== 'pending') throw new ApiError(STATUS.BAD_REQUEST, 'Vendor already responded');

    if (booking.timing?.searchTimeout && new Date() > booking.timing.searchTimeout)
      throw new ApiError(STATUS.BAD_REQUEST, 'Booking expired');

    if (booking?.vendorSearch?.assignedVendor?.vendorId)
      throw new ApiError(STATUS.BAD_REQUEST, 'Booking already assigned');
  },
};
