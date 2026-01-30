import { STATUS } from '../../constants/constants.js';
import { ApiError, logger } from '../../utils/index.js';
import { calculateDistance } from './utils/helpers.js';

class BookingAreaClass {
  async checkServiceAreaCoverage(availableVendorServices, address) {
    try {
      if (!address?.location?.coordinates) {
        throw new ApiError(STATUS.NOT_FOUND, 'User address missing location coordinates');
      }

      const [userLon, userLat] = address.location.coordinates;
      const eligibilityResult = [];

      console.log('availableVendorServices', availableVendorServices);

      for (const service of availableVendorServices) {
        const vendor = service.vendor;
        if (!vendor || !vendor.serviceRadius) continue;

        const { latitude, longitude } = vendor.location || {};

        if (!latitude || !longitude) {
          logger.warn('Vendor missing location coordinates', { vendorId: vendor._id });
          continue;
        }

        const distance = calculateDistance(userLat, userLon, latitude, longitude);

        console.log('distance', distance, vendor.serviceRadius, userLat, userLon);

        if (distance <= vendor.serviceRadius) {
          eligibilityResult.push({
            ...vendor,
            vendorId: vendor._id,
            distance: Number(distance.toFixed(2)),
            serviceRadius: vendor.serviceRadius,
            fcmToken: vendor.fcmToken || null,
          });
        }
      }

      if (eligibilityResult.length === 0) {
        throw new ApiError(STATUS.OK, 'No Vendors are available in this area');
      }
      return eligibilityResult;
    } catch (error) {
      logger.error('Service area coverage check failed', { error: error.message });

      throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
    }
  }
}

const bookingAreaService = new BookingAreaClass();
export { bookingAreaService };
