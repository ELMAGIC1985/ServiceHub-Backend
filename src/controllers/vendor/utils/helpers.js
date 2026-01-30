export const formatVendorData = (vendor) => {
  if (!vendor) return null;
  const address = vendor.addresses.find((addr) => addr.isCurrent) || null;
  return {
    id: vendor._id,
    name: `${vendor.firstName} ${vendor.lastName}`,
    phoneNumber: vendor.phoneNumber,
    email: vendor.email,
    dob: vendor.dob ? new Date(vendor.dob).toISOString() : null,
    role: vendor.role,
    selfieImage: vendor.selfieImage,
    documentImage: vendor.documentImage,
    verification: {
      isVerified: vendor.isVerified,
      isEmailVerified: vendor.isEmailVerified,
      isMobileVerified: vendor.isMobileVerified,
      isKYCVerified: vendor.isKYCVerified,
      kycStatus: vendor.kycStatus,
      isKYCPaymentVerified: vendor.isKYCPaymentVerified,
    },
    availability: vendor.isAvailable,
    address: {
      street: address?.address.street || null,
      city: address?.address.city || null,
      state: address?.address.state || null,
      country: address?.address.country || null,
      pincode: address?.address.pincode || null,
      location: address?.address.location || null,
    },
    wallet: vendor.wallet
      ? {
          balance: vendor.wallet.balance,
          currency: vendor.wallet.currency,
          transactions: vendor.wallet.transactions || [],
        }
      : null,
    createdAt: new Date(vendor.createdAt).toISOString(),
    updatedAt: new Date(vendor.updatedAt).toISOString(),
    socketId: vendor.socketId || null,
  };
};

function getWeeksInMonth(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return Math.ceil((lastDay.getDate() - firstDay.getDate() + 1 + firstDay.getDay()) / 7);
}

// Helper function to get week number in a month
function getWeekNumber(year, month, weekIndex) {
  const firstDay = new Date(year, month, 1);
  const targetDate = new Date(year, month, (weekIndex - 1) * 7 + 1);
  return Math.ceil((targetDate - firstDay) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// Helper function to get week of month for a date
function getWeekOfMonth(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
}

export { getWeeksInMonth, getWeekNumber, getWeekOfMonth };
