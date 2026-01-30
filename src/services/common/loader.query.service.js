import { bookingPopulate, bookingSelect } from '../../config/populate/bookingPopulate.js';
import { STATUS } from '../../constants/constants.js';
import {
  Booking,
  Vendor,
  Setting,
  Admin,
  ServiceTemplate,
  User,
  Address,
  Coupon,
  Membership,
  Wallet,
  Transaction,
} from '../../models/index.js';
import { ApiError } from '../../utils/index.js';

class LoaderService {
  async loadBooking(bookingId, session) {
    const booking = await Booking.findById(bookingId)
      .populate('user', 'firstName lastName email phone')
      .populate('serviceTemplate', 'title description images')
      .populate('address')
      .session(session);
    if (!booking) throw new ApiError(STATUS.NOT_FOUND, 'Booking not found');
    return booking;
  }

  async loadBookingByIdWithPopulate(bookingId, session) {
    const booking = await Booking.findById(bookingId).populate(bookingPopulate).select(bookingSelect).session(session);
    if (!booking) throw new ApiError(STATUS.NOT_FOUND, 'Booking not found');
    return booking;
  }

  async loadVendor(vendorId, session) {
    const vendor = await Vendor.findById(vendorId)
      .select('isAvailable isBlocked isOnline isMobileVerified role fcmToken')
      .session(session);
    if (!vendor) throw new ApiError(STATUS.NOT_FOUND, 'Vendor not found');
    if (!vendor.isAvailable) throw new ApiError(STATUS.BAD_REQUEST, 'Vendor not available');
    if (vendor.isBlocked) throw new ApiError(STATUS.BAD_REQUEST, 'Vendor is blocked');
    return vendor;
  }

  async loadVendorByPhoneNumber(phoneNumber, session) {
    const vendor = await Vendor.findOne({ phoneNumber })
      .select('isAvailable isBlocked isOnline isMobileVerified role')
      .session(session);
    // if (!vendor) throw new ApiError(STATUS.NOT_FOUND, 'Vendor not found');
    // if (!vendor.isAvailable) throw new ApiError(STATUS.BAD_REQUEST, 'Vendor not available');
    // if (vendor.isBlocked) throw new ApiError(STATUS.BAD_REQUEST, 'Vendor is blocked');
    return vendor;
  }

  async loadSetting(session) {
    const settings = await Setting.findOne().session(session);
    if (!settings) throw new ApiError(STATUS.NOT_FOUND, 'Setting not found');
    return settings;
  }

  async loadAdmin(session) {
    const admin = await Admin.findOne({
      role: 'admin',
    }).session(session);
    if (!admin) throw new ApiError(STATUS.NOT_FOUND, 'Admin not found');
    return admin;
  }

  async loadServiceTemplate(serviceTemplateId, session) {
    const serviceTemplate = await ServiceTemplate.findOne({
      _id: serviceTemplateId,
      isDeleted: false,
      isActive: true,
    }).session(session);
    if (!serviceTemplate) throw new ApiError(STATUS.NOT_FOUND, 'Service not found');
    return serviceTemplate;
  }

  async loadUser(userId, session) {
    const user = await User.findOne({
      _id: userId,
      isDeleted: false,
      isBlocked: false,
    })
      .select('isAvailable isBlocked isOnline')
      .session(session);

    if (!user) {
      throw new ApiError(STATUS.NOT_FOUND, 'User not found');
    }

    if (user.isBlocked) {
      throw new ApiError(STATUS.BAD_REQUEST, 'User is blocked');
    }

    return user;
  }

  async loadAddress(addressId, session) {
    const address = await Address.findById(addressId).session(session);
    if (!address) throw new ApiError(STATUS.NOT_FOUND, 'Address not found');
    return address;
  }

  async loadCoupon(couponCode, session) {
    const coupon = await Coupon.findOne({ code: couponCode }).session(session);
    if (!coupon) throw new ApiError(STATUS.NOT_FOUND, 'Coupon not found');
    return coupon;
  }

  async loadMembership(memberId, memberType, session) {
    const membership = await Membership.findOne({ memberId, memberType }).session(session);
    // if (!membership) throw new ApiError(STATUS.NOT_FOUND, 'Membership not found');
    return membership;
  }

  async loadWallet(userId, userType, session) {
    console.log('userId', userId, userType);
    const wallet = await Wallet.findOne({ userId, userType, status: 'active' }).session(session);
    if (!wallet) throw new ApiError(STATUS.NOT_FOUND, 'Wallet not found');
    return wallet;
  }

  async loadWalletById(walletId, session) {
    const wallet = await Wallet.findById(walletId).where('status').equals('active').session(session);
    console.log('wallet from loader', wallet);
    if (!wallet) throw new ApiError(STATUS.NOT_FOUND, 'Wallet not found');
    return wallet;
  }

  async loadTransaction(transactionId, session) {
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) throw new ApiError(STATUS.NOT_FOUND, 'Transaction not found');
    return transaction;
  }

  async loadTransactionByEntityTypeAndEntityId(entityType, entityId, filter, session) {
    const transaction = await Transaction.findOne({
      [`relatedEntity.entityType`]: entityType,
      [`relatedEntity.entityId`]: entityId,
      ...filter,
    }).session(session);

    if (!transaction) throw new ApiError(STATUS.NOT_FOUND, 'Transaction not found');
    return transaction;
  }

  async loadUserByUserTypeAndUserId(userType, userId) {
    let user = null;
    if (userType === 'Vendor') {
      user = await Vendor.findById(userId);
    } else if (userType === 'User') {
      user = await User.findById(userId);
    } else if (userType === 'Admin') {
      user = await Admin.findById(userId);
    }

    if (!user) {
      throw new ApiError(STATUS.NOT_FOUND, 'User not found');
    }

    return user;
  }
}

const loaderService = new LoaderService();

export { loaderService };
