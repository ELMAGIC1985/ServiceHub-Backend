import { Transaction } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { loaderService } from '../common/loader.query.service.js';
import { walletService } from '../wallet/wallet.service.js';

class CommissionSettlementService {
  async settleCommission({
    vendorId,
    vendorWallet,
    bookingId,
    commissionAmount,
    paymentBreakdown,
    source = 'wallet',
    session,
  }) {
    const adminWallet = await walletService.getAdminWallet('Admin', session);
    const admin = await loaderService.loadAdmin(session);

    const adminId = admin._id;

    if (vendorWallet.balance < commissionAmount) {
      throw new ApiError(400, 'Insufficient vendor balance');
    }

    vendorWallet.balance -= commissionAmount;
    adminWallet.balance += commissionAmount;

    const referenceGroup = `COMM_${bookingId}_${Date.now()}`;

    const vendorTxn = await Transaction.create(
      [
        {
          amount: commissionAmount,
          currency: 'INR',
          transactionType: 'debit',
          transactionFor: 'commission_deduction',
          status: 'success',
          paymentMethod: source === 'wallet' ? 'wallet' : 'cash',

          user: {
            userType: 'Vendor',
            userId: vendorId,
          },

          relatedEntity: {
            entityType: 'Booking',
            entityId: bookingId,
          },

          metadata: {
            description: `Commission deducted for booking ${bookingId}`,
            channel: 'system',
          },

          financial: {
            grossAmount: commissionAmount,
            netAmount: commissionAmount,
            fees: {
              platformFee: commissionAmount,
            },
          },

          references: {
            referenceId: `${referenceGroup}_VENDOR`,
          },

          statusHistory: [
            {
              status: 'success',
              reason: 'Commission deducted from vendor wallet',
            },
          ],
        },
      ],
      { session }
    );

    const adminTxn = await Transaction.create(
      [
        {
          amount: commissionAmount,
          currency: 'INR',
          transactionType: 'credit',
          transactionFor: 'commission_credit',
          status: 'success',
          paymentMethod: source === 'wallet' ? 'wallet' : 'cash',

          user: {
            userType: 'Admin',
            userId: adminId,
          },

          relatedEntity: {
            entityType: 'Booking',
            entityId: bookingId,
          },

          metadata: {
            description: `Commission earned from booking ${bookingId}`,
            channel: 'system',
          },

          financial: {
            grossAmount: commissionAmount,
            netAmount: commissionAmount,
          },

          references: {
            referenceId: `${referenceGroup}_ADMIN`,
            parentTransactionId: vendorTxn[0]._id,
          },

          statusHistory: [
            {
              status: 'success',
              reason: 'Commission credited to admin wallet',
            },
          ],
        },
      ],
      { session }
    );

    await vendorWallet.save({ session });
    await adminWallet.save({ session });

    return {
      mode: 'wallet',
      success: true,
      vendorTransaction: vendorTxn[0],
      adminTransaction: adminTxn[0],
      vendorWallet,
      adminWallet,
    };
  }
}

const commissionSettlementService = new CommissionSettlementService();

export { commissionSettlementService };
