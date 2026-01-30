import { Coupon, Membership } from '../../models/index.js';
import { loaderService } from '../common/loader.query.service.js';

class BookingPriceClass {
  async calculateBookingPricing({ service, appliedCoupon, user, settings, quantity = 1 }) {
    const membership = await Membership.findOne({ memberId: user?._id });
    const pricing = service.pricingGuidelines;

    const validQuantity = Math.max(1, Math.floor(quantity || 1));

    let basePrice = this.getBasePrice(pricing);

    const subtotal = basePrice * validQuantity;

    let { priceAfterCoupon, couponDiscount } = await this.applyCoupon(appliedCoupon, subtotal);

    let { priceAfterMembership, membershipDiscount } = this.applyMembershipDiscount(
      priceAfterCoupon,
      membership,
      settings
    );

    let { taxAmount, platformFee, totalAmount } = this.applyTaxesAndFees(priceAfterMembership, settings);

    return {
      basePrice: pricing.basePrice,
      quantity: validQuantity,
      subtotal,
      couponDiscount,
      membershipDiscount,
      finalPrice: priceAfterMembership,
      taxAmount,
      platformFee,
      totalAmount,
    };
  }

  async calculateBookingPricingWithAddons({ pricing, addonsTotalAmount }) {
    const settings = await loaderService.loadSetting();
    let { taxAmount, platformFee, totalAmount } = this.applyTaxesAndFees(
      pricing.finalPrice + addonsTotalAmount,
      settings
    );

    return {
      basePrice: pricing.basePrice,
      quantity: pricing.quantity,
      subtotal: pricing.basePrice,
      discountAmount: pricing.discountAmount,
      couponDiscount: pricing.couponDiscount,
      membershipDiscount: pricing.membershipDiscount,
      finalPrice: pricing.finalPrice,
      taxAmount,
      platformFee,
      totalAmount,
      addOnsTotal: addonsTotalAmount,
    };
  }

  getBasePrice(pricing) {
    return pricing.basePrice;
  }

  async applyCoupon(couponCode, totalPrice) {
    if (!couponCode || typeof couponCode !== 'string') {
      return { priceAfterCoupon: totalPrice, couponDiscount: 0 };
    }

    const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase() });

    console.log('Applying coupon:', couponCode, coupon);

    if (!coupon) {
      return { priceAfterCoupon: totalPrice, couponDiscount: 0 };
    }

    // Check minimum purchase
    if (totalPrice < (coupon.minPurchase || 0)) {
      return { priceAfterCoupon: totalPrice, couponDiscount: 0 };
    }

    let couponDiscount = 0;

    if (coupon.discountType === 'percentage') {
      couponDiscount = (totalPrice * coupon.discountValue) / 100;

      console.log('Calculated percentage coupon discount1:', couponDiscount);

      if (coupon.maxDiscount) {
        couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
      }

      console.log('Calculated percentage coupon discount2:', couponDiscount);
    } else {
      // Flat discount (applied once per order)
      couponDiscount = coupon.discountValue;
      console.log('Calculated flat coupon discount:', couponDiscount);
    }

    const finalPrice = Math.max(0, totalPrice - couponDiscount);

    return {
      priceAfterCoupon: finalPrice,
      couponDiscount,
    };
  }

  applyMembershipDiscount(priceAfterCoupon, membership, settings) {
    if (!membership) {
      return { priceAfterMembership: priceAfterCoupon, membershipDiscount: 0 };
    }

    if (['EXPIRED', 'CANCELLED', 'PENDING'].includes(membership.status.toUpperCase())) {
      return { priceAfterMembership: priceAfterCoupon, membershipDiscount: 0 };
    }

    if (!membership.membershipUsage || membership.membershipUsage <= 0) {
      return { priceAfterMembership: priceAfterCoupon, membershipDiscount: 0 };
    }

    const membershipRate = settings.membershipDiscountRate || 0;
    const membershipDiscount = (priceAfterCoupon * membershipRate) / 100;

    return {
      priceAfterMembership: priceAfterCoupon - membershipDiscount,
      membershipDiscount,
    };
  }

  applyTaxesAndFees(priceAfterMembership, settings) {
    const TAX_RATE = settings.serviceTaxRate; // percentage
    const PLATFORM_FEE = settings.platformFee; // fixed fee

    // Tax is applied ONLY on platform fee, not on service amount
    const taxAmount = (PLATFORM_FEE * TAX_RATE) / 100;

    const totalAmount = priceAfterMembership + PLATFORM_FEE + taxAmount;

    return {
      taxAmount: Number(taxAmount.toFixed(2)),
      platformFee: PLATFORM_FEE,
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }
}

const bookingPriceService = new BookingPriceClass();
export { bookingPriceService };
