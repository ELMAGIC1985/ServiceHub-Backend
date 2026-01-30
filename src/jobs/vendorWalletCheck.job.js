import { Vendor } from '../models/index.js';

export const vendorWalletCheckJob = async () => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const vendors = await Vendor.updateMany(
    {
      'wallet.pendingBalance': { $gt: 0 },
      'wallet.pendingSince': { $lte: oneWeekAgo },
      isBlocked: false,
    },
    {
      $set: {
        isBlocked: true,
        blockReason: 'PENDING_WALLET_BALANCE',
      },
    }
  );

  console.log(`Blocked ${vendors.modifiedCount} vendors`);
};
