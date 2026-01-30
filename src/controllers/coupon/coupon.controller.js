import { STATUS } from '../../constants/constants.js';
import { Coupon } from '../../models/coupon.model.js';
import { Product } from '../../models/product.model.js';
import { Service } from '../../models/service.model.js';
import { couponCommandClass } from '../../services/coupons/coupons.command.service.js';
import { couponQueryClass } from '../../services/coupons/coupons.query.service.js';
import { asyncHandler, ApiError, ApiResponse } from '../../utils/index.js';

const createCoupon = asyncHandler(async (req, res, next) => {
  const {
    code,
    discountType,
    discountValue,
    minPurchase,
    maxDiscount,
    expiryDate,
    usageLimit,
    applicableItems,
    appliesTo,
  } = req.body;

  const existingCoupon = await Coupon.findOne({ code });
  if (existingCoupon) {
    next(new ApiError(400, null, 'Coupon with this code already exists'));
  }

  const coupon = new Coupon({
    code,
    discountType,
    discountValue,
    minPurchase,
    maxDiscount,
    expiryDate,
    usageLimit,
    applicableItems,
    appliesTo,
  });

  await coupon.save();

  res.status(201).json(new ApiResponse(201, coupon, 'Coupon created successfully'));
});

const updateCoupon = asyncHandler(async (req, res, next) => {
  const result = await couponCommandClass.updateCoupon(req.body);
  return res.status(200).json(result);
});

const applyCoupon = asyncHandler(async (req, res, next) => {
  const { code, cartTotal } = req.body;
  const coupon = await Coupon.findOne({ code });

  if (!coupon) {
    next(new ApiError(400, 'Invalid coupon code'));
  }

  // Check if coupon is expired
  if (new Date() > coupon.expiryDate) {
    next(new ApiError(400, 'Coupon has expired'));
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    next(new ApiError(400, 'Coupon usage limit exceeded'));
  }

  // Check minimum purchase requirement
  if (cartTotal < coupon.minPurchase) {
    next(new ApiError(400, `Minimum purchase required is ${coupon.minPurchase}`));
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = (cartTotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    }
  } else {
    discountAmount = coupon.discountValue;
  }

  // Ensure discount does not exceed cart total
  discountAmount = Math.min(discountAmount, cartTotal);

  res.status(200).json(new ApiResponse(200, discountAmount, 'Coupon applied successfully'));
});

const couponUsage = asyncHandler(async (req, res) => {
  const { code } = req.body;
  await Coupon.findOneAndUpdate({ code }, { $inc: { usedCount: 1 } });

  res.status(200).json(new ApiResponse(200, null, 'Coupon usage updated successfully'));
});

const getAllCoupons = asyncHandler(async (req, res, next) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  res.status(200).json(new ApiResponse(200, coupons, 'All coupons fetched successfully'));
});

const getAvailableProducts = asyncHandler(async (req, res, next) => {
  const products = await Product.find({
    inventoryCount: {
      $gt: 0,
    },
  })
    .select('name price')
    .sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, products, 'Products retrieved successfully'));
});

const getAvailableService = asyncHandler(async (req, res, next) => {
  const products = await Service.find({
    availability: true,
  }).select('name price');

  res.status(200).json(new ApiResponse(200, products, 'Service retrieved successfully'));
});

const deleteCoupon = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  await Coupon.findByIdAndDelete(id);

  res.status(200).json(new ApiResponse(200, null, 'Coupon deleted successfully'));
});

const addApplicableItems = asyncHandler(async (req, res) => {
  try {
    const { items, couponId } = req.body;

    const result = await couponCommandClass.addApplicableItems(couponId, items);
    return res.status(200).json(result);
  } catch (error) {
    throw new ApiError(STATUS.BAD_REQUEST, error.message || 'Something went wrong');
  }
});

const getCouponsForProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await couponQueryClass.getCouponsForProduct(productId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getCouponsForService = async (req, res, next) => {
  try {
    const { serviceTemplateId } = req.params;
    const result = await couponQueryClass.getCouponsForService(serviceTemplateId);

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export {
  createCoupon,
  applyCoupon,
  couponUsage,
  getAvailableProducts,
  getAvailableService,
  getAllCoupons,
  deleteCoupon,
  addApplicableItems,
  getCouponsForProduct,
  getCouponsForService,
  updateCoupon,
};
