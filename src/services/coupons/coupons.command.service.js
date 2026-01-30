import { STATUS } from '../../constants/constants.js';
import { Coupon } from '../../models/index.js';
import { ApiError } from '../../utils/index.js';
import { couponUpdateSchema } from '../../validators/coupon.validation.js';

class CouponCommandClass {
  async addApplicableItems(couponId, items) {
    if (!Array.isArray(items)) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Items must be an array.');
    }

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      throw new ApiError(STATUS.NOT_FOUND, 'Coupon not found.');
    }

    // Replace old items with new ones
    coupon.applicableItems = items;

    await coupon.save();

    return {
      success: true,
      message: 'Applicable items updated successfully',
      coupon,
    };
  }

  async updateCoupon(payload) {
    const { code } = payload;
    const coupon = await Coupon.findOne({ code });
    if (!coupon) {
      throw new ApiError(STATUS.NOT_FOUND, 'Coupon not found.');
    }

    const { error, value } = couponUpdateSchema.validate(payload, { stripUnknown: true });

    if (error) {
      throw new ApiError(STATUS.BAD_REQUEST, error.details[0].message);
    }

    if (value.code && value.code !== coupon.code) {
      const existing = await Coupon.findOne({ code: value.code });
      if (existing) {
        throw new ApiError(STATUS.BAD_REQUEST, 'Coupon with this code already exists.');
      }
    }

    Object.assign(coupon, value);

    await coupon.save();

    return {
      success: true,
      message: 'Coupon updated successfully',
      coupon,
    };
  }
}

const couponCommandClass = new CouponCommandClass();

export { couponCommandClass };
