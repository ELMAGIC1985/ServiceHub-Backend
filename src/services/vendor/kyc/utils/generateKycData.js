import { KYC_STATUSES } from '../../../../constants/constants.js';

export function getKycData({ vendorId, value, addressSaved, metadata = {} }) {
  return {
    vendor: vendorId,
    firstName: value.firstName,
    lastName: value.lastName,
    middleName: value.middleName || '',
    email: value.email,
    dob: value.dob,
    purpose: value.purpose,
    occupation: value.occupation || '',
    phoneNumber: value.phoneNumber,
    serviceRadius: value.serviceRadius,
    address: addressSaved.data._id,
    primaryDocument: value.primaryDocument,
    secondaryDocument: value.secondaryDocument || undefined,
    selfieImage: value.selfieImage,
    kycAmount: value.kycAmount || 0,
    ipAddress: metadata.ipAddress || '',
    userAgent: metadata.userAgent || '',
    submittedAt: new Date(),
    kycStatus: KYC_STATUSES.PENDING,
  };
}
