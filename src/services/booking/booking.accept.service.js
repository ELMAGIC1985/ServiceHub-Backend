import { BOOKING_STATUSES } from '../../constants/constants.js';
import { formatBooking } from '../../controllers/booking/utils/formatBooking.js';
import { loaderService } from '../common/loader.query.service.js';
import { VendorEligibilityService, CommissionService, WalletService, TransactionService } from './index.js';

export const BookingService = {
  async acceptBooking({ vendorId, bookingId, req, session }) {
    const booking = await loaderService.loadBooking(bookingId, session);
    const vendor = await loaderService.loadVendor(vendorId, session);
    const settings = await loaderService.loadSetting();
    const admin = await loaderService.loadAdmin();
    const adminWallet = await WalletService.getAdminWallet('Admin', session);
    const vendorWallet = await WalletService.getWallet(vendorId, 'Vendor', session);

    await VendorEligibilityService.validateBooking({ booking, vendor, session });
    const commissionInfo = await CommissionService.calculateBookingComission({ booking, settings });

    const transactions = await TransactionService.createCommissionTransactions({
      vendorWallet,
      adminWallet,
      booking,
      commissionInfo,
      vendorId,
      adminUserId: admin?._id,
      req,
      session,
    });

    await this.updateBookingStatus({ booking, vendorId, commissionInfo, session });

    booking.comission = {
      ...booking.comission,
      bookingComissionRate: commissionInfo.rate,
      bookingComissionAmount: commissionInfo.amount,
      deductedAt: new Date(),
      vendorTransactionId: transactions.vendorTransaction._id,
      adminTransactionId: transactions.adminTransaction?._id || null,
      status: 'processing',
    };

    const membershipDiscount = booking.pricing.membershipDiscount || 0;

    await this.updateMembershipUsase(booking.user, membershipDiscount, session);

    await booking.save({ session });
    return this.formatBookingResponse(booking, commissionInfo, vendorWallet, transactions);
  },

  async updateBookingStatus({ booking, vendorId, commissionInfo }) {
    booking.status = BOOKING_STATUSES.VENDOR_ASSIGNED;
    const vendorInfo = booking.vendorSearch.eligibleVendors.find((v) => v.vendorId.toString() === vendorId.toString());
    booking.vendorSearch.assignedVendor = {
      vendorId,
      assignedAt: new Date(),
      acceptedAt: new Date(),
      distance: vendorInfo?.distance || 0,
    };
    booking.addStatusHistory(
      BOOKING_STATUSES.VENDOR_ASSIGNED,
      vendorId,
      'Vendor',
      `Commission deducted: ₹${commissionInfo.amount}`
    );
  },

  async updateMembershipUsase(userId, membershipDiscount, session) {
    const user = await loaderService.loadUser(userId);
    const membership = await loaderService.loadMembership(user._id, 'User');
    if (!membership) return;

    membership.membershipUsage -= membershipDiscount;
    await membership.save({ session });
    return membership;
  },

  formatBookingResponse(booking) {
    return {
      booking: formatBooking(booking),
      nextSteps: ['Contact customer if needed', 'Start heading to the location', 'Update status when you arrive'],
    };
  },
};
