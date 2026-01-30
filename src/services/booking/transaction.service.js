import { Booking, Transaction } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

export const TransactionService = {
  async createCommissionTransactions({
    vendorWallet,
    adminWallet,
    booking,
    commissionInfo,
    vendorId,
    adminUserId,
    req,
    session,
  }) {
    try {
      const { amount: commissionAmount, rate: commissionRate } = commissionInfo;

      const referenceId = this.generateReferenceId();
      const adminReferenceId = this.generateReferenceId();

      const bookingAmount = booking?.pricing?.totalAmount || 0;
      const vendorPreviousBalance = vendorWallet.balance;
      const adminPreviousBalance = adminWallet.balance;

      const vendorTransactionData = {
        amount: commissionAmount,
        currency: vendorWallet.currency || 'INR',
        transactionType: 'debit',
        status: 'success',
        paymentMethod: 'wallet',
        transactionFor: 'commission',

        paymentDetails: {
          paymentStatus: 'paid',
          transactionId: referenceId,
          paymentDate: new Date(),
          gateway: { name: 'manual' },
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

        metadata: {
          description: `Commission deducted for booking ${booking.bookingNumber || booking._id}`,
          notes: `${commissionRate}% commission on booking amount ₹${bookingAmount}`,
          tags: ['commission', 'booking', 'vendor-charge'],
          channel: req?.headers['user-agent']?.includes('Mobile') ? 'mobile_app' : 'web',
          customFields: {
            commissionRate,
            bookingAmount,
            previousBalance: vendorPreviousBalance,
            newBalance: vendorPreviousBalance - commissionAmount,
            settingsId: commissionInfo.settingsId,
          },
        },

        financial: {
          grossAmount: commissionAmount,
          netAmount: commissionAmount,
          settlement: {
            status: 'settled',
            settlementDate: new Date(),
            settlementAmount: commissionAmount,
          },
        },

        references: {
          referenceId,
          invoiceNumber: `INV-${booking.bookingNumber || booking._id}`,
        },

        audit: {
          createdBy: vendorId,
          ipAddress: req?.ip || req?.connection?.remoteAddress,
          userAgent: req?.headers['user-agent'],
          source: 'booking_acceptance',
        },

        statusHistory: [
          {
            status: 'success',
            timestamp: new Date(),
            reason: 'Commission deducted successfully',
            updatedBy: vendorId,
          },
        ],
      };

      const [vendorTransaction] = await Transaction.create([vendorTransactionData], { session });

      // await WalletService.deductCommission({ vendorId, amount: commissionAmount, session });
      // await WalletService.addRecentTransaction(vendorWallet, vendorTransaction._id, session);

      vendorWallet.balance -= commissionAmount;
      vendorWallet.recentTransactions.unshift(vendorTransaction._id);
      vendorWallet.recentTransactions = vendorWallet.recentTransactions.slice(0, 10);
      await vendorWallet.save({ session });

      const adminTransactionData = {
        amount: commissionAmount,
        currency: adminWallet.currency || 'INR',
        transactionType: 'credit',
        status: 'success',
        paymentMethod: 'wallet',
        transactionFor: 'commission',

        paymentDetails: {
          paymentStatus: 'paid',
          transactionId: adminReferenceId,
          paymentDate: new Date(),
          gateway: { name: 'manual' },
          isSignatureVerified: true,
          signatureVerifiedAt: new Date(),
        },

        relatedEntity: {
          entityType: 'Booking',
          entityId: booking._id,
          entityData: {
            bookingNumber: booking.bookingNumber,
            serviceTitle: booking.serviceTemplate?.title,
            vendorId: vendorId.toString(),
            bookingAmount,
          },
        },

        user: {
          userType: 'Admin',
          userId: adminUserId,
        },

        metadata: {
          description: `Commission received from vendor for booking ${booking.bookingNumber || booking._id}`,
          notes: `${commissionRate}% commission from vendor ${vendorId}`,
          tags: ['commission', 'booking', 'revenue'],
          channel: req?.headers['user-agent']?.includes('Mobile') ? 'mobile_app' : 'web',
          customFields: {
            commissionRate,
            bookingAmount,
            vendorId: vendorId.toString(),
            previousBalance: adminPreviousBalance,
            newBalance: adminPreviousBalance + commissionAmount,
            vendorTransactionId: vendorTransaction._id.toString(),
          },
        },

        financial: {
          grossAmount: commissionAmount,
          netAmount: commissionAmount,
          settlement: {
            status: 'settled',
            settlementDate: new Date(),
            settlementAmount: commissionAmount,
          },
        },

        references: {
          referenceId: adminReferenceId,
          parentTransactionId: vendorTransaction._id,
          invoiceNumber: `INV-${booking.bookingNumber || booking._id}`,
        },

        audit: {
          createdBy: adminUserId,
          ipAddress: req?.ip || req?.connection?.remoteAddress,
          userAgent: req?.headers['user-agent'],
          source: 'booking_acceptance',
        },

        statusHistory: [
          {
            status: 'success',
            timestamp: new Date(),
            reason: 'Commission credited successfully',
            updatedBy: adminUserId,
          },
        ],

        reconciliation: {
          isReconciled: true,
          reconciledAt: new Date(),
          reconciledBy: adminUserId,
        },

        riskAssessment: {
          riskScore: 0,
          isFlagged: false,
          reviewRequired: false,
        },
      };

      const [adminTransaction] = await Transaction.create([adminTransactionData], { session });

      adminWallet.balance += commissionAmount;
      adminWallet.recentTransactions.unshift(adminTransaction._id);
      adminWallet.recentTransactions = adminWallet.recentTransactions.slice(0, 10);
      await adminWallet.save({ session });

      return { vendorTransaction, adminTransaction };
    } catch (error) {
      logger.error('Error creating commission transactions', { error: error.message });
      throw error;
    }
  },

  async getVendorBookingTransactions({ vendorId }) {
    const bookings = await Booking.find({
      'vendorSearch.assignedVendor.vendorId': vendorId,
      status: 'completed',
      paymentStatus: 'paid',
    })
      .sort({ createdAt: -1 })
      .lean();

    return this.formatVendorBookingHistory(bookings);
  },

  formatVendorBookingHistory(bookings) {
    return bookings.map((b) => {
      const commission = b.comission || {};
      const pricing = b.pricing || {};

      const totalAmount = pricing.totalAmount || 0;
      let commissionAmount = 0;

      if (commission.billingComissionAmount) {
        commissionAmount += commission.billingComissionAmount;
      }

      if (commission.bookingComissionAmount) {
        commissionAmount += commission.bookingComissionAmount;
      }

      if (commission.addOnsComissionAmount) {
        commissionAmount += commission.addOnsComissionAmount;
      }

      const commissionRate = commission.totalComissionRate || 0;

      const vendorEarning = totalAmount - commissionAmount;

      return {
        bookingId: b.bookingId,
        date: commission.deductedAt || b.createdAt,
        status: commission.status,

        totalAmount,
        quantity: pricing.quantity || 1,

        commissionRate,
        commissionAmount: Number(commissionAmount.toFixed(2)),
        vendorEarning: Number(vendorEarning.toFixed(2)),

        pricing,
        commission,
      };
    });
  },

  generateReferenceId() {
    return `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  },
};
