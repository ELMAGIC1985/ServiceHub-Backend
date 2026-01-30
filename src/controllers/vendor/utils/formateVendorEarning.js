export function formatVendorBookingEarning(bookings) {
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

    const commissionRate = commission.bookingComissionRate || 0;
    const vendorEarning = totalAmount - commissionAmount;

    return {
      bookingId: b.bookingId,
      date: commission.deductedAt || b.createdAt,
      status: commission.status,

      totalAmount,
      quantity: pricing.quantity || 1,

      commissionRate,
      commissionAmount,
      vendorEarning: Number(vendorEarning.toFixed(2)),

      pricing,
      commission,
    };
  });
}

export const vendorTodaysEarningsAndCommission = (bookings) => {
  const earnings = formatVendorBookingEarning(bookings);

  const totalEarnings = earnings.reduce((sum, t) => sum + t.vendorEarning, 0).toFixed(2);
  const totalCommission = earnings.reduce((sum, t) => sum + t.commissionAmount, 0).toFixed(2);

  return {
    totalEarnings: Number(totalEarnings) || 0,
    totalCommission: Number(totalCommission) || 0,
  };
};
