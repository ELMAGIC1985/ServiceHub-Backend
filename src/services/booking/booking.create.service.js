import mongoose from 'mongoose';

import { createBookingSchema } from '../../validators/booking.validation.js';
import { ApiError, logger } from '../../utils/index.js';
import { BOOKING_STATUSES, STATUS } from '../../constants/constants.js';
import { loaderService } from '../common/loader.query.service.js';
import { vendorFindService } from './booking.vendor.service.js';
import { bookingAreaService } from './booking.area.service.js';
import { bookingPriceService } from './booking.price.service.js';
import { BOOKING_TIMING_CONSTANTS } from './utils/constants.js';
import { Booking, User } from '../../models/index.js';
import { bookingNotificationService } from './booking.notification.service.js';

class CreateBookingService {
  validateBookingData(bookingData) {
    const { error, value } = createBookingSchema.validate(bookingData);
    if (error) {
      logger.error('Booking validation error:', error);
      throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Validation failed');
    }
    return value;
  }

  async createBooking(bookingReqData) {
    const bookingDto = this.validateBookingData(bookingReqData);
    const settings = await loaderService.loadSetting();
    const serviceTemplate = await loaderService.loadServiceTemplate(bookingDto.serviceId);
    const user = await loaderService.loadUser(bookingDto.userId);
    const address = await loaderService.loadAddress(bookingDto.address);

    const availableVendor = await vendorFindService.checkVendorAvailability(bookingDto, serviceTemplate, settings);

    const eligibleVendor = await bookingAreaService.checkServiceAreaCoverage(availableVendor, address);

    const bookingPrice = await bookingPriceService.calculateBookingPricing({
      service: serviceTemplate,
      appliedCoupon: bookingDto?.appliedCoupon,
      user,
      settings,
      quantity: bookingDto?.quantity,
    });

    const bookingFinalData = this.buildBookingData({
      userId: user._id,
      serviceTemplate,
      bookingDto,
      bookingPrice,
      eligibleVendor,
    });

    const session = await mongoose.startSession();
    let booking;
    try {
      await session.withTransaction(async () => {
        booking = new Booking(bookingFinalData);

        booking.addStatusHistory(BOOKING_STATUSES.PENDING, bookingFinalData.user, 'User', 'Booking created');
        booking.comission = {
          totalComissionRate: serviceTemplate.commissionRate,
        };
        await booking.save({ session });

        await User.findByIdAndUpdate(bookingFinalData.user, { $push: { bookings: booking._id } }, { session });

        await bookingNotificationService.sendBookingRequestNotificationToVendor({
          eligibleVendors: eligibleVendor,
          booking,
          serviceTemplate,
          address,
          session,
        });
      });

      return {
        success: true,
        message: 'Booking created successfully',
        data: {
          bookingId: booking._id,
          status: 'pending',
          eligibleVendorsCount: eligibleVendor.length,
          // estimatedSearchTime: data.estimatedSearchTime,
          pricing: bookingPrice,
          // nextSteps: data.nextSteps || [
          //   'Searching for available vendors in your area',
          //   'You will be notified when a vendor accepts your request',
          //   'Estimated response time: 2-5 minutes',
          // ],
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      session.endSession();
    } finally {
      session.endSession();
    }
  }

  async getEligibleVendors(bookingReqData) {
    const bookingDto = this.validateBookingData(bookingReqData);
    const settings = await loaderService.loadSetting();
    const serviceTemplate = await loaderService.loadServiceTemplate(bookingDto.serviceId);
    const user = await loaderService.loadUser(bookingDto.userId);
    const address = await loaderService.loadAddress(bookingDto.address);

    const availableVendor = await vendorFindService.checkVendorAvailability(bookingDto, serviceTemplate, settings);

    const eligibleVendor = await bookingAreaService.checkServiceAreaCoverage(availableVendor, address);
    return eligibleVendor;
  }

  buildBookingData({ userId, serviceTemplate, bookingDto, bookingPrice, eligibleVendor }) {
    return {
      user: userId,
      serviceTemplate: bookingDto.serviceId,
      category: serviceTemplate.category,
      subCategory: serviceTemplate.subCategory,
      date: bookingDto.date,
      timeSlot: bookingDto.timeSlot,
      address: bookingDto.address,
      pricing: bookingPrice,
      specialRequirements: bookingDto?.specialRequirements,
      userNotes: bookingDto?.userNotes,

      appliedCoupon: bookingDto?.appliedCoupon
        ? {
            couponCode: bookingDto?.appliedCoupon,
            discountAmount: bookingPrice.couponDiscount,
          }
        : undefined,

      vendorSearch: {
        lastSearchAt: new Date(),
        eligibleVendors: eligibleVendor.map((v) => ({
          vendorId: v.vendorId,
          distance: v.distance,
          notifiedAt: new Date(),
          response: 'pending',
        })),
      },

      timing: {
        requestTimeout: BOOKING_TIMING_CONSTANTS.BOOKING_REQUEST_TIMEOUT,
        vendorResponseTimeout: BOOKING_TIMING_CONSTANTS.VENDOR_RESPONSE_TIMEOUT,
        searchTimeout: new Date(Date.now() + BOOKING_TIMING_CONSTANTS.REQUEST_TIMEOUT_MS),
      },
    };
  }
}

const createBookingService = new CreateBookingService();

export { createBookingService };
