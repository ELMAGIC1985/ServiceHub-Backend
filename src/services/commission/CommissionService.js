import { Transaction } from '../../models/index.js';
import { walletService } from '../wallet/wallet.service.js';
import { commissionSettlementService } from './commission.settlement.service.js';

class CommissionService {
  async handleCashPaymentCommission({ vendorId, commissionAmount, booking, orderId, session, paymentBreakdown }) {
    const vendorWallet = await walletService.getWallet(vendorId, 'Vendor');

    console.log('Processing cash payment commission', {
      vendorId,
      commissionAmount,
      // vendorWallet,
    });

    // ✅ CASE 1: Wallet has sufficient balance
    if (vendorWallet.balance >= commissionAmount) {
      console.log('Settling commission - CASE 1', { vendorId, commissionAmount });
      return await this.deductCommissionFromWallet({
        vendorWallet,
        vendorId,
        commissionAmount,
        paymentBreakdown,
        booking,
        orderId,
        session,
      });
    }

    // ✅ CASE 2: Wallet insufficient → create liability
    return await this.setPendingCommission({
      vendorWallet,
      vendorId,
      commissionAmount,
      booking,
      orderId,
      session,
    });
  }

  async deductCommissionFromWallet({ vendorWallet, commissionAmount, vendorId, booking, paymentBreakdown, session }) {
    return await commissionSettlementService.settleCommission({
      vendorId,
      vendorWallet,
      bookingId: booking._id,
      commissionAmount,
      paymentBreakdown,
      source: 'wallet',
      session,
    });
  }

  // ✅ CASE 2
  async setPendingCommission({ vendorWallet, commissionAmount, vendorId, booking, orderId, session }) {
    const bookingId = booking._id;

    console.log('Setting pending commission - CASE 2', { vendorId, commissionAmount, vendorWallet });

    vendorWallet.pendingBalance += commissionAmount;

    const commissionLiabilityTxn = await Transaction.create(
      [
        {
          amount: commissionAmount,
          currency: 'INR',

          transactionType: 'liability',
          transactionFor: 'commission_payable',

          status: 'outstanding',
          paymentMethod: 'cash',

          user: {
            userType: 'Vendor',
            userId: vendorId,
          },

          relatedEntity: {
            entityType: 'Booking',
            entityId: bookingId,
          },

          metadata: {
            description: `Commission payable for cash booking ${bookingId}`,
            notes: `Vendor collected cash. Commission ₹${commissionAmount} payable.`,
            channel: 'system',

            liabilityType: 'commission',
            collectionMode: 'cash',
            enforceAfterDays: 3,
          },

          financial: {
            grossAmount: commissionAmount,
            netAmount: commissionAmount,
            fees: {
              platformFee: commissionAmount,
            },
          },

          statusHistory: [
            {
              status: 'outstanding',
              timestamp: new Date(),
              reason: 'Commission pending due to insufficient wallet balance',
            },
          ],
        },
      ],
      { session }
    );

    await vendorWallet.save({ session });

    return {
      mode: 'liability_created',
      vendorWallet,
      transaction: commissionLiabilityTxn[0],
      orderId,
      bookingId,
      commissionAmount,
    };
  }
}

const commissionService = new CommissionService();

export { CommissionService, commissionService };
