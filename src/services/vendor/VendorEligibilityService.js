import { Vendor, VendorService, Booking } from '../../models/index.js';
import { PRICING_CONSTANTS, BOOKING_STATUSES } from '../../constants/constants.js';
import logger from '../../utils/logger.js';

export class VendorEligibilityService {
  static async findEligibleVendors({
    serviceId,
    userLocation,
    requestedDate,
    requestedTimeSlot,
    session = null,
    quickCheck = false,
  }) {
    try {
      const [userLat, userLon] = userLocation;

      logger.info('Finding eligible vendors', {
        serviceId,
        userLocation,
        requestedDate,
        requestedTimeSlot,
        quickCheck,
      });

      // Step 1: Validate and normalize date
      const normalizedDate = this.normalizeDate(requestedDate);
      const { startOfDay, endOfDay } = this.getDateRange(normalizedDate);
      const dayOfWeek = this.getDayOfWeek(normalizedDate);

      // Step 2: Find all vendor services for this service template
      const vendorServices = await this.getVendorServices(serviceId, session);

      if (vendorServices.length === 0) {
        return {
          success: false,
          message: 'No vendors offer this service',
          vendors: [],
        };
      }

      // Step 3: Filter vendors by basic criteria
      const basicEligibleServices = await this.filterByBasicCriteria(vendorServices, session);

      // Step 4: Check vendor availability for the time slot
      const availableServices = await this.filterByAvailability(
        basicEligibleServices,
        startOfDay,
        endOfDay,
        requestedTimeSlot,
        dayOfWeek,
        session
      );

      if (availableServices.length === 0) {
        return {
          success: false,
          message: 'No vendors available for this time slot',
          vendors: [],
        };
      }

      // Step 5: Filter by distance and service radius
      const eligibleVendors = await this.filterByDistance(availableServices, userLat, userLon);

      if (eligibleVendors.length === 0) {
        return {
          success: false,
          message: 'No vendors available in your area',
          vendors: [],
        };
      }

      // Step 6: Sort by distance and add priority scoring
      const sortedVendors = this.sortAndPrioritizeVendors(eligibleVendors);

      logger.info('Found eligible vendors', {
        serviceId,
        totalFound: sortedVendors.length,
        quickCheck,
      });

      return {
        success: true,
        message: `Found ${sortedVendors.length} eligible vendors`,
        vendors: sortedVendors,
      };
    } catch (error) {
      logger.error('Error finding eligible vendors', {
        serviceId,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        message: 'Error finding eligible vendors',
        vendors: [],
        error: error.message,
      };
    }
  }

  static async validateVendorAcceptance({ booking, vendorId, session }) {
    try {
      if (!['pending', 'searching'].includes(booking.status)) {
        return {
          canAccept: false,
          reason: 'BOOKING_NOT_AVAILABLE',
        };
      }

      const vendorInList = booking.vendorSearch.eligibleVendors.find(
        (v) => v.vendorId.toString() === vendorId.toString()
      );

      if (!vendorInList) {
        return {
          canAccept: false,
          reason: 'VENDOR_NOT_ELIGIBLE',
        };
      }

      if (vendorInList.response !== 'pending') {
        return {
          canAccept: false,
          reason: 'VENDOR_ALREADY_RESPONDED',
        };
      }

      if (booking.timing?.searchTimeout && new Date() > booking.timing.searchTimeout) {
        return {
          canAccept: false,
          reason: 'BOOKING_EXPIRED',
        };
      }

      if (booking?.vendorSearch?.assignedVendor?.vendorId) {
        return {
          canAccept: false,
          reason: 'BOOKING_ALREADY_ASSIGNED',
        };
      }

      const conflictingBooking = await Booking.findOne({
        vendor: vendorId,
        date: {
          $gte: new Date(booking.date.getFullYear(), booking.date.getMonth(), booking.date.getDate()),
          $lt: new Date(booking.date.getFullYear(), booking.date.getMonth(), booking.date.getDate() + 1),
        },
        timeSlot: booking.timeSlot,
        status: {
          $in: [
            BOOKING_STATUSES.VENDOR_ASSIGNED,
            BOOKING_STATUSES.ACCEPTED,
            BOOKING_STATUSES.CONFIRMED,
            BOOKING_STATUSES.ON_ROUTE,
            BOOKING_STATUSES.ARRIVED,
            BOOKING_STATUSES.IN_PROGRESS,
          ],
        },
      }).session(session);

      if (conflictingBooking) {
        return {
          canAccept: false,
          reason: 'VENDOR_NOT_AVAILABLE',
        };
      }

      // Check vendor's current status
      const vendor = await Vendor.findById(vendorId).select('isAvailable isBlocked isOnline').session(session);

      if (!vendor) {
        return {
          canAccept: false,
          reason: 'VENDOR_NOT_FOUND',
        };
      }

      if (!vendor.isAvailable || vendor.isBlocked) {
        return {
          canAccept: false,
          reason: 'VENDOR_NOT_AVAILABLE',
        };
      }

      return {
        canAccept: true,
        vendor,
      };
    } catch (error) {
      logger.error('Error validating vendor acceptance', {
        bookingId: booking._id,
        vendorId,
        error: error.message,
      });

      return {
        canAccept: false,
        reason: 'VALIDATION_ERROR',
        error: error.message,
      };
    }
  }

  static async getVendorServices(serviceId, session) {
    const query = {
      serviceTemplate: serviceId,
      isActive: true,
      isDeleted: false,
      status: 'approved',
    };

    return VendorService.find(query)
      .populate({
        path: 'vendor',
        select: 'firstName lastName isAvailable isBlocked fcmToken serviceRadius location',
        match: {
          isAvailable: true,
          isBlocked: false,
        },
      })
      .session(session)
      .lean();
  }

  static async filterByBasicCriteria(vendorServices, session) {
    return vendorServices.filter((service) => {
      // Ensure vendor exists and meets basic criteria
      if (!service.vendor) return false;

      // Check if vendor has FCM token for notifications
      const hasFCMToken = service.vendor.fcmToken && service.vendor.fcmToken.token && service.vendor.fcmToken.isActive;

      if (!hasFCMToken) {
        logger.debug('Vendor excluded: No valid FCM token', {
          vendorId: service.vendor._id,
        });
        return false;
      }

      return true;
    });
  }

  static async filterByAvailability(vendorServices, startOfDay, endOfDay, requestedTimeSlot, dayOfWeek, session) {
    // Get vendors who are already booked for this time slot
    const vendorIds = vendorServices.map((service) => service.vendor._id);

    const bookedVendorIds = await Booking.find({
      vendor: { $in: vendorIds },
      date: { $gte: startOfDay, $lte: endOfDay },
      timeSlot: requestedTimeSlot,
      status: {
        $in: [
          BOOKING_STATUSES.VENDOR_ASSIGNED,
          BOOKING_STATUSES.ACCEPTED,
          BOOKING_STATUSES.CONFIRMED,
          BOOKING_STATUSES.ON_ROUTE,
          BOOKING_STATUSES.ARRIVED,
          BOOKING_STATUSES.IN_PROGRESS,
        ],
      },
    })
      .distinct('vendor')
      .session(session);

    // Filter out booked vendors and check working hours
    return vendorServices.filter((service) => {
      const vendorId = service.vendor._id;

      // Check if vendor is already booked
      if (bookedVendorIds.some((bookedId) => bookedId.equals(vendorId))) {
        return false;
      }

      // Check working hours if defined
      if (service.availability?.workingHours?.[dayOfWeek]) {
        const daySchedule = service.availability.workingHours[dayOfWeek];
        if (!daySchedule.isAvailable) {
          return false;
        }

        // Optional: Add specific time validation
        if (daySchedule.start && daySchedule.end) {
          const isInWorkingHours = this.isTimeSlotInWorkingHours(requestedTimeSlot, daySchedule.start, daySchedule.end);
          if (!isInWorkingHours) {
            return false;
          }
        }
      }

      return true;
    });
  }

  static async filterByDistance(vendorServices, userLat, userLon) {
    const eligibleVendors = [];

    for (const service of vendorServices) {
      const vendor = service.vendor;

      // Check if vendor has location data
      if (!vendor.location?.coordinates) {
        logger.debug('Vendor excluded: No location data', {
          vendorId: vendor._id,
        });
        continue;
      }

      const [vendorLon, vendorLat] = vendor.location.coordinates;
      const distance = getDistanceInKm(userLat, userLon, vendorLat, vendorLon);

      // Check if vendor is within service radius
      const serviceRadius = vendor.serviceRadius || PRICING_CONSTANTS.DEFAULT_SEARCH_RADIUS;

      if (distance > serviceRadius) {
        logger.debug('Vendor excluded: Outside service radius', {
          vendorId: vendor._id,
          distance,
          serviceRadius,
        });
        continue;
      }

      // Add vendor to eligible list
      eligibleVendors.push({
        serviceId: service._id,
        vendorId: vendor._id,
        vendorName: `${vendor.firstName} ${vendor.lastName}`.trim(),
        distance: parseFloat(distance.toFixed(2)),
        serviceRadius,
        fcmToken: vendor.fcmToken.token,
        location: vendor.location,
        rating: service.ratings?.average || 0,
        totalBookings: service.bookingStats?.totalBookings || 0,
        responseTime: service.bookingStats?.averageResponseTime || 0,
      });
    }

    return eligibleVendors;
  }

  static sortAndPrioritizeVendors(vendors) {
    return vendors
      .map((vendor) => ({
        ...vendor,
        priorityScore: this.calculatePriorityScore(vendor),
      }))
      .sort((a, b) => {
        // Primary sort by priority score (higher is better)
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        // Secondary sort by distance (closer is better)
        return a.distance - b.distance;
      });
  }

  static calculatePriorityScore(vendor) {
    let score = 0;

    // Distance factor (closer = higher score)
    const maxDistance = 15; // km
    const distanceScore = Math.max(0, (maxDistance - vendor.distance) / maxDistance) * 30;
    score += distanceScore;

    // Rating factor
    const ratingScore = vendor.rating * 20;
    score += ratingScore;

    // Experience factor (total bookings)
    const experienceScore = Math.min(vendor.totalBookings * 2, 30);
    score += experienceScore;

    // Response time factor (faster = higher score)
    const avgResponseTime = vendor.responseTime || 300; // seconds
    const responseScore = Math.max(0, (300 - avgResponseTime) / 300) * 20;
    score += responseScore;

    return Math.round(score);
  }

  static isTimeSlotInWorkingHours(timeSlot, startTime, endTime) {
    try {
      const slotTime = this.parseTimeSlot(timeSlot);
      const start = this.parseTimeSlot(startTime);
      const end = this.parseTimeSlot(endTime);

      return slotTime >= start && slotTime <= end;
    } catch (error) {
      logger.warn('Error checking working hours', { timeSlot, startTime, endTime });
      return true; // Default to available if parsing fails
    }
  }

  static parseTimeSlot(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  static normalizeDate(dateInput) {
    let normalizedDate;

    if (dateInput instanceof Date) {
      normalizedDate = dateInput;
    } else if (typeof dateInput === 'string') {
      normalizedDate = new Date(dateInput);
    } else {
      throw new Error('Invalid date format: must be Date object or valid date string');
    }

    if (isNaN(normalizedDate.getTime())) {
      throw new Error(`Invalid date format: ${dateInput}`);
    }

    return normalizedDate;
  }

  static getDateRange(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
  }

  static getDayOfWeek(date) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[date.getDay()];
  }
}
