import { STATUS } from '../../constants/constants.js';
import { Booking, VendorService } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';

class VendorFindService {
  async checkVendorAvailability(availabilityDto, serviceTemplate, settings) {
    const { timeSlot, date } = availabilityDto;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const availableVendorServices = await VendorService.aggregate([
      {
        $match: {
          childCategory: serviceTemplate.subCategory._id,
          isActive: true,
          isDeleted: false,
          status: 'approved',
          'availability.isAvailable': true,
        },
      },
      {
        $lookup: {
          from: 'vendors',
          let: { vendorId: '$vendor' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ['$_id', '$$vendorId'],
                    },
                    {
                      $eq: ['$isAvailable', true],
                    },
                    {
                      $eq: ['$isBlocked', false],
                    },
                    {
                      $eq: ['$isOnline', true],
                    },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: 'addresses',
                localField: 'address',
                foreignField: '_id',
                as: 'address',
              },
            },
            {
              $unwind: '$address',
            },
            {
              $lookup: {
                from: 'wallets',
                localField: 'wallet',
                foreignField: '_id',
                as: 'walletData',
              },
            },
            {
              $unwind: '$walletData',
            },
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$walletData', null] },
                    { $eq: ['$walletData.status', 'active'] },
                    // Minimum available balance check
                    {
                      $gte: [
                        { $subtract: ['$walletData.balance', '$walletData.pendingBalance'] },
                        settings.minimumWalletBalance,
                      ],
                    },

                    // 🔴 CRITICAL RULE: Pending older than 7 days → BLOCK
                    {
                      $or: [
                        // No pending balance
                        { $lte: ['$walletData.pendingBalance', 0] },

                        // Pending exists but still within 7 days
                        {
                          $gt: ['$walletData.pendingSince', sevenDaysAgo],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                isAvailable: 1,
                isBlocked: 1,
                serviceRadius: 1,
                fcmToken: '$fcmToken.token',
                platform: '$fcmToken.platform',
                firstName: 1,
                name: 1,
                lastName: 1,
                email: 1,
                phoneNumber: 1,
                walletData: 1,
                wallet: {
                  _id: '$walletData._id',
                  balance: '$walletData.balance',
                  availableBalance: {
                    $subtract: ['$walletData.balance', '$walletData.pendingBalance'],
                  },
                  status: '$walletData.status',
                },
                location: {
                  latitude: { $arrayElemAt: ['$address.location.coordinates', 1] },
                  longitude: { $arrayElemAt: ['$address.location.coordinates', 0] },
                },
              },
            },
          ],
          as: 'vendor',
        },
      },
      {
        $unwind: {
          path: '$vendor',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 1,
          vendor: {
            _id: '$vendor._id',
            serviceRadius: '$vendor.serviceRadius',
            isAvailable: '$vendor.isAvailable',
            isBlocked: '$vendor.isBlocked',
            fcmToken: '$vendor.fcmToken',
            platform: '$vendor.platform',
            location: '$vendor.location',
            firstName: '$vendor.firstName',
            phone: '$vendor.phoneNumber',
            lastName: '$vendor.lastName',
            email: '$vendor.email',
            wallet: {
              balance: '$vendor.walletData.balance',
              pendingBalance: '$vendor.walletData.pendingBalance',
            },
          },
          serviceTemplate: {
            _id: '$serviceTemplateData._id',
            title: '$serviceTemplateData.title',
            description: '$serviceTemplateData.description',
            basePrice: '$serviceTemplateData.basePrice',
          },
          category: 1,
          childCategory: 1,
          availability: 1,
        },
      },
    ]).exec();

    console.log('availableVendorServices', availableVendorServices);

    // let filteredServices = availableVendorServices.filter((service) => {
    //   if (
    //     service.availability?.workingHours?.[dayOfWeek]?.start &&
    //     service.availability?.workingHours?.[dayOfWeek]?.end
    //   ) {
    //     return isTimeSlotInWorkingHours(
    //       timeSlot,
    //       service.availability.workingHours[dayOfWeek].start,
    //       service.availability.workingHours[dayOfWeek].end
    //     );
    //   }
    //   return true;
    // });

    if (availableVendorServices.length === 0) {
      throw new ApiError(STATUS.OK, 'No Vendors are available at this date or timeslot');
    }

    const vendorsWithBookingAvailability = await this.filterVendorsByBookingAvailability(
      availableVendorServices,
      date,
      timeSlot
    );

    if (vendorsWithBookingAvailability.length === 0) {
      throw new ApiError(STATUS.OK, 'All vendors are already booked for this time slot');
    }

    return vendorsWithBookingAvailability;
  }

  async filterVendorsByBookingAvailability(vendors, date, timeSlot) {
    if (!vendors || vendors.length === 0) {
      return [];
    }

    const inputDate = new Date(date);
    inputDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inputDate < today) {
      throw new Error('Date must be today or a future date');
    }

    const vendorIds = vendors.map((v) => v.vendor._id);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existingBookings = await Booking.find({
      'vendorSearch.assignedVendor.vendorId': {
        $in: vendorIds,
      },
      date: {
        $gte: startOfToday,
      },
      timeSlot: timeSlot,
      status: {
        $in: ['vendor_assigned', 'accepted', 'confirmed', 'on_route', 'arrived', 'in_progress'],
      },
    })
      .select('vendorSearch.assignedVendor.vendorId')
      .lean();

    const bookedVendorIds = new Set(
      existingBookings.map((booking) => booking.vendorSearch?.assignedVendor?.vendorId?.toString()).filter(Boolean)
    );

    const availableVendors = vendors.filter((vendor) => {
      const vendorId = vendor.vendor._id.toString();
      return !bookedVendorIds.has(vendorId);
    });

    return availableVendors;
  }
}

const vendorFindService = new VendorFindService();

export { vendorFindService };
