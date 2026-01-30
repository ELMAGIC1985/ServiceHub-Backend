import { calculateDistance } from '../../controllers/customer/utils/helpers.js';
import { ServiceTemplate, User, VendorService, Address } from '../../models/index.js';
import logger from '../../utils/logger.js';

export class BookingValidationService {
  static async validateBookingRequest({ serviceId, date, timeSlot, address, userId }) {
    const errors = [];

    try {
      // Validate service exists and is active
      const serviceValidation = await this.validateService(serviceId);
      if (!serviceValidation.isValid) {
        errors.push(...serviceValidation.errors);
      }

      // Validate date
      const dateValidation = this.validateDate(date);
      if (!dateValidation.isValid) {
        errors.push(...dateValidation.errors);
      }

      // Validate time slot
      const timeSlotValidation = this.validateTimeSlot(timeSlot);
      if (!timeSlotValidation.isValid) {
        errors.push(...timeSlotValidation.errors);
      }

      // Validate address
      const addressValidation = await this.validateAddress(address);
      if (!addressValidation.isValid) {
        errors.push(...addressValidation.errors);
      }

      // Validate user
      const userValidation = await this.validateUser(userId);
      if (!userValidation.isValid) {
        errors.push(...userValidation.errors);
      }

      // Business logic validations
      let businessValidation;
      if (errors.length === 0) {
        businessValidation = await this.validateBusinessRules({
          serviceTemplate: serviceValidation.data,
          normalizedDate: dateValidation.data,
          timeSlot,
          address: addressValidation.data,
          user: userValidation.data,
        });

        if (!businessValidation.isValid) {
          errors.push(...businessValidation.errors);
        }
      }

      // console.log('businessValidation.eligibleVendor', businessValidation?.eligibleVendor);

      return {
        isValid: errors.length === 0,
        errors,
        data:
          errors.length === 0
            ? {
                serviceTemplate: serviceValidation.data,
                normalizedDate: dateValidation.data,
                address: addressValidation.data,
                user: userValidation.data,
                eligibleVendor: businessValidation?.eligibleVendor || [],
              }
            : null,
      };
    } catch (error) {
      logger.error('Booking validation error', { error: error.message });
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Validation failed due to system error' }],
        data: null,
      };
    }
  }

  static async validateService(serviceId) {
    try {
      if (!serviceId) {
        return {
          isValid: false,
          errors: [{ field: 'serviceId', message: 'Service ID is required' }],
        };
      }

      const serviceTemplate = await ServiceTemplate.findById(serviceId).populate('category subCategory');

      if (!serviceTemplate) {
        return {
          isValid: false,
          errors: [{ field: 'serviceId', message: 'Service not found' }],
        };
      }

      if (!serviceTemplate.isActive) {
        return {
          isValid: false,
          errors: [{ field: 'serviceId', message: 'Service is currently not available' }],
        };
      }

      if (serviceTemplate.isDeleted) {
        return {
          isValid: false,
          errors: [{ field: 'serviceId', message: 'Service has been removed' }],
        };
      }

      return {
        isValid: true,
        errors: [],
        data: serviceTemplate,
      };
    } catch (error) {
      logger.error('Service validation error', { serviceId, error: error.message });
      return {
        isValid: false,
        errors: [{ field: 'serviceId', message: 'Invalid service ID format' }],
      };
    }
  }

  static validateDate(dateInput) {
    try {
      if (!dateInput) {
        return {
          isValid: false,
          errors: [{ field: 'date', message: 'Date is required' }],
        };
      }

      let normalizedDate;

      // Handle different date input formats
      if (dateInput instanceof Date) {
        normalizedDate = dateInput;
      } else if (typeof dateInput === 'string') {
        normalizedDate = new Date(dateInput);
      } else {
        return {
          isValid: false,
          errors: [{ field: 'date', message: 'Invalid date format' }],
        };
      }

      // Check if date is valid
      if (isNaN(normalizedDate.getTime())) {
        return {
          isValid: false,
          errors: [{ field: 'date', message: 'Invalid date provided' }],
        };
      }

      // Check if date is in the past (allow same day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      normalizedDate.setHours(0, 0, 0, 0);

      if (normalizedDate < today) {
        return {
          isValid: false,
          errors: [{ field: 'date', message: 'Cannot book services for past dates' }],
        };
      }

      // Check if date is too far in the future (e.g., 1 months)
      const maxAdvanceDate = new Date();
      maxAdvanceDate.setMonth(maxAdvanceDate.getMonth() + 1);

      if (normalizedDate > maxAdvanceDate) {
        return {
          isValid: false,
          errors: [{ field: 'date', message: 'Cannot book more than 1 months in advance' }],
        };
      }

      return {
        isValid: true,
        errors: [],
        data: normalizedDate,
      };
    } catch (error) {
      logger.error('Date validation error', { dateInput, error: error.message });
      return {
        isValid: false,
        errors: [{ field: 'date', message: 'Date validation failed' }],
      };
    }
  }

  static validateTimeSlot(timeSlot) {
    if (!timeSlot) {
      return {
        isValid: false,
        errors: [{ field: 'timeSlot', message: 'Time slot is required' }],
      };
    }

    // Regex for full range -> "10:00 AM - 12:00 PM"
    const rangeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)\s-\s(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;

    if (!rangeRegex.test(timeSlot)) {
      return {
        isValid: false,
        errors: [
          {
            field: 'timeSlot',
            message: 'Invalid time slot format. Use "hh:mm AM/PM - hh:mm AM/PM" (e.g., "10:00 AM - 12:00 PM")',
          },
        ],
      };
    }

    // Split into start and end times
    const [startTime, endTime] = timeSlot.split(' - ');

    const convertToMinutes = (time) => {
      
      let [hours, minutes] = timePart.split(':').map(Number);

      if (modifier.toLowerCase() === 'pm' && hours !== 12) hours += 12;
      if (modifier.toLowerCase() === 'am' && hours === 12) hours = 0;

      return hours * 60 + minutes;
    };

    const startMinutes = convertToMinutes(startTime);
    const endMinutes = convertToMinutes(endTime);

    if (startMinutes >= endMinutes) {
      return {
        isValid: false,
        errors: [
          {
            field: 'timeSlot',
            message: 'Start time must be earlier than end time',
          },
        ],
      };
    }

    return {
      isValid: true,
      errors: [],
      data: {
        start: startTime,
        end: endTime,
      },
    };
  }

  static async validateAddress(address) {
    try {
      if (!address) {
        return {
          isValid: false,
          errors: [{ field: 'address', message: 'Address is required' }],
        };
      }

      let addressData;

      if (typeof address === 'string') {
        addressData = await Address.findById(address);
        if (!addressData) {
          return {
            isValid: false,
            errors: [{ field: 'address', message: 'Address not found' }],
          };
        }
      } else if (typeof address === 'object') {
        const requiredFields = ['location', 'formattedAddress'];
        const missingFields = requiredFields.filter((field) => !address[field]);

        if (missingFields.length > 0) {
          return {
            isValid: false,
            errors: missingFields.map((field) => ({
              field: `address.${field}`,
              message: `${field} is required in address`,
            })),
          };
        }

        if (
          !address.location.coordinates ||
          !Array.isArray(address.location.coordinates) ||
          address.location.coordinates.length !== 2
        ) {
          return {
            isValid: false,
            errors: [
              {
                field: 'address.location',
                message: 'Valid location coordinates [latitude, longitude] required',
              },
            ],
          };
        }

        const [lat, lon] = address.location.coordinates;
        if (typeof lat !== 'number' || typeof lon !== 'number' || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          return {
            isValid: false,
            errors: [
              {
                field: 'address.location',
                message: 'Invalid coordinates. Latitude: -90 to 90, Longitude: -180 to 180',
              },
            ],
          };
        }

        addressData = address;
      } else {
        return {
          isValid: false,
          errors: [{ field: 'address', message: 'Invalid address format' }],
        };
      }

      return {
        isValid: true,
        errors: [],
        data: addressData,
      };
    } catch (error) {
      logger.error('Address validation error', { address, error: error.message });
      return {
        isValid: false,
        errors: [{ field: 'address', message: 'Address validation failed' }],
      };
    }
  }

  static async validateUser(userId) {
    try {
      if (!userId) {
        return {
          isValid: false,
          errors: [{ field: 'userId', message: 'User ID is required' }],
        };
      }

      const user = await User.findById(userId).select('isActive isBlocked isEmailVerified isMobileVerified');

      if (!user) {
        return {
          isValid: false,
          errors: [{ field: 'userId', message: 'User not found' }],
        };
      }

      // if (!user.isActive) {
      //   return {
      //     isValid: false,
      //     errors: [{ field: 'userId', message: 'User account is inactive' }],
      //   };
      // }

      // if (user.isBlocked) {
      //   return {
      //     isValid: false,
      //     errors: [{ field: 'userId', message: 'User account is blocked' }],
      //   };
      // }

      // Check verification requirements
      const verificationErrors = [];
      // if (!user.isEmailVerified) {
      //   verificationErrors.push({
      //     field: 'user.email',
      //     message: 'Email verification required before booking',
      //   });
      // }

      if (!user.isMobileVerified) {
        verificationErrors.push({
          field: 'user.mobile',
          message: 'Mobile verification required before booking',
        });
      }

      if (verificationErrors.length > 0) {
        return {
          isValid: false,
          errors: verificationErrors,
        };
      }

      return {
        isValid: true,
        errors: [],
        data: user,
      };
    } catch (error) {
      logger.error('User validation error', { userId, error: error.message });
      return {
        isValid: false,
        errors: [{ field: 'userId', message: 'User validation failed' }],
      };
    }
  }

  static async validateBusinessRules({ serviceTemplate, normalizedDate, timeSlot, address }) {
    const errors = [];

    try {
      const hasAvailableVendors = await this.checkVendorAvailability(
        serviceTemplate._id,
        normalizedDate,
        timeSlot,
        serviceTemplate
      );

      if (!hasAvailableVendors.success) {
        errors.push({
          field: 'timeSlot',
          message: 'No vendors are available for this service at the selected time',
        });
      }

      // Check minimum advance booking time (if service template has this requirement)
      if (serviceTemplate.minAdvanceBooking) {
        const minBookingTime = new Date();
        minBookingTime.setHours(minBookingTime.getHours() + serviceTemplate.minAdvanceBooking);

        const requestedDateTime = new Date(normalizedDate);
        const [hours, minutes] = timeSlot.split(':').map(Number);
        requestedDateTime.setHours(hours, minutes, 0, 0);

        if (requestedDateTime < minBookingTime) {
          errors.push({
            field: 'timeSlot',
            message: `This service requires at least ${serviceTemplate.minAdvanceBooking} hours advance booking`,
          });
        }
      }

      // Check service area coverage at template level (if defined)
      let isInServiceArea = { isEligible: true, eligibilityResult: [] };
      if (hasAvailableVendors.availableVendorServices.length > 0) {
        const [userLat, userLon] = address.location.coordinates;
        isInServiceArea = await this.checkServiceAreaCoverage(
          hasAvailableVendors.availableVendorServices,
          userLat,
          userLon
        );

        if (!isInServiceArea.isEligible) {
          errors.push({
            field: 'address',
            message: 'Service is not available in your area',
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        eligibleVendor: isInServiceArea.eligibilityResult,
      };
    } catch (error) {
      logger.error('Business rules validation error', { error: error.message });
      return {
        isValid: false,
        errors: [{ field: 'general', message: 'Business rules validation failed' }],
      };
    }
  }

  static async checkVendorAvailability(serviceTemplateId, normalizedDate, timeSlot, serviceTemplate) {
    try {
      const dayOfWeek = this.getDayOfWeek(normalizedDate);
      // Find vendor services that offer this service template
      const vendorServices = await VendorService.find({
        childCategory: serviceTemplate.subCategory._id,
        isActive: true,
        isDeleted: false,
        status: 'approved',
      }).populate({
        path: 'vendor',
        match: {
          isAvailable: true,
          isBlocked: false,
        },
        populate: {
          path: 'address',
        },
      });

      // Filter vendors based on their individual availability settings
      const availableVendorServices = vendorServices.filter((vendorService) => {
        if (!vendorService.vendor) return false;
        if (!vendorService.availability?.isAvailable) return false;
        if (vendorService.availability.workingHours?.[dayOfWeek]) {
          const daySchedule = vendorService.availability.workingHours[dayOfWeek];
          if (!daySchedule.isAvailable) return false;
          if (daySchedule.start && daySchedule.end) {
            const isValidTime = this.isTimeSlotInWorkingHours(timeSlot, daySchedule.start, daySchedule.end);
            if (!isValidTime) return false;
          }
        }

        // Check for vendor-specific holidays
        if (vendorService.availability.holidays) {
          const requestedDateString = normalizedDate.toISOString().split('T')[0];
          const isHoliday = vendorService.availability.holidays.some(
            (holiday) => holiday.date.toISOString().split('T')[0] === requestedDateString
          );
          if (isHoliday) return false;
        }

        return true;
      });

      return {
        success: availableVendorServices.length > 0,
        availableVendorServices,
      };
    } catch (error) {
      logger.error('Error checking vendor availability', {
        serviceTemplateId,
        error: error.message,
      });
      return false;
    }
  }

  static async checkServiceAreaCoverage(availableVendorServices, userLat, userLon) {
    let eligibilityResult = [];

    try {
      for (const service of availableVendorServices) {
        const vendor = service.vendor;
        if (vendor.serviceRadius) {
          const distance = calculateDistance(
            userLat,
            userLon,
            vendor.address.location.coordinates[1],
            vendor.address.location.coordinates[0]
          );

          if (distance <= vendor.serviceRadius) {
            eligibilityResult.push({
              vendorId: vendor._id,
              distance,
              serviceRadius: vendor.serviceRadius,
              fcmToken: vendor.fcmToken,
            });
          }
        }
      }

      return {
        eligibilityResult,
        isEligible: eligibilityResult.length > 0,
      };
    } catch (error) {
      logger.error('Service area coverage check error', { error: error.message });
      return true;
    }
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  static isTimeSlotInWorkingHours(timeSlot, startTime, endTime) {
    try {
      const slotMinutes = this.parseTimeToMinutes(timeSlot);
      const startMinutes = this.parseTimeToMinutes(startTime);
      const endMinutes = this.parseTimeToMinutes(endTime);

      return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
    } catch (error) {
      logger.warn('Error checking working hours', { timeSlot, startTime, endTime });
      return true;
    }
  }

  static parseTimeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  static getDayOfWeek(date) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[date.getDay()];
  }
}
