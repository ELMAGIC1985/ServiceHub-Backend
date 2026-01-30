import { STATUS } from '../../constants/constants.js';
import { Coupon } from '../../models/index.js';
import { ApiError } from '../../utils/index.js';
import { formatCoupon } from './utils/index.js';

class CouponQueryClass {
  async getCouponsForProduct(productId) {
    if (!productId) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Product ID is required.');
    }

    const coupons = await Coupon.find({
      appliesTo: 'Product',
      $or: [{ applicableItems: { $size: 0 } }, { applicableItems: productId }],
      expiryDate: { $gte: new Date() },
    });

    return {
      success: true,
      count: coupons.length,
      coupons: coupons.map((coupon) => formatCoupon(coupon)),
    };
  }

  async getCouponsForService(serviceTemplateId) {
    if (!serviceTemplateId) {
      throw new ApiError(STATUS.BAD_REQUEST, 'Service ID is required.');
    }

    const coupons = await Coupon.find({
      appliesTo: 'ServiceTemplate',
      $or: [{ applicableItems: { $size: 0 } }, { applicableItems: serviceTemplateId }],
      expiryDate: { $gte: new Date() },
    });

    return {
      success: true,
      count: coupons.length,
      coupons: coupons.map((coupon) => formatCoupon(coupon)),
    };
  }
}

const couponQueryClass = new CouponQueryClass();
export { couponQueryClass };
