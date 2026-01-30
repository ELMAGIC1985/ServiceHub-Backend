import { KYC_STATUSES } from '../../../constants/constants.js';
import { Vendor, VendorKYC } from '../../../models/index.js';
import { ApiError } from '../../../utils/ApiError.js';
import logger from '../../../utils/logger.js';
import { kycApplicationSchema } from '../../../validators/vendor/kyc.validation.js';
import { addressService } from '../../address/address.command.service.js';
import { getKycData } from './utils/generateKycData.js';

class KycService {
  async submitKycApplication(vendorId, kycData, metadata = {}) {
    try {
      const { error, value } = kycApplicationSchema.validate(kycData, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const validationErrors = error.details.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        logger.error('validationErrors', validationErrors);
        throw new ApiError(400, 'Validation failed', validationErrors);
      }

      const vendor = await Vendor.findById(vendorId);

      if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
      }

      let kycApplication = await VendorKYC.findOne({ vendor: vendorId });

      if (kycApplication?.kycStatus === KYC_STATUSES.APPROVED) {
        throw new ApiError(400, 'KYC is already approved and cannot be modified');
      }

      const addressSaved = await addressService.createAddress(value.address);

      if (!addressSaved.success) {
        throw new ApiError(400, 'Unable to create address');
      }

      const kycPayload = getKycData({
        vendorId,
        value,
        addressSaved,
        metadata,
      });

      if (kycApplication) {
        Object.assign(kycApplication, kycPayload);
        await kycApplication.save();
      } else {
        kycApplication = await VendorKYC.create(kycPayload);
      }

      await this._updateVendorDetails(vendorId, value, addressSaved.data.id);
      vendor.kyc = kycApplication._id;
      await vendor.save();

      const updatedVendor = await Vendor.findById(vendorId).select(
        'firstName lastName middleName email dob purpose kycStatus kycAmount documentType documentImage selfieImage phoneNumber'
      );

      return {
        success: true,
        message: 'KYC application submitted successfully and vendor details updated',
        data: {
          kycId: kycApplication._id,
          status: kycApplication.kycStatus,
          completionPercentage: kycApplication.completionPercentage,
          updatedVendorDetails: {
            name: `${updatedVendor.firstName} ${updatedVendor.lastName}`.trim(),
            email: updatedVendor.email,
            phoneNumber: updatedVendor.phoneNumber,
            kycStatus: updatedVendor.kycStatus,
            kycAmount: updatedVendor.kycAmount,
            documentType: updatedVendor.documentType,
            hasDocumentImage: !!updatedVendor.documentImage,
            hasSelfieImage: !!updatedVendor.selfieImage,
          },
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
        }));
        throw new ApiError(400, 'Database validation failed', validationErrors);
      }

      console.error('KYC Submission Error:', error);
      throw new ApiError(500, 'Failed to submit KYC application', error.message);
    }
  }

  async _updateVendorDetails(vendorId, kycData, addressId) {
    const vendorUpdateData = {
      kycStatus: KYC_STATUSES.PENDING,
      kycAmount: kycData.kycAmount || 0,
      address: addressId,
      firstName: kycData.firstName,
      lastName: kycData.lastName,
      middleName: kycData.middleName || '',
      email: kycData.email,
      dob: kycData.dob,
      purpose: kycData.purpose,
      serviceRadius: kycData.serviceRadius,
    };

    if (kycData.primaryDocument?.type) {
      vendorUpdateData.documentType = kycData.primaryDocument.type;
    }

    if (kycData.primaryDocument?.frontImage) {
      vendorUpdateData.documentImage = kycData.primaryDocument.frontImage;
    }

    if (kycData.selfieImage) {
      vendorUpdateData.avatar = kycData.selfieImage;
    }

    await Vendor.findByIdAndUpdate(vendorId, vendorUpdateData, { new: true });
  }
}

const kycService = new KycService();

export default kycService;
