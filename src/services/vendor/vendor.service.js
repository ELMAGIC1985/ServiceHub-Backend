import { Vendor } from '../../models/index.js';

class VendorService {
  static async findByEmailOrPhone(email, phoneNumber, session = null) {
    try {
      const query = {
        $or: [{ email: email.toLowerCase() }, { phoneNumber: phoneNumber }],
      };

      return await Vendor.findOne(query).session(session);
    } catch (error) {
      logger.error('Error finding vendor by email or phone', { error: error.message, email, phoneNumber });
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      return await Vendor.findOne({ email: email.toLowerCase() });
    } catch (error) {
      logger.error('Error finding vendor by email', { error: error.message, email });
      throw error;
    }
  }

  static async create(vendorData, session = null) {
    try {
      const vendor = new Vendor({
        firstName: vendorData.firstName,
        lastName: vendorData.lastName,
        phoneNumber: vendorData.phoneNumber,
        email: vendorData.email.toLowerCase(),
        dob: new Date(vendorData.dob),
        password: vendorData.password, // Will be hashed by pre-save middleware
        roles: ['VENDOR'],
        profile: {
          isVerified: false,
          isEmailVerified: false,
          isMobileVerified: false,
          isKYCVerified: false,
        },
        metadata: vendorData.metadata || {},
      });

      const savedVendor = await vendor.save({ session });
      logger.info('Vendor created successfully', { vendorId: savedVendor._id, email: savedVendor.email });

      return savedVendor;
    } catch (error) {
      logger.error('Error creating vendor', { error: error.message, email: vendorData.email });
      throw error;
    }
  }

  static async updateVerificationStatus(vendorId, verificationData) {
    try {
      const updateData = {};

      Object.keys(verificationData).forEach((key) => {
        updateData[`profile.${key}`] = verificationData[key];
      });

      const vendor = await Vendor.findByIdAndUpdate(vendorId, { $set: updateData }, { new: true }).select(
        '-password -refreshToken'
      );

      logger.info('Vendor verification status updated', { vendorId, verificationData });
      return vendor;
    } catch (error) {
      logger.error('Error updating vendor verification status', { error: error.message, vendorId });
      throw error;
    }
  }
}

export default VendorService;
