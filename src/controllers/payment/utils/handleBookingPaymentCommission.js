import { Setting, Transaction, Wallet } from '../../../models/index.js';
import { loaderService } from '../../../services/common/loader.query.service.js';
import { walletService } from '../../../services/wallet/wallet.service.js';
import logger from '../../../utils/logger.js';

export const handleBookingPaymentCommission = async (booking, session, metadata = {}) => {
  try {
    const { vendorId } = metadata;

    const settings = await Setting.findOne().session(session);
    if (!settings) throw new Error('SETTINGS_NOT_FOUND');

    const addOnsTotal = booking.pricing?.addOnsTotal || 0;
    const bookingAmount = booking.pricing?.totalAmount || 0;

    // Prevent negative values
    const bookingAmountExcludingAddOns = Math.max(0, bookingAmount - addOnsTotal);

    const addOnsCommissionRate = booking.comission?.totalComissionRate || 0;
    const addOnsCommissionAmount = (addOnsTotal * addOnsCommissionRate) / 100;

    const billingCommissionRate = booking.comission?.totalComissionRate - settings.commissionPerServiceBooking;

    const billingCommissionAmount = (bookingAmountExcludingAddOns * billingCommissionRate) / 100;

    const totalCommissionAmount = billingCommissionAmount + addOnsCommissionAmount;

    const vendorEarning = bookingAmount - totalCommissionAmount;
    const adminCommissionEarning = totalCommissionAmount;

    logger.info('Processing booking payment commission', {
      bookingId: booking._id,
      bookingAmount,
      billingCommissionRate,
      billingCommissionAmount,
      addOnsCommissionRate,
      addOnsCommissionAmount,
      totalCommissionAmount,
      vendorEarning,
      adminCommissionEarning,
    });

    // Load vendor wallet
    const vendorWallet = await loaderService.loadWallet(vendorId, 'Vendor', session);
    const vendorPreviousBalance = vendorWallet.balance;

    // console.log('vendor wallet', vendorEarning, vendorWallet, settings);
    await walletService.credit(vendorWallet, vendorEarning, session);

    const vendorCommissionTxnRef = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const vendorTxnArr = await Transaction.create(
      [
        {
          amount: vendorEarning,
          currency: vendorWallet.currency || 'INR',
          transactionType: 'debit',
          status: 'success',
          paymentMethod: 'wallet',
          transactionFor: 'commission_deduction',

          paymentDetails: {
            paymentStatus: 'credited',
            transactionId: vendorCommissionTxnRef,
            paymentDate: new Date(),
            gateway: { name: 'system' },
            isSignatureVerified: true,
            signatureVerifiedAt: new Date(),
          },

          relatedEntity: {
            entityType: 'Booking',
            entityId: booking._id,
            entityData: {
              bookingNumber: booking.bookingNumber,
              serviceTitle: booking.serviceTemplate?.title,
              bookingAmount,
            },
          },

          user: {
            userType: 'Vendor',
            userId: vendorId,
          },

          statusHistory: [
            {
              status: 'success',
              timestamp: new Date(),
              reason: 'Commission deducted from vendor wallet',
              updatedBy: vendorId,
            },
          ],
        },
      ],
      { session }
    );

    const vendorTransaction = vendorTxnArr[0];
    await walletService.addRecentTransaction(vendorWallet, vendorTransaction._id, session);

    // Admin commission credit
    const adminWallet = await Wallet.findOne({
      userType: 'Admin',
    }).session(session);

    let adminTransaction = null;

    if (adminWallet) {
      await walletService.credit(adminWallet, adminCommissionEarning, session);

      const adminReferenceId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const adminTxnArr = await Transaction.create(
        [
          {
            amount: adminCommissionEarning,
            currency: adminWallet.currency || 'INR',
            transactionType: 'credit',
            status: 'success',
            paymentMethod: 'online',
            transactionFor: 'commission',

            paymentDetails: {
              paymentStatus: 'paid',
              transactionId: adminReferenceId,
              paymentDate: new Date(),
              gateway: { name: 'razorpay' },
              isSignatureVerified: true,
              signatureVerifiedAt: new Date(),
            },

            relatedEntity: {
              entityType: 'Booking',
              entityId: booking._id,
              entityData: {
                bookingNumber: booking.bookingNumber,
                serviceTitle: booking.serviceTemplate?.title,
                vendorId: String(vendorId),
                bookingAmount,
              },
            },

            user: {
              userType: 'Admin',
              userId: adminWallet.userId,
            },

            statusHistory: [
              {
                status: 'success',
                timestamp: new Date(),
                reason: 'Commission credited successfully',
                updatedBy: adminWallet.userId,
              },
            ],
          },
        ],
        { session }
      );

      adminTransaction = adminTxnArr[0];
      await walletService.addRecentTransaction(adminWallet, adminTransaction._id, session);
    }

    logger.info('Booking payment commission complete', {
      bookingId: booking._id,
      vendorTransactionId: vendorTransaction._id,
      adminTransactionId: adminTransaction?._id,
    });

    return {
      vendorTransaction,
      adminTransaction,
      commission: {
        billingCommissionRate,
        billingCommissionAmount,
        addOnsCommissionAmount,
        addOnsCommissionRate,
        totalCommissionAmount,
      },
      vendorEarning,
      vendorWallet: {
        previousBalance: vendorPreviousBalance,
        currentBalance: vendorWallet.balance,
        currency: vendorWallet.currency,
      },
    };
  } catch (error) {
    logger.error('Error in commission handler', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};
