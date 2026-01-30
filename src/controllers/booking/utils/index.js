import { Membership, Setting } from '../../../models/index.js';

export const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const validateBookingData = ({ serviceId, date, address }) => {
  const errors = [];

  if (!serviceId) errors.push('Service ID is required');
  if (!date) errors.push('Date is required');
  if (!address) errors.push('Address is required');
  if (!address?.location?.coordinates) errors.push('Valid coordinates are required');

  return errors;
};

export const calculateBookingPricing = async (service, appliedCoupon, user) => {
  const settings = await Setting.findOne();
  const membership = await Membership.findOne({ memberId: user?._id });

  const pricing = service.pricingGuidelines;
  let basePrice = pricing.basePrice;
  let discountAmount = 0;
  let couponDiscount = 0;
  let membershipDiscount = 0;

  // 1️⃣ Service discount
  if (service.discountPrice && service.discountPrice < basePrice) {
    discountAmount = basePrice - service.discountPrice;
    basePrice = service.discountPrice;
  }

  // 2️⃣ After service discount
  let priceAfterDiscount = basePrice - discountAmount;

  // 3️⃣ Coupon discount
  if (appliedCoupon?.couponCode) {
    const coupon = findValidCoupon([], appliedCoupon.couponCode);
    if (coupon) {
      couponDiscount = Math.min(
        (priceAfterDiscount * coupon.discountPercentage) / 100,
        coupon.maxDiscountAmount || Infinity
      );
    }
  }

  // 4️⃣ After coupon discount
  let priceAfterCoupon = priceAfterDiscount - couponDiscount;

  // 5️⃣ Membership discount (active & usable)
  if (membership && membership.status !== 'EXPIRED' && membership.membershipUsage > 0) {
    const membershipRate = settings.membershipDiscountRate || 0; // e.g. 10%
    membershipDiscount = (priceAfterCoupon * membershipRate) / 100;
  }

  // 6️⃣ Final price after membership discount
  const finalPrice = priceAfterCoupon - membershipDiscount;

  // 7️⃣ Tax and fees
  const TAX_RATE = settings.serviceTaxRate;
  const PLATFORM_FEE = settings.platformFee;

  const taxAmount = (finalPrice * TAX_RATE) / 100;
  const platformFee = PLATFORM_FEE;
  const totalAmount = finalPrice + taxAmount + platformFee;

  return {
    basePrice: pricing.basePrice,
    discountAmount,
    couponDiscount,
    membershipDiscount,
    finalPrice,
    taxAmount: taxAmount.toFixed(2),
    platformFee,
    totalAmount,
  };
};

export const findValidCoupon = (coupons, couponCode) => {
  return coupons.find(
    (coupon) => coupon.couponCode === couponCode.toUpperCase() && coupon.isActive && coupon.expiryDate > new Date()
  );
};
